name: HandCO production

## 1. Docker

Follow [DOCKER.md](DOCKER.md). On the server, one-time, as root:

```bash
sudo ./docker/scripts/expose-host-mysql-to-docker.sh
```

## 2. Layout (server setup, once)

Create this before the first deploy. The deploy assumes it exists and stops
with a setup error otherwise; it never creates host state itself.

```
/var/www/handco/
  releases/<commit>/       one per deploy, last 5 kept
    docker/                compose files, nginx conf, release.sh
    docker/env/app.env     shared settings + this release's overrides
    upstream.conf          the port this release's gateway is on
    .version, RELEASE_INFO
  shared/
    app.env                the only copy of the settings that must not change
    web/                   the storefront build, see section 3a
      .releases/<build>/   one per storefront deploy
      current -> .releases/<build>
  current -> releases/<commit>
```

`current` is the cut-over. The host proxy includes its upstream file *through* that symlink, so repointing it and reloading moves all traffic.

```bash
mkdir -p /var/www/handco/{releases,shared}
chown -R <runner-user>:<runner-user> /var/www/handco
mkdir -p /var/www/handco/releases/0000000-bootstrap
cat > /var/www/handco/releases/0000000-bootstrap/upstream.conf <<'EOF'
# Bootstrap placeholder. No stack is running yet; the first deploy replaces it.
server 127.0.0.1:8031;
EOF
cat > /var/www/handco/releases/0000000-bootstrap/proxy.conf <<'EOF'
# Bootstrap placeholder. No stack is running yet; the first deploy replaces it.
ProxyPass / http://127.0.0.1:8031/
ProxyPassReverse / http://127.0.0.1:8031/
EOF
chown -R <runner-user>:<runner-user> /var/www/handco
ln -sfn /var/www/handco/releases/0000000-bootstrap /var/www/handco/current
```

Until the first real deploy nothing listens on 8031, so the site 502s. That is
the honest state for an unprovisioned host. Both files are needed because the
nginx vhost Includes `upstream.conf` and the Apache vhost Includes
`proxy.conf`; the formats are not interchangeable.

Everything in the deploy runs as `handco-deploy`, never as root. The only
privileged operation is the host proxy reload inside `release.sh`, which uses
passwordless sudo for that one command. Grant exactly that and nothing else:

```bash
cat /etc/sudoers.d/handco-runner   # written by install-runner.sh, proxy reload only
sudo visudo -c -f /etc/sudoers.d/handco-runner
```

`NOPASSWD: ALL` must not be used here. The narrow grant removes accidental
damage; the real boundary is which repository and branch can reach the runner
(see section 5). Note the runner is still root-equivalent through the `docker`
group (`docker run -v /:/host` is a root shell), so scoping sudo is hygiene,
not the security boundary.

## 3. shared/app.env

Copy from `docker/env/app.env.example`, then lock it down:

```bash
chown handco-deploy:handco-deploy /var/www/handco/shared/app.env
chmod 0600 /var/www/handco/shared/app.env
```

**handco-deploy 0600**, and that is worth being precise about. The deploy runs
as `handco-deploy`: `release.sh` copies this file into a merged env that the
docker CLI reads for `env_file`, and the containers receive the values in
their environment, never by opening either file. So the deploy user must read
it, and nobody else needs to. In particular `www-data` (the host proxy user)
must never read it: giving Apache's user the production `APP_KEY` and database
password on the host buys nothing. The deploy's preflight reads this file
directly as the deploy user for exactly that reason.

Two things must be right:

- **`APP_KEY`** must match what the site already uses, or you deploy working code that cannot decrypt anything. Staff 2FA secrets and recovery codes are encrypted with it, so a wrong key locks out every account with 2FA. Take it from the current production `.env`.
- **`DB_HOST=host.docker.internal`** and the `DB_*` credentials for the `handco` database.

Also: `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` and `WEB_CLIENT_URL` set to the real origin, `ADMIN_PATH_PREFIX`, `TRUSTED_PROXIES` if anything sits in front of the host, `IPINFO_TOKEN`, and the payment provider keys.

`ADMIN_PATH_PREFIX` must not be left blank, and this is not a style preference. The production gateway templates the value into `location ^~ /<prefix>/`, so a blank value produces `location ^~ /`, nginx rejects it as a duplicate of the storefront catch-all, and the container never starts. `App\Support\EnvGuard` rejects blank and multi-segment values at boot so the message names `app.env` instead of nginx. `env()`'s default only applies when the variable is *missing*, not when it is present and empty, which is why a blank line in the file is worse than no line at all.

Do not set `QUEUE_CONNECTION=sync`. The stack runs a dedicated queue container and a scheduler container, so `sync` does not remove the queued work, it moves it onto shoppers: a payment webhook would settle and send mail before returning, and `orders:expire-unpaid` would run inside an unrelated page load.

## 3a. The storefront

The storefront is a React SPA in its own repository, served at `/` by the same origin as the API. No CORS is involved. The gateway bind-mounts a host directory read-only and serves it, so both live on one certificate, one hostname, and one origin.

Publish a placeholder during server setup, from a checkout of this repository
(bootstrap-web.sh needs no release to exist, only write access to the web root):

```bash
./docker/scripts/bootstrap-web.sh --web-root /var/www/handco/shared/web
```

Then publish the real build from the frontend repo's CI after its build succeeds:

```bash
/var/www/handco/current/docker/scripts/publish-web.sh <build-dir>
```

Run both as the runner user (the web root is owned by it). A deploy requires
`<web-root>/current/index.html` to exist and fails in preflight without it;
publishing the storefront is setup, not a deploy step.

Without a web root, Docker creates the bind-mount source as an empty root-owned
directory, every storefront request 500s on a missing `index.html`, and the API
underneath keeps answering. A half-broken shop, not an obvious failure. That is
why the deploy refuses to start without `<web-root>/current/index.html`
instead of creating one: a missing build is a setup error and should say so.

It writes `<web-root>/.releases/<timestamp>-<commit>/` and repoints `<web-root>/current`. It refuses a build with no `index.html` and one still pointing at the Vite dev server, because both take the shop down and both are obvious here and invisible from a browser.

Three things about this that are not obvious:

**The `current` symlink target is relative.** The gateway reads the directory through a bind mount at `/var/www/html/web`, so an absolute target resolves inside the container, where that host path does not exist, and every storefront request fails with a rewrite cycle. `publish-web.sh` writes `.releases/<name>` for this reason and must keep doing so.

**Publishing is not copying files in place.** Vite's filenames are content-hashed, so a shopper who loaded the previous `index.html` still needs those exact chunks. A new directory plus a symlink move means both sets exist until the browser stops asking, and it makes rolling the storefront back a symlink move rather than a second implementation.

**`WEB_ROOT` must be a host path, not a named volume.** Compose namespaces named volumes per project and `release.sh` gives blue and green different project names, so a named volume would give each colour its own storefront and a rollback would silently serve the wrong build. The same trap applies to `handco_storage_data`: it is explicitly named so both colours share uploads. Never run `docker compose down -v` against either. It is not a namespace-scoped volume, so `-v` removes it for every project on the host.

The storefront repo must build with `base: '/spa-assets/'` in its Vite config. The admin portal's own build is served at `/build/`, and without an explicit base the SPA would claim that path and the admin portal would 404 on its assets. `/assets/` is accepted too, so a build that forgot the base still serves rather than 404ing on every chunk.

Rolling the API back does not roll the storefront back, and vice versa. That is deliberate: they are separate repositories on separate release cycles, and the shared mount is what keeps them independent.

## 3b. Storefront SSR (product pages)

Product pages (`/products/{rid}`) are server-rendered by a Node process from the storefront repository (`server/ssr.mjs`, image `handco-web-ssr:<commit>`, container `handco-ssr`). Everything else stays as described in 3a: static files and the plain shell from the web root, and the Laravel head injection for `/`, `/categories` and `/categories/*`.

```
browser ─▶ Apache :443 ──/products/*──▶ balancer://storefront-ssr
                │                          ├─ 127.0.0.1:8041  handco-ssr (Node, host network)
                │                          └─ 127.0.0.1:<gateway> hot standby (+H)
                └──everything else──▶ gateway (blue or green)

handco-ssr ─▶ Apache 127.0.0.1:8039 (/api/ only) ─▶ gateway   (X-Forwarded-For → CF-Connecting-IP)
```

- **Routing lives in `proxy.conf`, written by `release.sh`.** The hot standby is the release's own gateway port, so the fallback follows the blue/green switch with no edit. A refused connection to 8041 fails over within the same request; the member is retried after 5 seconds. So before the SSR container exists, while the storefront deploy replaces it, or if it dies, shoppers get the gateway's page: the full meta tags and the plain shell. SSR can cost speed, never the page.
- **The SSR server calls the API through Apache's internal listener** (`127.0.0.1:8039`, `/api/` only, everything else 403). It includes the same `current/proxy.conf`, so it always reaches the live gateway. It copies the shopper address that `handco-ssr` forwards in `X-Forwarded-For` into `CF-Connecting-IP`, which is the only header the gateway takes the client address from. Without it every server-rendered page would be priced for the server's own country.
- **The public vhost sets `CF-Connecting-IP` from the real client** (`expr=%{REMOTE_ADDR}`) and drops any client `X-Forwarded-For`. Production is not behind Cloudflare, so before this the gateway received no `CF-Connecting-IP` at all and PHP saw Apache's Docker bridge address for every visitor (`GET /locale` answered `countrySource: "default"`). Expect IP country detection to start working once this is live (with `IPINFO_TOKEN` set).
- **That line needs a gateway that passes `REMOTE_ADDR` as `$realip_remote_addr`.** The gateway's `real_ip` turns `CF-Connecting-IP` into `$remote_addr`. An older gateway passed that to PHP as `REMOTE_ADDR`, so the visitor's public IP stood where the proxy should be: Laravel no longer matched `TRUSTED_PROXIES`, ignored `X-Forwarded-Proto`, and the admin's assets loaded over `http://` and were blocked as mixed content (seen in production on 2026-10-11). The fixed gateway passes the real peer (the Docker bridge, which `TRUSTED_PROXIES` matches) as `REMOTE_ADDR` and the visitor in `X-Forwarded-For`. Deploy that API release before you enable the Apache line.
- **`publish-web.sh` keeps the previous build's entry bundles** (the files its `index.html` names). The gateway serves `/assets/` from `current` only, and a page `handco-ssr` rendered just before the switch names the previous build's files.
- **The storefront deploy owns the container.** It smoke-tests a candidate on `127.0.0.1:8042` against the live API, publishes the static files, then replaces `handco-ssr` on 8041, and checks `PUBLIC_URL/products/<rid>`. It warns, not fails, if that page is not server-rendered, because the fallback still serves it.

Ports (loopback only, nothing to open in a firewall): 8039 internal API listener, 8041 `handco-ssr`, 8042 the deploy's candidate.

### One-time server setup

Apache needs the balancer modules before an API release with the new `proxy.conf` is deployed. Without them `systemctl reload apache2` refuses the config; `release.sh` then puts `current` back and fails the deploy, so nothing breaks, but nothing ships either.

```bash
sudo a2enmod proxy proxy_http proxy_balancer lbmethod_byrequests slotmem_shm headers remoteip
sudo cp /path/to/this/checkout/docker/host-apache/handco.conf /etc/apache2/sites-available/handco.conf
sudo apache2ctl configtest && sudo systemctl reload apache2
curl -fsS http://127.0.0.1:8039/api/v1/locale                     # 200: internal listener up
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8039/up # 403: only /api/ is open
```

The host config can go in before the API release: the internal listener includes whatever `current/proxy.conf` is there, old or new.

### Order of the first rollout

1. One-time server setup above.
2. Deploy the API (push to `deploy`). `proxy.conf` now routes `/products/*` to the balancer; with no SSR container yet, every product request fails over to the gateway, as today.
3. Merge the storefront's SSR branch to its `main`. Its deploy starts `handco-ssr`, and product pages are server-rendered from then on.

### Checking it

```bash
docker ps --filter name=handco-ssr --format '{{.Names}} {{.Image}} {{.Status}}'
curl -s https://hcomall.com/products/<rid> | grep -o '<div id="root"><'   # server-rendered
docker stop handco-ssr                                                 # fallback drill
curl -s https://hcomall.com/products/<rid> | grep -c 'rel="canonical"'  # still 1, root empty
docker start handco-ssr
docker logs --tail 50 handco-ssr                                       # SSR failures are logged here
```

### Rollback

- **SSR only** (the static build is fine): run the previous image on the same port. `docker images handco-web-ssr` lists the three the deploy keeps.

  ```bash
  docker rm -f handco-ssr
  docker run -d --name handco-ssr --network host --restart unless-stopped \
    --log-opt max-size=10m --log-opt max-file=5 \
    -e HOST=127.0.0.1 -e PORT=8041 -e SSR_API_BASE_URL=http://127.0.0.1:8039/api/v1 \
    handco-web-ssr:<previous-commit>
  ```

- **Turn SSR off**: `docker rm -f handco-ssr`. The balancer fails over to the gateway for every product request, permanently, at the cost of a refused local connection.
- **Whole storefront**: repoint `<web-root>/current` at the previous `.releases/` entry (relative target, `ln -sfn` plus `mv -Tf`, as `publish-web.sh` does) and run the previous SSR image as above. Keep the two on the same commit: the SSR server's HTML names its own build's bundle files.

The nginx host config (`docker/host-nginx/handco.conf`) does not route SSR. Production runs Apache; if that ever changes, port the balancer and the internal listener first.

## 4. Host proxy

**Apache**, which is what production runs. `docker/host-apache/handco.conf`:

```bash
sudo cp docker/host-apache/handco.conf /etc/apache2/sites-available/handco.conf
sudo a2ensite handco.conf && sudo a2dissite 000-default
sudo apache2ctl configtest && sudo systemctl reload apache2
```

Apache is not a downgrade here. `Include` reads through a symlink, so the same
`current` cut-over works: release.sh writes the new release's `proxy.conf`, repoints
`current`, and `apachectl -k graceful` re-reads it. Rehearsed, including the
rollback, with no dropped connection either way. `proxy.conf` is written alongside
`upstream.conf` because the two formats cannot be parsed by the other server: nginx
rejects `ProxyPass` inside an `upstream` block and Apache has no `server` directive.

`ProxyPreserveHost On` and `RequestHeader set X-Forwarded-Proto "https"` are not
optional. Laravel builds absolute URLs from the forwarded scheme, and the session
cookie's `Secure` flag and the post-payment bounce both depend on it. Verified at the
backend: `X-Forwarded-Proto: https` arrives.

**nginx**, if you ever front it with that instead. The upstream is the gateway, which
serves the storefront at `/` and the API under `/api/`, so this file does not change:

```bash
sudo cp docker/host-nginx/handco.conf /etc/nginx/sites-available/handco
sudo ln -s /etc/nginx/sites-available/handco /etc/nginx/sites-enabled/handco
sudo nginx -t && sudo systemctl reload nginx
```

Install the proxy after section 2 is done. `current` already exists by then
(the bootstrap stub), so `nginx -t` sees the file it includes through the
symlink:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

The Cloudflare real-IP ranges in the config matter: `ShopperLocale` detects a shopper's country from their IP, so if the proxy hands PHP the Cloudflare edge IP instead of the visitor's, every shopper is placed in the same country.

## 5. The deploy runner

The deploy job runs on a self-hosted runner **on this host**. It builds the image here and switches it live, so there is no image registry and no SSH from CI back into the machine.

```bash
./docker/scripts/install-runner.sh <version>     # version from the runner releases page
```

That creates a `handco-deploy` user, adds it to the `docker` group, installs the runner to `/opt/actions-runner`, and grants passwordless sudo for the proxy reload only (step 2 explains why the deploy itself needs no sudo). Then configure it as a **repository** runner:

```bash
sudo -iu handco-deploy
cd /opt/actions-runner
./config.sh --unattended \
  --url https://github.com/OWNER/REPO \
  --token TOKEN_FROM_A_REPOSITORY_ADMIN \
  --name "handco-deploy-$(hostname)" \
  --labels Linux,ARM64 \
  --work _work
./run.sh
```

Those labels must match the deploy job's `runs-on: [self-hosted, Linux, ARM64]`. GitHub matches them case-insensitively, but the set has to be the same: a runner with the wrong labels sits idle and the job queues forever with no error, which is the most common way this goes wrong.

### ARM64

The host is `aarch64`, so the images are `linux/arm64` too. Every base image in `docker/Dockerfile` (`php:8.2-fpm-bookworm`, `node:22-bookworm-slim`, `nginx:1.27-alpine`) is multi-arch and resolves to this architecture; nothing in the Dockerfile needs a per-arch branch. The images, the migrations against host MySQL, the queue worker and the three-release rehearsal were all built and run on ARM64.

`install-runner.sh` detects `aarch64`/`arm64` and downloads the matching runner, and prints the labels it applied so they can be compared against `runs-on`. What would break is moving this setup to an x86 host without updating `runs-on`.

The test job stays on GitHub-hosted runners. The suite and the frontend build do not belong on the box serving shoppers, and there is no reason to make production wait for them twice.

Add the `production` environment with required reviewers so a deploy is a deliberate act.

### What a runner on the production box means

Two things, both worth being clear about.

**It is root on that machine.** A self-hosted runner with docker access executes whatever code the workflow checks out. Restrict it to the `deploy` branch, keep it a *repository* runner rather than an organisation one, keep the environment approval, and do not point it at `main`.

**The build competes with live traffic.** `docker compose build` runs Composer and a full Vite build on the same CPUs and the same RAM as the shop. On a small VPS that is a real latency spike during the deploy. The workflow prints `/up` latency before the build and after the switch so the cost is visible rather than guessed at.

Mitigations, in the order I would apply them:

1. **Size the host for it.** Two cores and enough spare RAM for a Node build alongside the app. This is the real fix.
2. **Keep the Docker layer cache.** Only `composer.lock`, `package-lock.json` and `COPY . .` change, so the dependency layers are cached between deploys. `install-runner.sh` does not prune images; `release.sh` prunes dangling ones only.
3. **The build is already capped.** `NODE_OPTIONS=--max-old-space-size=4096` in the assets stage stops a single Vite build from taking the whole machine.
4. **Deploy off-peak** if you are on a small box.

Measure before and after on the real host. If `/up` during the build exceeds a few hundred milliseconds, the box is undersized for self-hosted deploys and the honest answer is to build on a separate machine and push to a registry on this host.

Runner housekeeping: `_work` is reused between jobs and is owned by the runner user. If a job ever fails with a permissions error in `_work`, remove it (`rm -rf /opt/actions-runner/_work`) rather than widening sudo.

## 6. First deploy

```bash
git checkout deploy
git push origin main:deploy
```

That runs the suite on a GitHub-hosted runner, then on this host builds both images, boots one to prove it works, stages `/var/www/handco/releases/<commit>`, and switches it live. It migrates and runs `ProductionDatabaseSeeder` as part of the switch.

Set `PUBLIC_URL` at the top of `.github/workflows/deploy.yml` to the real origin. It is what the cut-over is verified through, and it is what the before/after latency samples use. Without it a proxy that silently ignored the reload would not be caught until a customer hit it.

## 7. Later deploys

Merge to `main`, then fast-forward `deploy` and push it.

## What the deploy job does

1. Runs `.github/workflows/ci.yml` on GitHub-hosted runners: pint, the suite, the frontend build, the image build, and a boot check. A commit that cannot pass never reaches this host.
2. On the self-hosted runner, records `/up` latency so the build's cost is measurable.
3. `docker compose build --pull app gateway`, both images in one step.
4. Boots the app image once with sqlite, so an image that builds but cannot boot fails here rather than at the cut-over.
5. Stages `/var/www/handco/releases/<commit>/` with the compose files, the production gateway template, `release.sh` and the release stamp. Nothing else: the image is the application. Runs as the deploy user, no sudo.
6. Runs `release.sh` as the deploy user, which does the switch below (only the proxy reload inside uses sudo).
7. Records `/up` latency again and prints the live release.

No registry and no upload, because the runner is already on the machine.

## How the zero downtime works

Docker Compose cannot republish a port that is already bound, so recreating a service in place means the old container stops before the new one is up. That is downtime. Instead:

1. `migrate` and `ProductionDatabaseSeeder` run on the new release first. Migrations here are additive, so the old release keeps serving against the newer schema.
2. The new stack starts beside the old one, under a different Compose project name, on the *other* of 8031/8032.
3. `release.sh` health checks the new gateway directly, on its own port. Nothing public depends on it yet.
4. `current` is repointed with `ln -sfn` onto a temp name and `mv -Tf`'d into place, then the host proxy is reloaded. That is the switch.
5. `release.sh` probes `/up` through `PUBLIC_URL`. If that fails it puts `current` back and exits.
6. Only then is the old stack stopped, with a drain timeout, and old releases pruned.

A failure at step 3 exits with the previous release still serving, so the failed stack is never reachable by a customer. A proxy reload failure at step 4 restores the symlink rather than leaving `current` and traffic disagreeing.

## Rollback

```bash
/var/www/handco/current/docker/scripts/release.sh \
  /var/www/handco/releases/<previous-commit>
```

That is the same script the deploy runs, so the rollback path is not a second implementation that can drift.

Each release directory holds its own merged `docker/env/app.env`, so a rollback puts the old code back on the settings it was verified with rather than on whatever `shared/app.env` says today.

Migrations are not rolled back automatically. This codebase's migrations only add tables and columns, so the previous release runs against the newer schema. Check before rolling back past a migration that changes or drops something.

## Rehearsing

Both the deploy script and the blue/green cut-over were rehearsed locally on 2026-10-06 against a scratch release tree and a scratch MySQL database: first deploy, a second deploy with the port alternating, a rollback, and a load test hammering the proxy through the cut-over. The GitHub Actions plumbing itself was not exercised against a live runner, since that needs a repository and a runner token.

The load test recorded **10 client timeouts out of 5842 requests (0.17%)**, all during the 45-second teardown window. nginx logged every one as **499 (client closed the connection)** and never logged a 502 or 503, which means the upstream was live throughout: the cut-over itself never pointed at a dead gateway.

### An unresolved stall you should know about

Those timeouts were **not** caused by the deploy, and the cause is still unknown. Intermittently, roughly one request in eight, `/up` takes about 3.1 seconds while the rest take 11ms. It is reproducible **at rest with no deploy running**, and on a later rehearsal it still reproduced with the host load average down to 0.92, which rules out CPU contention. An earlier note in this file blamed the host being saturated; that was wrong, and it is corrected here.

What has been ruled out:

| Ruled out | How |
|---|---|
| Config and route caching | cached both, no change |
| `pm.max_children` | 5 then 16, no change |
| The queue worker polling every second | stopped it, no change |
| opcache timestamp revalidation | `validate_timestamps=0`, no change |
| Docker port publishing | container IP is as slow as the published port |
| DNS for the `app` upstream | 20 lookups inside the gateway, all 0ms |
| TCP connect to php-fpm | 20 connects inside the gateway, all 0ms |
| Framework boot cost | a CLI boot is a stable 420ms with no outliers |
| Host CPU and memory | reproduced at load 0.92 with 2.8GB available |

What has **not** been ruled out, and is where to start:

- It only affects the FastCGI path. A static file from the same nginx returns in 3ms, and curl sees `time_connect=0.0002` with `time_starttransfer=3.08`, so the wait is between nginx accepting the connection and the response arriving.
- A php-fpm `slowlog` at `request_slowlog_timeout = 2s` produced **no** trace for the slow requests. That is the most informative result here: it suggests the delay may not be inside PHP at all, but in nginx's own handling of the upstream exchange.
- The obvious next step is nginx's own timing: log `$upstream_connect_time`, `$upstream_header_time` and `$upstream_response_time`. That splits "could not reach php-fpm" from "php-fpm did not answer". Instrumenting it here ran out of time because the rehearsal host became too slow for `docker exec` to return.

Do this on the real host before trusting any latency numbers from it, and treat a 3s `/up` as a production problem in its own right regardless of what a deploy does.

## On config caching

Laravel production advice is `config:cache` and `route:cache`, and this repo's sibling projects do it. The deploy here deliberately does not, because `config:cache` bakes environment variables into a file at the moment it runs, and the only correct moment is inside a started container. Measuring it during the rehearsal made no difference to the stall described above, so it is left out rather than added as a way to bake the wrong `DB_*` into a release. If you add it, run it inside the running app container after `up -d`, then `kill -USR2 1`.