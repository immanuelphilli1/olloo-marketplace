---
name: storefront-ssr-local-test
description: Test the storefront SSR server, its hydration, and the production Apache routing (proxy.conf balancer, internal API listener on 8039) locally before a deploy. Use when changing server/ssr.mjs, the storefront Dockerfile or deploy.yml, docker/host-apache/handco.conf, or the proxy.conf block in release.sh, or when SSR pages show React error #418 or lose their meta tags.
---

# Storefront SSR local test

## Goal

Prove on this machine that product pages are server-rendered, hydrate without a mismatch, keep their SEO head, and fail over to the gateway, using the real Apache directives. Runbook for production: `docs/DEPLOYING.md` 3b.

## Steps

1. **API with every env var.** Seed a scratch sqlite DB, then run PHP's built-in server **from `public/`**:
   ```bash
   export DB_CONNECTION=sqlite DB_DATABASE=$SCRATCH/api.sqlite SESSION_DRIVER=array CACHE_STORE=array LOG_CHANNEL=stderr \
     APP_URL=http://127.0.0.1:8077 WEB_CLIENT_URL=http://127.0.0.1:5180 CORS_ALLOWED_ORIGINS=http://127.0.0.1:5180 \
     STOREFRONT_INDEX_PATH=$STOREFRONT/dist/client/index.html
   php artisan migrate:fresh --seed --force && php artisan images:placeholders
   cd public && PHP_CLI_SERVER_WORKERS=4 setsid php -S 127.0.0.1:8077 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php &
   ```
2. **Storefront** (clone, never push from it without being asked): `VITE_API_BASE_URL=http://127.0.0.1:8077/api/v1 npm run build:ssr`, then `SSR_API_BASE_URL=http://127.0.0.1:8077/api/v1 PORT=5180 setsid node server/ssr.mjs &`. Port 5180, because it is the origin in CORS.
3. **Hydration**: headless Chromium (`puppeteer-core` in a separate tools dir, `executablePath: '/snap/bin/chromium'`, profile under `~/snap/chromium/common/`). Keep the first `<h1>` the parser creates with a `MutationObserver` in `evaluateOnNewDocument`; after load it must still be `document.querySelector('h1')`. Check `/products/<rid>`, `?from=home`, `?category=..&subcategory=..`, widths 1366 and 390, and JavaScript off. Repeat once with development React (`NODE_ENV=development npx vite build --mode development --minify false ...`), which logs attribute mismatches production React ignores.
4. **Apache routing**: `httpd:2.4` with `--network host`. Generate the test config from the real `docker/host-apache/handco.conf` (drop the :80 vhost and SSL lines, `<VirtualHost 127.0.0.1:18443>`, include path to a mounted `proxy.conf`), enable `proxy proxy_http proxy_balancer lbmethod_byrequests slotmem_shm headers remoteip rewrite`, comment out `Listen 80`. Render `proxy.conf` from the real lines: `GATEWAY_PORT=8077 RELEASE_DIR=$DIR bash -c "$(sed -n '/^SSR_PORT=/,/^EOF$/p' docker/scripts/release.sh)"`. `httpd -t`, then run it and check: SSR page via 18443 (non-empty `#root`), `docker stop handco-ssr` gives the gateway page (head present, empty root, 200), `/up` via 8039 is 403.
5. **Headers**: a 10-line Python `http.server` that echoes `X-Forwarded-For`, `CF-Connecting-IP`, `Host` stands in for the gateway (render a second `proxy.conf` with its port). Via 8039 with `X-Forwarded-For: 41.66.1.2` it must see `CF-Connecting-IP: 41.66.1.2` and `Host: hcomall.com`; via 18443 a client's fake `X-Forwarded-For`/`CF-Connecting-IP` must be replaced by the real address.
6. **Workflow steps**: extract the SSR steps from `.github/workflows/deploy.yml` with `yaml.safe_load` and run them with `bash -e` and the env they need (`SHA`, `SSR_API_BASE_URL`, `SSR_PORT`, `SSR_CANDIDATE_PORT`, `PUBLIC_URL`).

## Gotchas

- `php artisan serve` passes only variables that exist in `.env` to its child server. `STOREFRONT_INDEX_PATH` is not there, so the page controller could not find `index.html` and 500'd trying to log it.
- The SSR server must render `pathname + search`. `HomePage` reads `?from=` in its first render; without the query, every link from home failed hydration (React #418) and the page rendered twice.
- `/seo` answers JSON fields, not an HTML string. A server that expects `head`/`html` silently ships pages with no meta tags.
- `echo "$PAGE" | grep -q ...` under `pipefail` fails on large pages: `grep -q` exits at the first match and `echo` dies of SIGPIPE. Use `grep -q PATTERN <<<"$PAGE"`.
- `sed -i` on a file bind-mounted into a container replaces the inode; the container keeps the old file. Write a new file and restart the container.
- `pkill -f 'node server/ssr.mjs'` matches the shell running the command and kills it. Kill by port: `ss -ltnp | grep ':5180 '`.
- `php artisan serve` is single-threaded; the SSR server's three parallel API calls then look like random failures. Use `PHP_CLI_SERVER_WORKERS`.

## What didn't work

- `php artisan serve` for the API (env filtering, single thread).
- Editing a mounted Apache config with `sed -i` and a graceful restart.
- Port 8443 for the test vhost: already taken on this machine.
