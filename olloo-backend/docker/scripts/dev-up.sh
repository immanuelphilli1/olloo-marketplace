#!/usr/bin/env bash
# Bring up the local development stack: php-fpm, queue, scheduler, gateway and
# Vite, all talking to the host's MySQL.
#
#   ./docker/scripts/dev-up.sh
#   open http://localhost:8030
#
# Pass --mail to add the mail catcher (web UI on :8026, SMTP on :1026).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -f env/app.env ]; then
    echo "docker/env/app.env is missing." >&2
    echo "  cp docker/env/app.env.example docker/env/app.env" >&2
    echo "  php artisan key:generate --show   # paste into APP_KEY" >&2
    exit 1
fi

if [ -z "$(grep -E '^DB_HOST=' env/app.env | cut -d= -f2-)" ]; then
    echo "DB_HOST is empty in docker/env/app.env." >&2
    echo "It must be host.docker.internal: MySQL is on the host, not in Docker." >&2
    exit 1
fi

PROFILES=()
if [ "${1:-}" = "--mail" ]; then
    PROFILES=(--profile mail)
fi

echo "Building the development image and starting the stack..."
docker compose -f compose.yaml -f compose.dev.yaml up -d --build "${PROFILES[@]}"

echo
echo "Waiting for the app to answer..."
for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://127.0.0.1:8030/up" 2>/dev/null; then
        echo "HandCO is up on http://localhost:8030"
        echo "  admin portal: check ADMIN_PATH_PREFIX in docker/env/app.env"
        echo "  mail catcher: http://localhost:8026 (only with --mail)"
        echo "  vite HMR:    http://localhost:5174"
        exit 0
    fi
    sleep 2
done

echo "The app did not answer /up within 60s. Recent logs:" >&2
docker compose -f compose.yaml -f compose.dev.yaml logs --tail=40 app >&2
exit 1