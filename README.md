# tulivu

Tulivu is a demo-first autonomous marketing agent for small businesses. It turns a campaign brief into a complete, reviewable package: strategy, audience hypotheses, channel copy, brand-aligned creative, conversion checks, a platform-neutral configuration, and an independent quality review.

The workflow stops at a human approval gate. Nothing is submitted to Meta or Google. "Launch" creates clearly labelled, paused **simulated** resources so the whole operating loop can be demonstrated without ad accounts, paid model keys, or performance claims.

> **Demo honesty:** this repository never publishes live ads and never fabricates performance data. The bundled business, website and campaign are fictional. Read [docs/demo-limitations.md](docs/demo-limitations.md) before showing this to anyone.

## What is included

- **One deployable TypeScript app** — Vite + React 19 front end, Fastify 5 API, same-origin `/api`, PostgreSQL through Drizzle ORM.
- **Eight bounded workflow stages** — intake, strategy, audience, copy, creative, conversion, assembly and quality. Each stage writes a versioned artifact and emits an event.
- **Human approval bound to an exact version** — the approval stores a SHA-256 hash of the campaign, brief, business and all artifacts except quality. Editing anything invalidates the review and approval.
- **Demo execution with idempotency** — each channel gets a deterministic paused resource; retries skip channels that already succeeded.
- **Recovery** — failed or cancelled runs can be resumed without regenerating completed stages. Interrupted runs are marked resumable at boot.
- **Independent quality re-review** — re-run quality only after a manual edit, without regenerating the package.
- **Audit trail and live events** — every mutation is recorded; campaign SSE streams stage progress to the browser.
- **Exports** — Markdown and JSON packages, both explicitly labelled as simulated.
- **Brand-led UI** — Overview, Businesses, Campaigns, Campaign detail workspace, Creative Studio, Activity and Settings, plus a public landing page.
- **Provider abstraction** — deterministic mock provider by default; optional OpenAI-compatible model, image and Tavily research adapters.
- **Tests** — unit, API integration and end-to-end acceptance suites (25 tests).

## Quick start

Requirements: **Node.js 20.19+** and **pnpm 10** (Corepack is easiest). A local PostgreSQL server is optional; without `DATABASE_URL`, Tulivu runs an embedded PGlite database that uses the same schema and migrations.

```bash
corepack enable
corepack prepare pnpm@10.18.0 --activate

git clone <your-repo-url> tulivu
cd tulivu
pnpm install
cp .env.example .env
pnpm dev
```

Open <http://localhost:5173>. The API runs on <http://localhost:8787>. Vite proxies `/api` to the server.

On the first request, each browser session receives its own isolated demo workspace containing the fictional Mkono Skincare business and a draft "Barrier Repair Launch — Nairobi" campaign.

### Try the full loop

1. Open **Campaigns → Barrier Repair Launch — Nairobi**.
2. Click **Run campaign agent** and watch the eight stages complete over SSE.
3. Review each tab — Strategy, Audience, Copy, Creative, Landing Page, Configuration, Quality.
4. The quality review normally returns `warn` because the seeded destination is intentionally fictional and unreachable. Acknowledge the warnings and approve the exact version.
5. Click **Simulate launch**. Two paused demo resources are recorded (Meta and Google). No real ad exists.
6. Run launch again to see the idempotent `already_executed` response.
7. Export the package as Markdown or JSON from the campaign header.
8. Edit an artifact in **Configuration** (JSON editor) and observe that quality and approval became stale. Re-run the quality-only review before re-approving.

## Common commands

Run from the repository root:

```bash
pnpm dev            # Fastify + Vite in watch mode
pnpm build          # production client build into apps/web/dist/client
pnpm start          # run the built app with Fastify serving the SPA
pnpm typecheck      # typecheck all workspaces
pnpm test           # unit + API + acceptance tests (PGlite in memory)
pnpm test:watch
pnpm db:generate    # generate a new Drizzle migration after schema changes
pnpm demo:reset     # destructive: delete all local demo workspaces
```

### Production-style local run

```bash
pnpm build
NODE_ENV=production SESSION_SECRET="$(openssl rand -hex 32)" pnpm start
```

Open <http://localhost:8787>. The server serves the built SPA and the API on the same origin.

## Configuration

All settings are environment variables. The complete documented list lives in [.env.example](.env.example). The defaults are deliberately free to run:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | unset → PGlite | PostgreSQL connection string. When present, `pg` and Drizzle migrations are used. |
| `SESSION_SECRET` | generated in development | Signs the demo session cookie. **Required** when `NODE_ENV=production`. |
| `MODEL_PROVIDER` | `mock` | `mock` or `openai-compatible`. |
| `MODEL_API_KEY` | unset | Required only for `openai-compatible`. |
| `MODEL_NAME` | `mock-tulivu-1` | Default model for every task profile. |
| `IMAGE_PROVIDER` | `mock` | `mock` (deterministic SVG) or `openai-compatible`. |
| `WEB_RESEARCH_PROVIDER` | `mock` | `mock` or `tavily`. |
| `ADAPTER_MODE` | `demo` | `demo` creates simulated resources. `live` currently throws `PlatformNotConfiguredError`. |
| `WORKFLOW_INLINE` | `false` (true in tests) | Run stages inside the request instead of in the background. |
| `DATA_DIR` | `./var` | PGlite data and local asset storage. |
| `RATE_LIMIT_MAX` | `120` | Requests per minute per client. |

Task profiles let one deployment map different jobs to different models:

```dotenv
MODEL_PLANNING=gpt-4.1
MODEL_COPYWRITING=gpt-4.1-mini
MODEL_STRUCTURED_EXTRACTION=gpt-4.1-mini
MODEL_CREATIVE_DIRECTION=gpt-4.1
MODEL_QUALITY_REVIEW=gpt-4.1
MODEL_FAST_UTILITY=gpt-4.1-mini
```

See [docs/provider-configuration.md](docs/provider-configuration.md) for adapter behaviour, costs and failure handling.

## Architecture at a glance

```
React SPA (Vite)
  │  same-origin /api, SSE
  ▼
Fastify API ── rate limit / signed demo session / ownership guards
  │
  ├── Workflow engine ── 8 stages ── provider registry (mock | OpenAI-compatible)
  │       │                │
  │       │                ├── tool registry (research, image, URL checks, ad preview/publish)
  │       │                └── platform adapters (demo | live stubs)
  │       ├── artifacts (versioned, Zod-validated)
  │       ├── approvals (version + operation hash)
  │       └── workflow events / audit trail
  │
  ├── Drizzle ORM ── PostgreSQL (production) or PGlite (local/test)
  └── Local asset storage for binary creatives
```

The package version is bumped at the start of every full workflow run. Manual artifact and brief edits bump it again and invalidate quality and approval. Approval is only valid for the exact version and exact content hash it reviewed.

More detail: [docs/architecture.md](docs/architecture.md). Security model: [docs/security.md](docs/security.md).

## API overview

All API routes are under `/api`. Authentication is the signed demo-session cookie; every query is scoped to the session owner.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness, mode and persistence |
| `GET` | `/config` | Public provider config, channels, objectives, platform specs |
| `GET` | `/overview` | Dashboard aggregates |
| `GET/POST` | `/businesses` | List and create businesses |
| `GET/PATCH` | `/businesses/:businessId` | Read and update a business |
| `GET/POST` | `/campaigns` | List and create campaigns |
| `GET/PATCH` | `/campaigns/:campaignId` | Detail and brief update |
| `POST` | `/campaigns/:campaignId/runs` | Start the eight-stage workflow |
| `POST` | `/campaigns/:campaignId/quality/revalidate` | Quality-only review |
| `POST` | `/campaigns/:campaignId/runs/:runId/cancel` | Cancel a running workflow |
| `POST` | `/campaigns/:campaignId/runs/:runId/resume` | Resume a failed/cancelled run |
| `PATCH` | `/campaigns/:campaignId/artifacts/:type` | Edit an artifact (quality is read-only) |
| `POST` | `/campaigns/:campaignId/approve` | Approve the exact current version |
| `POST` | `/campaigns/:campaignId/execute` | Create simulated paused resources |
| `GET` | `/campaigns/:campaignId/export?format=markdown\|json` | Download the package |
| `GET` | `/campaigns/:campaignId/events?since=<seq>` | SSE progress stream |
| `GET` | `/activity` | Audit feed |
| `GET` | `/assets`, `/assets/*` | Creative gallery and asset bytes |
| `GET/PATCH` | `/settings` | Workspace label and default currency |
| `POST` | `/demo/reset` | Reset this session's workspace |
| `GET` | `/platforms` | Adapter capabilities |
Errors use a stable envelope:

```json
{ "error": { "code": "quality_stale", "message": "…", "requestId": "…" } }
```

## Tests

```bash
pnpm test
```

- `apps/web/tests/unit.test.ts` — shared utilities, brief validation, copy limits, SVG escaping, URL-check classification.
- `apps/web/tests/api.test.ts` — health/config, seeding, validation, CRUD, settings, ownership isolation, reset.
- `apps/web/tests/acceptance.test.ts` — full run → quality → approval → simulated launch → idempotency → export, plus edit invalidation and quality-only re-review.

The test harness uses in-memory PGlite, temporary data directories, the mock provider, the demo adapter and inline workflow execution.

## Deployment

A Render blueprint is included in [render.yaml](render.yaml). It provisions a PostgreSQL database, a Node web service, a generated session secret, and the mock/demo defaults. Migrations run automatically on boot.

See [docs/deployment.md](docs/deployment.md). The short version:

- Build: `pnpm install --frozen-lockfile && pnpm build`
- Start: `pnpm start`
- Health check: `/api/health`
- Required: `SESSION_SECRET` (the blueprint generates one)
- Optional: `DATABASE_URL` for PostgreSQL; otherwise PGlite is used with an ephemeral filesystem

## Project layout

```
apps/web/
  server/          Fastify app, workflow engine, stages, services, adapters
  src/             React app, pages, campaign tabs, UI components
  tests/           Vitest unit, API and acceptance suites
  drizzle/         Generated SQL migrations
packages/shared/       Zod schemas, shared constants, formatting utilities
packages/ad-platforms/ Platform specs, copy validation, demo/live adapters
docs/                  Architecture, security, providers, deployment, limitations
```

## Known limitations

- **No real publishing.** Live Meta/Google adapters are explicit stubs. `ADAPTER_MODE=live` fails with a clear configuration error.
- **No performance data.** There are no impressions, clicks, spend or conversions to show, because nothing is published. The UI does not invent them.
- **Demo authentication.** A signed cookie isolates each browser session. There is no password, email verification, team, or admin role. Do not use this session model for real customer data.
- **Mock visuals are placeholders.** The default image provider draws deterministic SVG artwork labelled `MOCK VISUAL`.
- **Binary assets are stored on the local filesystem.** SVG creatives are also persisted as text in PostgreSQL. For durable AI-generated images, mount a disk or plug in object storage.
- **Foreground background jobs.** Workflow jobs run in the API process. A restart is recoverable at the stage boundary, but this is not a durable job queue and does not scale horizontally.
- **Single-instance rate limiting and SSE.** Both are in-process; a multi-instance deployment would need shared infrastructure.
- **Platform copy limits are planning guidance.** They are versioned in code and should be rechecked against current official documentation before any live integration.

These are intentional boundaries for a credible demo, not hidden shortcuts. See [docs/demo-limitations.md](docs/demo-limitations.md) for the full list.

## License

No license has been declared yet. Treat this repository as proprietary until one is added.
