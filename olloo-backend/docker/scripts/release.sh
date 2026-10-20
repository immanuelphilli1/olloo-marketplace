#!/usr/bin/env bash
# Switch a built release to live, without dropping requests.
#
# Called by .github/workflows/deploy.yml on the server as the deploy user. Also
# the rollback tool: point it at any release directory and it switches to that.
#
#   ./docker/scripts/release.sh /var/www/handco/releases/<sha>
#
# Why this is shaped the way it is
# -------------------------------
# Docker Compose cannot republish a port that is already in use, so recreating
# a service in place means the old container stops before the new one is up.
# That is downtime. Instead the two releases run side by side under different
# Compose project names and different loopback ports, and the switch is the
# `current` symlink: the host reverse proxy includes its upstream file through
# that symlink, so repointing the symlink and reloading is the atomic change.
#
#   1. build a per-release .env, then migrate on the new stack
#   2. start the new stack under a new project name on the free port
#   3. health check it directly, before anything public depends on it
#   4. write the upstream file, repoint `current`, reload the host proxy
#   5. verify through the public entry point, then retire the old stack
#
# A failure at step 3 exits with the previous release still serving, so the
# failed stack is never reachable by a customer.
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/handco}"
RELEASE_DIR="${1:-}"
SHARED_ENV="${APP_ROOT}/shared/app.env"
CURRENT="${APP_ROOT}/current"

# Everything after the release directory is an override, positional on purpose.
#
# Kept positional so a manual rollback (`release.sh <old-release>`) works with
# no environment to set up, and so the values actually used are visible in the
# process list and the deploy log. Environment variables are honoured too, so
# `HOST_PROXY=none release.sh <dir>` keeps working for rehearsals.
#
#   release.sh <release-dir> [public-url] [host-proxy] [keep-releases] [web-root]
PUBLIC_URL="${2:-${PUBLIC_URL:-}}"
HOST_PROXY="${3:-${HOST_PROXY:-nginx}}"
KEEP_RELEASES="${4:-${KEEP_RELEASES:-5}}"
# Where the storefront build is published. Derived from APP_ROOT by default so a
# manual rollback with no environment set still finds the right directory.
WEB_ROOT="${5:-${WEB_ROOT:-${APP_ROOT}/shared/web}}"
DRAIN_TIMEOUT="${DRAIN_TIMEOUT:-150}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
PRIMARY_PORT="${PRIMARY_PORT:-8031}"
SECONDARY_PORT="${SECONDARY_PORT:-8032}"

die() { echo "$*" >&2; exit 1; }

# Runs as the deploy user (handco-deploy), never as root. The only privileged
# operation is reloading the host proxy, which goes through passwordless sudo
# for that one command (see docker/scripts/install-runner.sh). Everything else
# only needs the docker group plus write access to APP_ROOT, so requiring root
# here would widen every deploy to a root shell for no benefit.
if [ ! -w "${APP_ROOT}" ] && [ ! -w "$(dirname "${APP_ROOT}")" ]; then
    die "Cannot write to ${APP_ROOT}. As root once: mkdir -p ${APP_ROOT} && chown -R $(id -un):$(id -un) ${APP_ROOT}"
fi

[ -n "${RELEASE_DIR}" ] || die "Usage: $0 <release-dir>"
[ -f "${RELEASE_DIR}/docker/compose.yaml" ] || die "${RELEASE_DIR}/docker/compose.yaml is missing. Was the release extracted?"
[ -f "${RELEASE_DIR}/.version" ] || die "${RELEASE_DIR}/.version is missing. Was the release extracted?"

RELEASE_DIR="$(readlink -f "${RELEASE_DIR}")"
PROJECT="$(basename "${RELEASE_DIR}")"
VERSION="$(cat "${RELEASE_DIR}/.version")"

# Timestamped. When a deploy goes wrong the sequence matters far more than the
# wording, and reconstructing it from container logs afterwards is guesswork.
log() { printf '\n[%s] \033[1m==> %s\033[0m\n' "$(date -u '+%H:%M:%S')" "$1"; }

# ---------------------------------------------------------------------------
# What is live right now?
# ---------------------------------------------------------------------------
PREVIOUS_RELEASE=""
PREVIOUS_PROJECT=""
PREVIOUS_PORT=""

# ---------------------------------------------------------------------------
# Bootstrap the symlink the host proxy includes through
# ---------------------------------------------------------------------------
# The host proxy does `include /var/www/handco/current/upstream.conf` (nginx)
# or `Include /var/www/handco/current/proxy.conf` (Apache), so `current` must
# exist before the proxy is installed. Creating it is initial server setup, not
# a deploy step, and this script deliberately does not do setup: on an
# unprovisioned host it stops here instead of half-building one.
if [ ! -e "${CURRENT}" ]; then
    die "${CURRENT} does not exist. Server setup creates releases/0000000-bootstrap (upstream.conf plus proxy.conf) and symlinks it as current. See docs/DEPLOYING.md."
fi

if [ -L "${CURRENT}" ]; then
    PREVIOUS_RELEASE="$(readlink -f "${CURRENT}")"
    PREVIOUS_PROJECT="$(basename "${PREVIOUS_RELEASE}")"
    PREVIOUS_PORT="$(awk -F= '/^GATEWAY_PORT=/ {print $2}' "${PREVIOUS_RELEASE}/docker/env/app.env" 2>/dev/null || true)"

    # The bootstrap stub has a symlink and an upstream file but no stack, so it is
    # not a release: there is nothing to tear down and nothing to roll back to.
    if [ "${PREVIOUS_PROJECT}" = "0000000-bootstrap" ]; then
        PREVIOUS_RELEASE=""
        PREVIOUS_PROJECT=""
        PREVIOUS_PORT=""
    fi
fi

if [ "${PREVIOUS_RELEASE}" = "${RELEASE_DIR}" ]; then
    die "Release ${VERSION} is already live. Nothing to do."
fi

# The project directory is the release's docker/ directory, because
# compose.yaml names ./env/app.env in its service-level env_file and Compose
# resolves that against the project directory, not against the compose file.
compose_in() {
    local dir="$1" project="$2"
    shift 2
    docker compose \
        --project-name "${project}" \
        --project-directory "${dir}/docker" \
        --env-file "${dir}/docker/env/app.env" \
        -f "${dir}/docker/compose.yaml" \
        -f "${dir}/docker/compose.prod.yaml" \
        "$@"
}

# ---------------------------------------------------------------------------
# Per-release environment
# ---------------------------------------------------------------------------
# shared/app.env holds the settings that must not change between releases, APP_KEY
# above all. The release-specific values are appended so each release directory
# records exactly the configuration it shipped with, which is what makes a
# rollback honest.
[ -f "${SHARED_ENV}" ] || die "Missing ${SHARED_ENV}. See docs/DEPLOYING.md."

# Two ports, alternating: the release being deployed takes the one the live
# release is not using. Two slots is all a blue/green switch needs, and it means
# the port a release runs on is recoverable from the release directory alone.
if [ -n "${PREVIOUS_PORT}" ] && [ "${PREVIOUS_PORT}" = "${PRIMARY_PORT}" ]; then
    GATEWAY_PORT="${SECONDARY_PORT}"
else
    GATEWAY_PORT="${PRIMARY_PORT}"
fi

# Written to docker/env/app.env, not to a dotfile at the release root: that is the
# path compose.yaml names in its service-level env_file, and it is resolved
# relative to the compose file, so this is the one path that both feeds the
# containers and feeds Compose's own variable interpolation.
#
# A real file rather than a symlink to shared/app.env, so each release records the
# exact configuration it shipped with. That is what makes a rollback honest: it
# puts the old code back on the settings it was verified with, not on whatever
# shared/app.env says today.
mkdir -p "${RELEASE_DIR}/docker/env"
MERGED_ENV="${RELEASE_DIR}/docker/env/app.env"

cat "${SHARED_ENV}" > "${MERGED_ENV}"
cat >> "${MERGED_ENV}" <<EOF

# Written by docker/scripts/release.sh for release ${PROJECT}.
IMAGE_TAG=${VERSION}
APP_IMAGE=${APP_IMAGE:-handco-app}
GATEWAY_IMAGE=${GATEWAY_IMAGE:-handco-gateway}
GATEWAY_PORT=${GATEWAY_PORT}
COMPOSE_PROJECT_NAME=${PROJECT}
# Read by compose.prod.yaml for the gateway's storefront bind mount.
WEB_ROOT=${WEB_ROOT}
EOF

# Every secret the site has is in this file: APP_KEY, the database password, the
# payment provider keys. It is owned by the deploy user with 0600: the docker
# CLI reads it for env_file, the containers get the values in their
# environment rather than by opening it, and the host proxy user (www-data /
# nginx) must never be able to read it. World-readable here would hand the
# production APP_KEY to every local user.
chmod 0600 "${MERGED_ENV}"

# Deliberately NOT sourced. This is a dotenv file, not a shell script: sourcing it
# runs whatever it contains, and any unquoted value with a space in it (`APP_NAME=H&CO
# API`) is a syntax error that kills the deploy with a message pointing at line 22
# of a file nobody is looking at. Read the one value needed instead.
if ! grep -Eq '^APP_KEY=.+$' "${MERGED_ENV}"; then
    die "APP_KEY is missing or empty in ${SHARED_ENV}. A wrong key cannot decrypt stored 2FA secrets, so this stops before anything starts."
fi

# The storefront web root must exist with a build behind its `current` symlink
# before the gateway starts. Without it Docker creates the bind-mount source as
# an empty root-owned directory, and every storefront request fails on a missing
# index.html while the API underneath keeps answering. Publishing the
# storefront is server setup (bootstrap-web.sh for a placeholder,
# publish-web.sh for the real build), not a deploy step: stopping here keeps a
# missing build a loud setup error instead of a half-broken shop.
if [ ! -f "${WEB_ROOT}/current/index.html" ]; then
    die "No storefront build at ${WEB_ROOT}/current/index.html. Publish one during server setup. See docs/DEPLOYING.md."
fi

cd "${RELEASE_DIR}"
COMPOSE=(docker compose
    --project-name "${PROJECT}"
    --project-directory "${RELEASE_DIR}/docker"
    --env-file "${MERGED_ENV}"
    -f "${RELEASE_DIR}/docker/compose.yaml"
    -f "${RELEASE_DIR}/docker/compose.prod.yaml")

# ---------------------------------------------------------------------------
# Migrate on the new code, before it takes traffic
# ---------------------------------------------------------------------------
# Migrations here are additive, so the previous release keeps serving against the
# newer schema while the new one is health checked. Running them before the
# cut-over means a migration that breaks the old code fails with the old release
# still live, rather than after traffic has moved.
log "Migrating on ${VERSION}"
# An explicit command, not the entrypoint's RUN_MIGRATIONS switch: `compose run`
# with no command would fall through to the service's own command, which is
# `php-fpm -F`, and block here forever.
"${COMPOSE[@]}" run --rm --no-deps app php artisan migrate --force

log "Seeding the deploy catalogs on ${VERSION}"
# The same four seeders the image documents: permissions, currencies, the
# countries they name, and the payment methods. Deliberately not db:seed, which
# would create demo accounts and a demo catalogue.
"${COMPOSE[@]}" run --rm --no-deps app php artisan db:seed --class=ProductionDatabaseSeeder --force

# ---------------------------------------------------------------------------
# Start the new stack beside the old one
# ---------------------------------------------------------------------------
log "Starting ${PROJECT} on 127.0.0.1:${GATEWAY_PORT}"
"${COMPOSE[@]}" up -d --no-build

log "Health checking 127.0.0.1:${GATEWAY_PORT}/up"
healthy=false
for _ in $(seq 1 "${HEALTH_RETRIES}"); do
    if curl -fsS -o /dev/null "http://127.0.0.1:${GATEWAY_PORT}/up" 2>/dev/null; then
        healthy=true
        break
    fi
    sleep 2
done

if [ "${healthy}" != "true" ]; then
    echo "Release ${VERSION} did not answer /up on 127.0.0.1:${GATEWAY_PORT}." >&2
    echo "${PREVIOUS_RELEASE:-nothing} is still live. Logs:" >&2
    "${COMPOSE[@]}" logs --tail=60 gateway app >&2
    echo >&2
    echo "The failed stack is left up for inspection. Remove it with:" >&2
    echo "  docker compose -p ${PROJECT} --env-file ${MERGED_ENV} \\" >&2
    echo "    -f ${RELEASE_DIR}/docker/compose.yaml \\" >&2
    echo "    -f ${RELEASE_DIR}/docker/compose.prod.yaml down" >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# The cut-over
# ---------------------------------------------------------------------------
log "Repointing current at ${PROJECT} and reloading ${HOST_PROXY}"
# Written into the release, then reached by the host proxy through the symlink.
# That ordering matters: the file has to exist before anything points at it, or
# the reload would fail on a missing include and take the proxy down with it.
# Apache's equivalent of the file below. Written to a separate name because the two
# formats are not interchangeable: nginx reads `server host:port;` inside an
# `upstream` block and would treat `ProxyPass` as an unknown directive, while Apache
# parses ProxyPass and has no `server` directive at all. Each host config includes
# only the file its own server understands, so the release can be cut over on
# either without an edit here.
#
# Apache re-reads Include through the symlink on a graceful reload, so `current`
# is the cut-over for it too. Rehearsed: repointing the symlink and running
# `apache2ctl -k graceful` moved the live upstream to the other colour, and
# repointing it back rolled it back, with no dropped connection either time.
#
# Product pages go to the storefront SSR server first (127.0.0.1:SSR_PORT, run by
# the storefront deploy), with this release's gateway as a hot standby (+H). A
# refused connection fails over within the same request, so before the SSR server
# exists, while it restarts, or if it dies, shoppers get the gateway's own page
# (meta tags, plain shell). Defined here, not in the host config, because the
# standby is this release's gateway port. Needs mod_proxy_balancer,
# mod_lbmethod_byrequests and mod_slotmem_shm. ProxyPassMatch before `ProxyPass /`:
# Apache takes the first match.
SSR_PORT="${SSR_PORT:-8041}"
cat > "${RELEASE_DIR}/proxy.conf" <<EOF
# Generated by docker/scripts/release.sh. Do not edit; the next deploy overwrites
# it. See upstream.conf, which this mirrors for Apache.
<Proxy "balancer://storefront-ssr">
    BalancerMember "http://127.0.0.1:${SSR_PORT}" connectiontimeout=1 timeout=15 retry=5
    BalancerMember "http://127.0.0.1:${GATEWAY_PORT}" status=+H
</Proxy>
ProxyPassMatch "^(/products/[^/]+/?)$" "balancer://storefront-ssr\$1"
ProxyPass / http://127.0.0.1:${GATEWAY_PORT}/
ProxyPassReverse / http://127.0.0.1:${GATEWAY_PORT}/
EOF

cat > "${RELEASE_DIR}/upstream.conf" <<EOF
# Generated by docker/scripts/release.sh. Do not edit; the next deploy
# overwrites it. The host proxy includes this file through ${CURRENT}, so this
# file and the current symlink always describe the same release.
#
# Only the server line. keepalive and anything else belong to the host proxy's own
# upstream block: repeating a directive nginx already has there is a "duplicate
# directive" fatal, which takes the proxy down on reload.
server 127.0.0.1:${GATEWAY_PORT};
EOF

# Rename onto the name rather than writing through it: mv -T replaces the link
# itself, so a request following the old symlink mid-swap cannot observe a
# half-updated path.
ln -sfn "${RELEASE_DIR}" "${CURRENT}.new"
mv -Tf "${CURRENT}.new" "${CURRENT}"

reload_proxy() {
    # The one privileged operation in this script. Runs as the deploy user;
    # passwordless sudo is granted for exactly these reload commands
    # (see docker/scripts/install-runner.sh). Full paths, because sudoers
    # matches on them.
    case "${HOST_PROXY}" in
        nginx)  sudo /bin/systemctl reload nginx || sudo /usr/bin/systemctl reload nginx ;;
        apache) sudo /bin/systemctl reload apache2 || sudo /usr/bin/systemctl reload apache2 ;;
        none)   : ;;
        # Anything else is run as a command, so a host that fronts HandCO with
        # something else (or a rehearsal that runs its proxy in a container) does
        # not need a change here. Deliberately unquoted so the value word splits
        # into a command with arguments; globbing is off so a path in the value
        # is not expanded against the release directory.
        #
        # The status is captured explicitly rather than left to the trailing
        # set +f, which succeeds and would report a failed reload as a clean one.
        *)      set -f; ${HOST_PROXY}; status=$?; set +f; return ${status} ;;
    esac
}

# If the proxy refuses the new config, `current` has already moved and traffic
# has not. Put the symlink back, so what the proxy is serving and what the
# filesystem claims are the same release again, and stop: the new stack passed its
# health check, it simply is not what the public is pointed at.
if ! reload_proxy; then
    echo "The host proxy failed to reload with the new upstream." >&2
    if [ -n "${PREVIOUS_RELEASE}" ]; then
        echo "Restoring ${CURRENT} to ${PREVIOUS_RELEASE}." >&2
        ln -sfn "${PREVIOUS_RELEASE}" "${CURRENT}.new"
        mv -Tf "${CURRENT}.new" "${CURRENT}"
        reload_proxy || echo "WARNING: the proxy also failed to reload on the old upstream." >&2
    else
        # First deploy on this host: there is no previous release to go back to,
        # and the proxy was probably never started because `current` did not
        # exist until this run. Say so instead of implying a rollback happened.
        echo "This was the first release on this host, so there is nothing to roll back to." >&2
        echo "The proxy includes ${CURRENT}/upstream.conf, which this run has just" >&2
        echo "created. Start or reload it now:" >&2
        echo "  sudo nginx -t && sudo systemctl reload nginx" >&2
    fi
    echo "Fix the proxy, then re-run:" >&2
    echo "  ${RELEASE_DIR}/docker/scripts/release.sh ${RELEASE_DIR}" >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Verify through the public entry point
# ---------------------------------------------------------------------------
# A proxy that failed to pick up the new upstream has to be caught here, not by a
# customer. This is the only check that exercises the real public path.
if [ -n "${PUBLIC_URL}" ]; then
    log "Verifying ${PUBLIC_URL}/up"
    public_ok=false
    for _ in $(seq 1 15); do
        if curl -fsS -o /dev/null "${PUBLIC_URL}/up" 2>/dev/null; then
            public_ok=true
            break
        fi
        sleep 2
    done

    # The storefront is what a shopper lands on, so probe it too. /up alone proves
    # PHP is reachable through the proxy and says nothing about /, which is now
    # served from a bind-mounted host directory that a misconfigured WEB_ROOT can
    # leave empty or unreadable. Two failures, two different causes, and the second
    # is invisible to the first.
    storefront_ok=false
    for _ in $(seq 1 15); do
        if curl -fsS -o /dev/null "${PUBLIC_URL}/" 2>/dev/null; then
            storefront_ok=true
            break
        fi
        sleep 2
    done

    if [ "${public_ok}" != "true" ]; then
        echo "The public entry point does not answer /up after the switch." >&2
        echo "The API itself is unreachable through the proxy, so check the" >&2
        echo "proxy reload and the new gateway before suspecting the storefront." >&2
        echo "Rolling back to ${PREVIOUS_RELEASE:-the previous release}." >&2
        if [ -n "${PREVIOUS_RELEASE}" ]; then
            ln -sfn "${PREVIOUS_RELEASE}" "${CURRENT}.new"
            mv -Tf "${CURRENT}.new" "${CURRENT}"
            reload_proxy
        fi
        echo "The new stack is left up for inspection. Traffic is on the old release." >&2
        exit 1
    fi

    if [ "${storefront_ok}" != "true" ]; then
        echo "The public entry point answers /up but does not serve / after the switch." >&2
        echo "The API is fine; check the storefront web root: ${WEB_ROOT}" >&2
        echo "  ls -l ${WEB_ROOT}/current/index.html" >&2
        echo "Rolling back to ${PREVIOUS_RELEASE:-the previous release}." >&2
        if [ -n "${PREVIOUS_RELEASE}" ]; then
            ln -sfn "${PREVIOUS_RELEASE}" "${CURRENT}.new"
            mv -Tf "${CURRENT}.new" "${CURRENT}"
            reload_proxy
        fi
        echo "The new stack is left up for inspection. Traffic is on the old release." >&2
        exit 1
    fi
fi

log "Release ${VERSION} is live on 127.0.0.1:${GATEWAY_PORT}"

# ---------------------------------------------------------------------------
# Retire the previous release
# ---------------------------------------------------------------------------
if [ -n "${PREVIOUS_PROJECT}" ] && [ "${PREVIOUS_PROJECT}" != "${PROJECT}" ]; then
    log "Stopping ${PREVIOUS_PROJECT}, draining up to ${DRAIN_TIMEOUT}s"
    # SIGTERM then wait. DRAIN_TIMEOUT must exceed the queue worker's
    # stop_grace_period (120s) plus a job's own timeout (90s), or
    # `down --timeout` SIGKILLs a running settlement or mail job mid-flight.
    # The default of 150s honours that ordering; lowering it below the grace
    # period reintroduces killed jobs that look like failed payments.
    compose_in "${PREVIOUS_RELEASE}" "${PREVIOUS_PROJECT}" down --timeout "${DRAIN_TIMEOUT}" || {
        echo "WARNING: ${PREVIOUS_PROJECT} did not stop cleanly. It is no longer behind the" >&2
        echo "proxy, so this is not a service outage, but check it with:" >&2
        echo "  docker ps --filter label=com.docker.compose.project=${PREVIOUS_PROJECT}" >&2
    }
fi

# ---------------------------------------------------------------------------
# Prune
# ---------------------------------------------------------------------------
log "Pruning releases, keeping ${KEEP_RELEASES}"
cd "${APP_ROOT}/releases" || die "Cannot read ${APP_ROOT}/releases"
ls -1t | tail -n "+$((KEEP_RELEASES + 1))" | while read -r old; do
    [ -n "${old}" ] || continue
    # Never the release just deployed, never the rollback target, and never the
    # bootstrap stub while it is still what `current` resolves to.
    if [ "${old}" = "${PROJECT}" ] || [ "${old}" = "${PREVIOUS_PROJECT}" ]; then
        continue
    fi
    if [ "${old}" = "0000000-bootstrap" ]; then
        continue
    fi
    echo "  removing releases/${old}"
    rm -rf "${APP_ROOT}/releases/${old}"
    # The release directory is gone; its images would otherwise sit on disk
    # forever. `image prune -f` below only removes dangling layers, never
    # tagged release images, so remove this release's tags explicitly. A
    # rollback further back than KEEP_RELEASES then needs a rebuild, which is
    # why that release should have been kept instead.
    docker rmi "${APP_IMAGE:-handco-app}:${old}" "${GATEWAY_IMAGE:-handco-gateway}:${old}" >/dev/null 2>&1 || true
done

# Dangling build layers only. Tagged release images are handled per release
# above, so disk use stays flat at roughly KEEP_RELEASES image pairs.
docker image prune -f >/dev/null 2>&1 || true

echo
echo "Deployed ${VERSION} (${PROJECT}) on 127.0.0.1:${GATEWAY_PORT}."
if [ -n "${PREVIOUS_RELEASE}" ]; then
    echo "Roll back with:"
    echo "  ${APP_ROOT}/current/docker/scripts/release.sh ${PREVIOUS_RELEASE}"
fi