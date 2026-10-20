#!/usr/bin/env bash
# Create the storefront web root and a placeholder build, once per host.
#
#   bootstrap-web.sh [--web-root /var/www/handco/shared/web]
#
# Run this during server setup as the deploy user, before the first deploy. Without it the gateway
# bind-mounts a path that does not exist, Docker creates it as an empty
# root-owned directory, and every storefront request fails on a missing index.html
# while the API underneath it keeps working. That is a confusing half-broken shop
# rather than an obvious failure.
#
# The placeholder is a real, if dull, build: a complete index.html behind the same
# `current` symlink publish-web.sh uses. Swapping it for the real storefront is then
# just a publish, with no change to the gateway and no reload.

set -euo pipefail

WEB_ROOT="/var/www/handco/shared/web"

die() { echo "bootstrap-web: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
    case "$1" in
        --web-root) WEB_ROOT="${2:-}"; shift 2 ;;
        -h|--help)  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        -*)         die "unknown option $1" ;;
        *)          die "unexpected argument $1" ;;
    esac
done

[ -n "${WEB_ROOT}" ] || die "--web-root needs a value"
# No root requirement: the web root lives under /var/www/handco, owned by the
# deploy user. Root would only be needed if the path were created under a
# root-owned tree, in which case chown it to the deploy user once instead.
[ -w "${WEB_ROOT}" ] || [ -w "$(dirname "${WEB_ROOT}")" ] || die "cannot write to ${WEB_ROOT}. As root once: mkdir -p ${WEB_ROOT} && chown -R $(id -un):$(id -un) ${WEB_ROOT}"

# Same guard as publish-web.sh: these two trees are siblings by design and pointing
# one at the other would have each prune the other's releases.
#
# Checked twice on purpose. The string form runs first so a wrong path is refused
# before anything is created, and the physical form runs after mkdir so a symlink
# pointing into the release tree is caught too. Neither uses `realpath -m`, which
# is a GNU coreutils extension and absent from busybox.
refuse_if_inside_releases() {
    case "$1" in
        */releases|/var/www/handco)
            die "web root ${WEB_ROOT} is inside the API's release tree. Point it at shared/web."
            ;;
    esac
}

refuse_if_inside_releases "${WEB_ROOT%/}"
mkdir -p "${WEB_ROOT}"
refuse_if_inside_releases "$(cd "${WEB_ROOT}" && pwd -P)"

RELEASES="${WEB_ROOT}/.releases"
PLACEHOLDER="0000000-placeholder"

if [ -L "${WEB_ROOT}/current" ] && [ -e "${WEB_ROOT}/current" ]; then
    echo "==> ${WEB_ROOT}/current already points at a build ($(readlink "${WEB_ROOT}/current"))"
    echo "    nothing to do. Replace it with docker/scripts/publish-web.sh <build-dir>."
    exit 0
fi

mkdir -p "${RELEASES}/${PLACEHOLDER}"

cat > "${RELEASES}/${PLACEHOLDER}/index.html" <<'HTML'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>H&amp;CO</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; margin: 0;
         display: grid; place-items: center; min-height: 100vh; background: #faf9f7; color: #1c1917; }
  main { max-width: 34rem; padding: 2rem; text-align: center; }
  h1 { font-size: 1.5rem; margin: 0 0 .75rem; }
  p { color: #57534e; line-height: 1.6; margin: 0 0 1rem; }
  code { background: #f5f5f4; padding: .15rem .4rem; border-radius: .25rem; font-size: .875rem; }
</style>
</head>
<body>
<main>
  <h1>The storefront has not been deployed yet</h1>
  <p>The API is live on this origin. Publish the storefront build and this page is
     replaced, with no gateway change and no reload:</p>
  <p><code>docker/scripts/publish-web.sh &lt;build-dir&gt;</code></p>
</main>
</body>
</html>
HTML

ln -sfn ".releases/${PLACEHOLDER}" "${WEB_ROOT}/.current.tmp"
mv -Tf "${WEB_ROOT}/.current.tmp" "${WEB_ROOT}/current"

# nginx runs as its own unprivileged uid inside the gateway container, so it must be
# able to traverse and read this tree as "other". Without these bits every storefront
# request fails with stat() ... Permission denied while the API keeps answering, which
# reads like a broken bind mount rather than a permission bit.
chmod -R a+rX "${RELEASES}/${PLACEHOLDER}"
chmod a+rx "${RELEASES}" "${WEB_ROOT}"

echo "==> bootstrapped ${WEB_ROOT}"
echo "    ${WEB_ROOT}/current -> ${PLACEHOLDER}"
echo "    publish the real build with docker/scripts/publish-web.sh <build-dir>"