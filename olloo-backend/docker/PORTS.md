# Ports

HandCO binds loopback only. Nothing here is reachable from the internet; the host reverse proxy is the public entry point.

| Port | Service | Notes |
|---|---|---|
| 8030 | dev gateway (`compose.dev.yaml`) | `http://localhost:8030` |
| 8031 | production gateway, slot A | the port a release runs on when the live release is not on it |
| 8032 | production gateway, slot B | alternated by `release.sh` for the blue/green switch |
| 8039 | host Apache internal API listener | `/api/` only, for the storefront SSR server (`docs/DEPLOYING.md` 3b) |
| 8041 | storefront SSR server (`handco-ssr`) | host network, loopback; Apache sends `/products/*` here |
| 8042 | storefront SSR candidate | the storefront deploy's smoke test, stopped after it |
| 5174 | Vite dev server | dev only, HMR |
| 8026 | mail catcher UI | dev only, `--profile mail` |
| 1026 | mail catcher SMTP | dev only, `--profile mail` |

`app`, `queue` and `scheduler` are never published. They talk to each other over the `handco` network, which is project-scoped: blue and green each get their own, so a release only ever reaches its own php-fpm. (`storage_data` is the opposite on purpose: one explicitly named volume shared by every release, so uploads survive a rollback.)

MySQL is on the host and reached over `host.docker.internal`, which resolves to the Docker bridge address. 3306 is not published by Compose and must not be.

## Choosing a different range

8031 and 8032 must be free on the host, and must not collide with another stack's published ports. Override them in the environment when running `release.sh`:

```bash
PRIMARY_PORT=9031 SECONDARY_PORT=9032 sudo \
  /var/www/handco/current/docker/scripts/release.sh /var/www/handco/releases/<commit>
```

Or set `GATEWAY_PORT` in the release's env before bringing the stack up.

## Finding a conflict

```bash
ss -ltnp | grep -E ':(8030|8031|8032)\b'
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E '80(30|31|32)'
```

An `Bind for 127.0.0.1:8031 failed: port is already allocated` error at `up -d` means exactly this.