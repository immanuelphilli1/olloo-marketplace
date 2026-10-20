#!/usr/bin/env bash
# Publish a storefront build to the directory the gateway bind-mounts.
#
#   publish-web.sh <build-dir> [--web-root /var/www/handco/shared/web] [--keep 5]
#
# Run from the frontend repository's CI after its build succeeds, or by hand.
# Needs write access to the web root, so on the deploy host it runs under sudo.
#
# The layout mirrors the API's own releases, because it has the same constraint:
#
#   <web-root>/.releases/<stamp>-<build>/    a complete build
#   <web-root>/current -> .releases/<...>    the symlink the gateway serves
#
# A copy in place is not safe. Vite's filenames are content-hashed, so a shopper
# who loaded the previous index.html still needs those exact chunks; overwriting
# or deleting them turns a deploy into a wave of 404s for anyone on the page at
# the time. Writing a new directory and moving one symlink means both sets of
# files exist until the browser stops asking, and rolling the storefront back is
# moving the same symlink the other way.

set -euo pipefail

BUILD_DIR=""
WEB_ROOT="/var/www/handco/shared/web"
KEEP=5

die() { echo "publish-web: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
    case "$1" in
        --web-root) WEB_ROOT="${2:-}"; shift 2 ;;
        --keep)     KEEP="${2:-}"; shift 2 ;;
        -h|--help)  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        -*)         die "unknown option $1" ;;
        *)          BUILD_DIR="$1"; shift ;;
    esac
done

[ -n "$BUILD_DIR" ] || die "usage: publish-web.sh <build-dir> [--web-root DIR] [--keep N]"
[ -d "$BUILD_DIR" ] || die "build dir $BUILD_DIR does not exist"

# A build without index.html is not a build. This is the one file the SPA cannot
# do without, and publishing without it takes the whole storefront down.
[ -f "${BUILD_DIR}/index.html" ] || die "no index.html in $BUILD_DIR. Is this the Vite output directory, and did the build succeed?"

# A build that still points at the Vite dev server would render a blank page in
# production. Cheap to check now, expensive to diagnose from a browser later.
if grep -qE '@vite/client|/@vite|localhost:517[0-9]' "${BUILD_DIR}/index.html"; then
    die "index.html references the Vite dev server. Run a production build, not the dev server."
fi

command -v rsync >/dev/null 2>&1 || die "rsync is required"

# Identity for the release directory: the frontend's commit if there is one, so a
# rollback can be chosen by name, plus a timestamp so two builds of the same
# commit still get distinct directories.
STAMP="$(date -u +%Y%m%d%H%M%S)"
if [ -d "${BUILD_DIR}/.git" ] || git -C "$BUILD_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    SHA="$(git -C "$BUILD_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
else
    # printf, not a pipe from basename: the trailing newline would otherwise be
    # translated by tr -c into a literal '-' and every release name would end in one.
    SHA="$(printf '%s' "$(basename "$BUILD_DIR")" | tr -c 'A-Za-z0-9._-' '-' | cut -c1-40)"
fi
RELEASE_NAME="${STAMP}-${SHA}"
RELEASES="${WEB_ROOT}/.releases"
RELEASE_DIR="${RELEASES}/${RELEASE_NAME}"

mkdir -p "${RELEASES}"

# Refuse to work under the API's own tree. The two layouts are deliberately
# siblings, and pointing this at APP_ROOT would prune the API's releases as if
# they were storefront builds.
case "$(cd "${WEB_ROOT}" && pwd -P)" in
    */releases|/var/www/handco)
        die "web root ${WEB_ROOT} is inside the API's release tree. Point it at shared/web."
        ;;
esac

echo "==> copying build to ${RELEASE_DIR}"
mkdir -p "${RELEASE_DIR}"
# --delete inside a fresh directory is belt and braces, but it is what makes a
# rebuild of the same commit produce a byte-identical tree.
rsync -a --delete "${BUILD_DIR}/" "${RELEASE_DIR}/"

# Carry over the bundle files the previous build's index.html loads. The gateway
# serves /assets/ from `current` only, so without this a page rendered just
# before the switch (by the storefront SSR server, or open in a browser) asks for
# file names that no longer exist. Only the files that index.html names, so
# releases do not accumulate every old bundle. Hashed names never collide, and
# this build's own files are never overwritten.
PREVIOUS_RELEASE="$(readlink -f "${WEB_ROOT}/current" 2>/dev/null || true)"
if [ -n "${PREVIOUS_RELEASE}" ] && [ -f "${PREVIOUS_RELEASE}/index.html" ]; then
    grep -oE '/assets/[A-Za-z0-9._-]+\.(js|css)' "${PREVIOUS_RELEASE}/index.html" | sort -u | while read -r asset; do
        if [ -f "${PREVIOUS_RELEASE}${asset}" ] && [ ! -e "${RELEASE_DIR}${asset}" ]; then
            mkdir -p "$(dirname "${RELEASE_DIR}${asset}")"
            cp "${PREVIOUS_RELEASE}${asset}" "${RELEASE_DIR}${asset}"
        fi
    done
fi

# Anything executable in a static build is a mistake (or an attack), and nginx
# will happily serve a CGI source file as text.
find "${RELEASE_DIR}" -type f -perm /111 -delete

# nginx runs as its own unprivileged uid inside the gateway container, so it has to
# be able to traverse and read this tree as "other". Without these bits every
# storefront request fails with
#   stat() "/var/www/html/web/current/" failed (13: Permission denied)
# which reads like a broken bind mount rather than a permission bit, and the API
# underneath keeps answering so nothing else fails. rsync -a carries the build's
# own permissions across, so this is not guaranteed by the copy.
chmod -R a+rX "${RELEASE_DIR}"
chmod a+rx "${RELEASES}" "${WEB_ROOT}"

# Repoint the symlink. ln -sfn alone is not atomic when the target is a symlink:
# it unlinks first, so there is a window with no current. Write a temporary link
# beside it and rename over the top, which is a single atomic operation. Same
# trick, and same reason, as the cut-over in docker/scripts/release.sh.
#
# The target is RELATIVE, and it has to be. The gateway reads this directory
# through a bind mount at /var/www/html/web, so an absolute target such as
# /var/www/handco/shared/web/.releases/... resolves inside the container, where
# that path does not exist. The link is then dangling, and nginx fails every
# storefront request with "rewrite or internal redirection cycle" because
# /index.html cannot be opened. A relative target is resolved against the
# directory holding the link, which exists on the host and in the container.
echo "==> pointing current at ${RELEASE_NAME}"
ln -sfn ".releases/${RELEASE_NAME}" "${WEB_ROOT}/.current.tmp"
mv -Tf "${WEB_ROOT}/.current.tmp" "${WEB_ROOT}/current"

# Prune old releases. Never the one current points at, and never one newer than
# it: blue and green gateways are still reading whichever build they mounted, and
# deleting a tree out from under an open page is exactly the failure this script
# exists to avoid.
echo "==> keeping the newest ${KEEP} releases"
mapfile -t ALL < <(find "${RELEASES}" -mindepth 1 -maxdepth 1 -type d | sort -r)
KEPT=0
for dir in "${ALL[@]}"; do
    KEPT=$((KEPT + 1))
    if [ "${KEPT}" -gt "${KEEP}" ] && [ "${dir}" != "$(readlink -f "${WEB_ROOT}/current")" ]; then
        echo "    pruning $(basename "$dir")"
        rm -rf "$dir"
    fi
done

echo "==> published ${RELEASE_NAME}"
echo "    ${WEB_ROOT}/current -> ${RELEASE_NAME}"