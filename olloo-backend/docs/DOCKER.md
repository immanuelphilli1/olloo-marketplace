# Running HandCO in Docker

MySQL is **not** in Docker. It stays on the host and the containers reach it over `host.docker.internal`, so the same database is shared with host tooling (`php artisan`, mysql client, other projects) and there is one backup to reason about.

Everything else is a container: php-fpm, a queue worker, the scheduler, and an nginx gateway.

## Local development

One-time per host, as root:

```bash
sudo ./docker/scripts/expose-host-mysql-to-docker.sh
```

That DNATs the Docker bridge address to `127.0.0.1:3306`. mysqld's `bind-address` is not changed and 3306 is never published on a public interface. It also raises `max_connect_errors` and flushes the MySQL host cache, because container restarts and TCP probes otherwise block the container's IP with `SQLSTATE[HY000] [1129]`.

Then:

```bash
cp docker/env/app.env.example docker/env/app.env
php artisan key:generate --show   # paste into APP_KEY
# set DB_DATABASE, DB_USERNAME, DB_PASSWORD, and create the database

./docker/scripts/dev-up.sh              # http://localhost:8030
./docker/scripts/dev-up.sh --mail       # plus the mail catcher on :8026
./docker/scripts/dev-down.sh            # keeps uploads, logs, node_modules
./docker/scripts/dev-down.sh --purge    # removes them too
```

Vite runs in a container on `http://localhost:5174` with HMR, and the repo is bind-mounted, so edits are picked up without a rebuild.

## Services

| Service | What it is |
|---|---|
| `app` | php-fpm, the thing nginx talks to. Not published. |
| `queue` | `queue:work`. Webhooks, order expiry, outbound mail. |
| `scheduler` | `schedule:work`. `orders:expire-unpaid`, `currency:update-rates` twice daily, `model:prune` daily. |
| `gateway` | nginx, serves `public/` and proxies PHP. Published on loopback only. |

No Redis: session, cache and queue are all database-backed, so a release has no shared cache to invalidate and a rollback has nothing extra to lose.

`storage` is a named volume (`handco_storage_data`) shared by every service and every release. Uploads, product-import archives and logs live there, so they survive a container recreate and a rollback. Confirmed: a file written before `docker compose up -d --force-recreate app` was still there after.

## The storefront

The production gateway serves a React SPA (built in a separate repository) at `/` and
Laravel under `/api/`, `/webhooks/`, `/sanctum/`, `/up` and the admin prefix, on one
origin. That routing lives in `docker/nginx/spa.conf.template`, which is templated at
container start because the admin prefix is per installation.

Locally the dev gateway still uses `docker/nginx/default.conf`, which is Laravel only.
So the production routing is not exercised by `./docker/scripts/dev-up.sh` at all. CI
boots the production gateway against a fixture build and asserts the split, which is
why that split is a tested contract rather than something you rediscover on a deploy.

To serve a storefront locally, publish a build to a directory and point `WEB_ROOT` at
it:

```bash
docker/scripts/publish-web.sh ../handco-storefront/dist --web-root /tmp/handco-web
WEB_ROOT=/tmp/handco-web docker compose -f docker/compose.yaml -f docker/compose.prod.yaml up -d
```

`WEB_ROOT` is only read by the production overlay, so `compose.dev.yaml` is unaffected
and the local Vite dev server keeps working on `:5174`.

## Image targets

| Target | Use |
|---|---|
| `production` | `app`, `queue`, `scheduler`. Optimised autoloader, no dev dependencies, Vite assets baked in. |
| `gateway` | nginx, `public/` copied from the `production` stage so the web tier and PHP tier serve the same build. |
| `development` | repo bind-mounted, Node installed, Vite dev server. |
| `gateway-dev` | nginx config only; `public/` bind-mounted from the host. |

Build from the base file, not the prod overlay:

```bash
docker compose -f docker/compose.yaml build app gateway
```

`docker/compose.prod.yaml` sets `build: !reset null` on every service, because the server only loads and runs images that CI built. It needs Compose 2.24+ for the `!reset` tag.

## What the entrypoint does

`docker/entrypoint.sh` waits for host MySQL over a real `mysqladmin ping` (never a bare TCP probe, which trips `max_connect_errors`), creates and chowns the storage directories, runs `storage:link`, and then hands over to the command.

Two switches, both off by default and only useful for an ad-hoc `docker compose run app` on a fresh install:

- `RUN_MIGRATIONS=true` runs `migrate --force`
- `RUN_DEPLOY_SEED=true` runs `db:seed --class=ProductionDatabaseSeeder --force`

The deploy script passes explicit `php artisan` commands instead. With `compose run` and no command, the entrypoint falls through to the service's own command (`php-fpm -F`) and the deploy hangs forever.

## If the container cannot reach the database

In order of likelihood:

1. `DB_HOST` is not `host.docker.internal`.
2. mysqld binds only `127.0.0.1` and the DNAT rules are gone. Re-run the expose script; it is installed as a systemd unit so a reboot re-applies them.
3. `SQLSTATE[HY000] [1129]`: the container's IP is blocked in the MySQL host cache. `sudo mysqladmin flush-hosts`, and raise `max_connect_errors` as the script does.
4. The database or its user does not exist with grants for the Docker network.

## Ports

8030 dev gateway, 8031 and 8032 the production blue/green pair. Pick a range nothing else on the host uses: `qr-phoenix` takes 8020 and other stacks already hold 8021. See `docker/PORTS.md`.

## Deploying

Not this file. See [DEPLOYING.md](DEPLOYING.md).