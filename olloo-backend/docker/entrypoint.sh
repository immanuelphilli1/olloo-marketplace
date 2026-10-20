#!/bin/sh
# Container entrypoint: wait for host MySQL, fix volume ownership, optionally
# migrate, then hand over to the command.
set -eu

DB_HOST="${DB_HOST:-host.docker.internal}"
DB_PORT="${DB_PORT:-3306}"
WAIT_TIMEOUT="${DB_WAIT_TIMEOUT:-60}"

# No bare TCP probes (nc -z) against MySQL: an aborted handshake counts toward
# max_connect_errors and eventually yields SQLSTATE[HY000] [1129], which then
# blocks the container's IP until someone flushes the host cache. A real
# mysqladmin ping over TCP counts as a completed connection.
wait_for_mysql() {
    host="$1"
    port="$2"
    user="${DB_USERNAME:-}"
    password="${DB_PASSWORD:-}"
    elapsed=0

    echo "Waiting for MySQL at ${host}:${port}..."
    while true; do
        if MYSQL_PWD="$password" mysqladmin ping \
            --protocol=TCP \
            -h"$host" \
            -P"$port" \
            -u"$user" \
            --connect-timeout=2 \
            --silent >/dev/null 2>&1; then
            break
        fi

        elapsed=$((elapsed + 1))
        if [ "$elapsed" -ge "$WAIT_TIMEOUT" ]; then
            echo "Timed out waiting for MySQL at ${host}:${port} after ${WAIT_TIMEOUT}s." >&2
            echo "Host mysqld usually binds 127.0.0.1 only, and Compose reaches it over" >&2
            echo "host.docker.internal (docker0). If this is a fresh host:" >&2
            echo "  sudo docker/scripts/expose-host-mysql-to-docker.sh" >&2
            echo "If you see SQLSTATE[HY000] [1129], a client IP is blocked and the host" >&2
            echo "cache needs clearing: sudo mysqladmin flush-hosts" >&2
            exit 1
        fi
        sleep 1
    done
    echo "MySQL is reachable."
}

if [ -z "${APP_KEY:-}" ]; then
    echo "APP_KEY is empty. Set it in docker/env/app.env." >&2
    exit 1
fi

if [ "${DB_CONNECTION:-}" != "sqlite" ]; then
    wait_for_mysql "$DB_HOST" "$DB_PORT"
fi

mkdir -p \
    storage/framework/cache \
    storage/framework/sessions \
    storage/framework/views \
    storage/app/private \
    storage/logs \
    bootstrap/cache

# Named volumes and first boot create these as root; php-fpm runs as www-data.
chown -R www-data:www-data storage bootstrap/cache || true
chmod -R ug+rwx storage bootstrap/cache || true

# The admin portal uploads product images and product-import archives to
# storage/app/private, and public/storage serves the public disk. Both live on
# the shared volume, so the link is created once per container.
if [ ! -L public/storage ] && [ ! -e public/storage ]; then
    php artisan storage:link || true
fi

# Off by default, and used only for an ad-hoc `docker compose run app` on a fresh
# install. The deploy script passes explicit artisan commands instead: with
# `compose run` and no command, the entrypoint falls through to the service's own
# command (`php-fpm -F`) and never exits.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    php artisan migrate --force
fi

if [ "${RUN_DEPLOY_SEED:-false}" = "true" ]; then
    php artisan db:seed --class=ProductionDatabaseSeeder --force
fi

exec "$@"