# Deployment

Tulivu has two supported deployment shapes:

1. **Render blueprint** — one web service and one PostgreSQL database. Recommended for the demo.
2. **Any Node host** — build the client, run the server with a PostgreSQL `DATABASE_URL`.

Without `DATABASE_URL`, the server falls back to PGlite. That is useful for local previews but not suitable for a durable public deployment.

## Render (recommended)

The repository includes [`render.yaml`](../render.yaml).

### What the blueprint creates

- A PostgreSQL database named `tulivu-db`.
- A Node web service named `tulivu`.
- A generated `SESSION_SECRET`.
- `DATABASE_URL` wired from the database.
- Mock model, mock image, mock research and demo ad adapter defaults.
- Health check at `/api/health`.
- `PUBLIC_BASE_URL` wired from Render's `RENDER_EXTERNAL_URL`.
- Build: `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm build`.
- Start: `pnpm start`.

`--prod=false` matters because `NODE_ENV=production` is set for the service and
pnpm otherwise omits dev dependencies such as Vite and TypeScript during the
build. The flag applies only to the build; runtime dependencies are unchanged.

### Steps

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Render, choose **New → Blueprint** and select the repository, or open
   <https://render.com/deploy?repo=https://github.com/CalebKiragu/tulivu>.
3. Review the resources. The blueprint uses free plans for a demo; change them if you need always-on service and durable databases.
4. Apply. The first deploy installs dependencies, builds the SPA, starts Fastify and runs Drizzle migrations against PostgreSQL.
5. Open the service URL. The first visit seeds that browser session's private workspace.

No user-supplied secrets are required for the demo. Render generates
`SESSION_SECRET` and injects `DATABASE_URL`. Do **not** add model, image or
research API keys unless you deliberately switch the corresponding provider
from `mock`; the default deployment makes no paid API calls.

### Free-plan caveats

- Free web services sleep after 15 minutes of inactivity; the first request after sleep takes about a minute.
- **Free PostgreSQL databases expire 30 days after creation** (with a 14-day upgrade grace period). For a durable public demo, change the database `plan` to a paid plan before or during that window.
- Only one free PostgreSQL database is allowed per workspace.
- The filesystem is ephemeral. SVG creatives are stored as text in PostgreSQL, so the seeded demo survives restarts. **Binary images do not.**
- No persistent disk is attached by default.

### Durable binary assets

If `IMAGE_PROVIDER=openai-compatible` and you want generated PNGs to survive a deploy:

1. Add a Render disk mounted at `/var/tulivu`.
2. Change `DATA_DIR` from `/tmp/tulivu` to `/var/tulivu`.
3. `ASSETS_DIR` defaults to `/var/tulivu/assets`.
4. Redeploy.

A disk pins the service to a single instance. For multi-instance deployments, implement the `AssetStorage` interface against object storage (S3, R2, GCS) instead.

### Custom domain and cookies

- Set the service's custom domain in Render.
- Cookies are `Secure` because `NODE_ENV=production`.
- `PUBLIC_BASE_URL` is reserved for future absolute links and is not required today.
- If you place the app behind a proxy, keep forwarded headers enabled. Fastify is configured with `trustProxy: true`.

## Generic Node host

Requirements:

- Node.js 20.19+ (22 LTS recommended).
- pnpm 10 (Corepack).
- PostgreSQL 14+.
- A writable directory for `DATA_DIR` if image generation or PGlite is used.

Commands:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production \
SESSION_SECRET="$(openssl rand -hex 32)" \
DATABASE_URL="postgres://user:pass@host:5432/tulivu" \
pnpm start
```

The server:

- Runs migrations from `apps/web/drizzle` at boot.
- Serves the built SPA from `apps/web/dist/client`.
- Falls back to `index.html` for client-side routes.
- Listens on `PORT` (default `8787`) and `HOST` (default `0.0.0.0`).
- Handles `SIGINT`/`SIGTERM` by closing Fastify and the database pool.

### PostgreSQL TLS

Managed providers reached over the public internet often require TLS:

```dotenv
PGSSL=true
```

The pool then uses `ssl: { rejectUnauthorized: false }`. If your provider supplies a CA certificate, tightening this is recommended. Internal private networking usually does not require `PGSSL`.

### Migrations

- Migrations are generated with `pnpm db:generate` after changing `server/db/schema.ts`.
- They are applied automatically at startup with Drizzle's migrator.
- Keep migration files in version control.
- For zero-downtime production changes, apply migrations as a separate release step and make them backward-compatible. Automatic boot migrations are acceptable for this demo.

### Reverse proxy checklist

- Forward `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`.
- Disable response buffering for `/api/campaigns/*/events` (SSE). The server already sends `X-Accel-Buffering: no`, but some proxies need explicit configuration.
- Allow long-lived connections for SSE.
- Set a reasonable request body limit at the proxy (the app also enforces 1 MiB).
- Terminate TLS at the proxy and keep `NODE_ENV=production` so cookies are `Secure`.

## Environment

| Variable | Production requirement |
| --- | --- |
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | **Required.** At least 32 random characters. Startup fails without it. |
| `DATABASE_URL` | Strongly recommended. Without it the app uses PGlite on local disk. |
| `PGSSL` | `true` only if the database requires TLS |
| `PORT` | Usually injected by the platform |
| `ADAPTER_MODE` | Keep `demo`; live adapters are stubs |
| `MODEL_PROVIDER` | `mock` or `openai-compatible` |
| `MODEL_API_KEY` | Required when `MODEL_PROVIDER=openai-compatible` |
| `IMAGE_PROVIDER` | `mock` or `openai-compatible` |
| `WEB_RESEARCH_PROVIDER` | `mock` or `tavily` |
| `DATA_DIR` | Writable path if assets/images are used |
| `RATE_LIMIT_MAX` | Tune for expected traffic |

See [`.env.example`](../.env.example) and [provider-configuration.md](provider-configuration.md).

## Health and observability

`GET /api/health` returns:

```json
{
  "ok": true,
  "service": "tulivu",
  "mode": "demo",
  "persistence": "postgres",
  "time": "2026-10-22T12:00:00.000Z"
}
```

Point the platform health check here. Logs are structured JSON from Fastify (level `warn` in production). The app deliberately avoids logging request bodies.

There is no metrics endpoint or external error tracker. Add one before operating a real service.

## Scaling and availability

The current process model is intentionally simple:

- Workflow jobs run inside the web process (`WORKFLOW_INLINE=false` still uses in-process background work).
- SSE clients are held by the instance that served the request.
- Rate limiting is in-memory.
- PGlite cannot be shared across instances at all.

Therefore run **one instance** with PostgreSQL for a demo. To scale horizontally:

1. Move workflows to a durable queue with worker leases and idempotent stage writes.
2. Move SSE fan-out to Postgres `LISTEN/NOTIFY`, Redis pub/sub or a managed stream.
3. Use a shared rate-limit store.
4. Move assets to object storage.
5. Ensure migrations run once per release, not concurrently on every instance.

## Backup and reset

- Back up PostgreSQL using the provider's snapshots.
- `pnpm demo:reset` deletes **all** local workspaces. In production it refuses unless `RESET_CONFIRM="delete demo workspaces"` is set. Prefer the per-workspace reset in Settings for demos.
- Resetting a workspace cascades to businesses, campaigns, artifacts, runs, approvals, operations, assets and audit events.
- Session secret rotation invalidates all demo sessions; old workspaces remain in the database until cleaned up.

## Production safety checklist

- [ ] `SESSION_SECRET` is strong, secret and not in source control.
- [ ] `NODE_ENV=production`.
- [ ] `DATABASE_URL` points at a backed-up PostgreSQL instance.
- [ ] `ADAPTER_MODE=demo` until a real adapter is implemented and reviewed.
- [ ] No live model/image/research keys are exposed to the browser.
- [ ] Provider keys have budgets and least privilege.
- [ ] The deployment is a **single instance** unless the scaling work above is done.
- [ ] A cleanup policy exists for old demo workspaces.
- [ ] The demo's authentication and data limitations are understood by everyone with access.
- [ ] Assets are on a disk or object storage if binary images matter.
- [ ] SSE works through the chosen proxy.
- [ ] The health check and logs are monitored.
