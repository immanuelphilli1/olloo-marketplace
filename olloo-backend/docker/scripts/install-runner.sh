#!/usr/bin/env bash
# Install and register the HandCO self-hosted deploy runner on this host.
#
# The runner builds the release image here and then switches it live, so it needs
# the docker group and passwordless sudo for the two things release.sh does that
# a normal user cannot: reload the host proxy and manage containers.
#
# Run once, as a user that exists on the box (not root):
#   ./docker/scripts/install-runner.sh <version>
# The version comes from https://github.com/actions/runner/releases, e.g. 2.328.0.
set -euo pipefail

RUNNER_VERSION="${1:-}"
RUNNER_USER="${RUNNER_USER:-handco-deploy}"
RUNNER_DIR="${RUNNER_DIR:-/opt/actions-runner}"
RUNNER_LABELS="${RUNNER_LABELS:-Linux,ARM64}"

if [ -z "${RUNNER_VERSION}" ]; then
    echo "Usage: $0 <runner-version>" >&2
    echo "Get it from https://github.com/actions/runner/releases/latest" >&2
    exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
    echo "Run as a normal user, not root." >&2
    echo "The runner is intended to run unprivileged; it uses sudo for the two things it" >&2
    echo "cannot do itself. Running the runner as root would put unreviewed repository" >&2
    echo "code in a root shell on the box serving customers." >&2
    exit 1
fi

ARCH="$(uname -m)"
case "${ARCH}" in
    x86_64) RUNNER_ARCH=x64 ;;
    aarch64|arm64) RUNNER_ARCH=arm64 ;;
    *) echo "Unsupported architecture: ${ARCH}. Install the runner manually." >&2; exit 1 ;;
esac

echo "==> Creating the ${RUNNER_USER} user"
if ! id "${RUNNER_USER}" >/dev/null 2>&1; then
    sudo useradd --create-home --shell /bin/bash "${RUNNER_USER}"
fi

echo "==> Adding ${RUNNER_USER} to the docker group"
# Without this the runner cannot build or run anything. It is equivalent to root,
# which is why this runner must be trusted with the deploy branch.
sudo usermod -aG docker "${RUNNER_USER}"

echo "==> Downloading the runner ${RUNNER_VERSION} (${RUNNER_ARCH})"
if [ ! -d "${RUNNER_DIR}" ]; then
    sudo mkdir -p "${RUNNER_DIR}"
    sudo chown "${RUNNER_USER}:${RUNNER_USER}" "${RUNNER_DIR}"
fi
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT
RUNNER_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
echo "    ${RUNNER_URL}"
curl -fsSL -o "${TMP}/runner.tar.gz" "${RUNNER_URL}"
tar -xzf "${TMP}/runner.tar.gz" -C "${RUNNER_DIR}"
sudo chown -R "${RUNNER_USER}:${RUNNER_USER}" "${RUNNER_DIR}"

echo "==> Granting passwordless sudo for the proxy reload only"
# Narrow by design. The deploy itself (staging files, docker compose, release
# directories) runs as this user with no sudo at all; the single privileged
# operation is the host proxy reload inside release.sh.
#
# Honesty note, kept from the earlier version: the runner is still
# root-equivalent through the docker group (`docker run -v /:/host` is a root
# shell), so this narrowing removes accidental damage, not privilege. The real
# control is which repository and branch can reach this runner: repository
# runner, `deploy` branch only, behind the `production` environment approval.
#
# Full paths, because sudoers matches on them and release.sh calls them that
# way (/bin is a symlink to /usr/bin on Debian, both spellings are allowed so
# the grant survives either resolution).
SUDOERS="/etc/sudoers.d/handco-runner"
sudo tee "${SUDOERS}" >/dev/null <<EOF
# HandCO deploy runner: proxy reload only. The deploy itself needs no sudo.
${RUNNER_USER} ALL=(root) NOPASSWD: /bin/systemctl reload nginx, /usr/bin/systemctl reload nginx, /bin/systemctl reload apache2, /usr/bin/systemctl reload apache2, /usr/sbin/nginx -t, /usr/sbin/apache2ctl configtest
EOF
sudo chmod 0440 "${SUDOERS}"
sudo visudo -c -f "${SUDOERS}" >/dev/null

cat <<EOF

Next, as ${RUNNER_USER}:

  sudo -iu ${RUNNER_USER}
  cd ${RUNNER_DIR}
  ./config.sh --unattended \\
    --url https://github.com/OWNER/REPO \\
    --token TOKEN_FROM_A_REPOSITORY_ADMIN \\
    --name "handco-deploy-$(hostname)" \\
    --labels ${RUNNER_LABELS} \\
    --work _work \\
    --replace

  ./run.sh

Labels this installed with: ${RUNNER_LABELS}. The deploy job's runs-on has to name
the same set, or the job queues forever with no visible error, which is the most
common way a self-hosted deploy setup goes wrong:

  grep -n 'runs-on: \[self-hosted' .github/workflows/deploy.yml

GitHub matches these labels case-insensitively, but the set must match.

Register the runner as a repository runner (not an organisation one), then add
the production environment with any required reviewers so a deploy is a deliberate
act.

This host is $(uname -m), so that is the ${RUNNER_ARCH} runner build. The deploy job
builds its images here too, so they are ${RUNNER_ARCH} as well: every base image in
docker/Dockerfile is multi-arch and resolves to this architecture.

Two things to know before you rely on this:

  * A self-hosted runner on the production box executes repository code with
    docker access, which is root on that box. Only the deploy branch should be
    able to reach it, and a deploy should sit behind the environment approval.

  * The build runs on the machine serving shoppers. A Vite and Composer build is
    CPU and memory hungry. Watch /up latency while it runs. The deploy workflow
    prints a baseline and a post-deploy measurement for exactly this reason, and
    docs/DEPLOYING.md says what to do about it.
EOF