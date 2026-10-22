# Architecture

Tulivu is a single deployable Node application with a React client, a Fastify API and a PostgreSQL-compatible database. The design optimises for a **credible, inspectable demo**: every decision leaves an artifact, an event or an audit record, and the risky action is behind a human gate.

## Runtime topology

```
┌────────────────────────────────────────────────────────────────────┐
│ Browser                                                            │
│  React 19 · React Router · React Query · EventSource               │
│  /api/* same origin · SSE /campaigns/:id/events                    │
└───────────────────────────────┬────────────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────────────┐
│ Fastify 5 (apps/web/server)                                       │
│  secure demo session · rate limit · security headers · Zod parsing │
│  ownership-scoped REST routes · SSE · SPA fallback                 │
│                                                                    │
│  ┌─────────────────────┐   ┌───────────────────────────────────┐   │
│  │ Workflow engine     │   │ Services                          │   │
│  │ 8 stages, retry,    │   │ campaigns · approval · execution  │   │
│  │ cancel, resume, SSE │   │ audit · export · assets · URL check│  │
│  └─────────┬───────────┘   └───────────────────────────────────┘   │
│            │                                                       │
│  ┌─────────▼───────────┐   ┌───────────────────────────────────┐   │
│  │ Provider registry   │   │ Tool registry                      │   │
│  │ mock | OpenAI-compat│   │ research · image · URL · ads       │   │
│  └─────────────────────┘   └───────────────┬───────────────────┘   │
│                                            │                       │
│  ┌─────────────────────────────────────────▼───────────────────┐   │
│  │ Adapters: DemoAdPlatformAdapter | live stubs                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────┬───────────────────────────────┬────────────────────┘
                │                               │
      ┌─────────▼──────────┐          ┌─────────▼──────────┐
      │ PostgreSQL (pg)    │          │ Local asset storage│
      │ or PGlite (dev)    │          │ binary creatives   │
      │ Drizzle migrations │          │ (SVG also in DB)   │
      └────────────────────┘          └────────────────────┘
```

### Why PGlite and PostgreSQL both exist

- Production and any environment with `DATABASE_URL` use `pg` + `drizzle-orm/node-postgres`.
- Local development and tests without PostgreSQL use `@electric-sql/pglite` with the **same Drizzle schema and the same SQL migrations**.
- This keeps the demo runnable on a laptop with no Docker daemon or database service, while preserving a real PostgreSQL deployment path.
- PGlite is single-process and not intended for horizontal scaling. It is a development convenience, not a production database.

## The eight-stage workflow

Defined once in `packages/shared/src/constants.ts`, executed by `apps/web/server/workflow/stages.ts`.

| # | Stage | Writes | What it does |
| --- | --- | --- | --- |
| 1 | `intake` | `brief` | Normalises the brief, records gaps and safe assumptions. Never invents a missing destination. |
| 2 | `strategy` | `strategy` | Positioning, value proposition, key messages, primary CTA and success metric. |
| 3 | `audience` | `audience` | Segments, needs, objections, keyword themes. Mock mode labels everything as hypothesis. |
| 4 | `copy` | `copy` | Channel-specific variants validated against versioned platform specs. |
| 5 | `creative` | `creative` | Deterministic SVG templates and copy-only variants; optional configured image provider. |
| 6 | `conversion` | `conversion` | SSRF-aware destination check, UTM suggestions and conversion readiness. |
| 7 | `assembly` | `draft` | Platform-neutral configuration plus adapter previews. |
| 8 | `quality` | `quality` | Deterministic checks; optional independent model critique. Produces `pass`, `warn` or `fail` with a score. |

Every stage:

1. Loads the latest artifacts and campaign/business context.
2. Calls the provider for its task profile.
3. Validates the result with Zod.
4. Saves a new artifact version with metadata.
5. Emits `stage.started`, `stage.completed` or `stage.failed` events and writes an audit record.

The engine retries a failed stage once, then marks the run failed. Completed stages are not repeated on resume. Cancellation is cooperative: the current tool call finishes, then the run stops.

### Version semantics

- A **full workflow run** increments `campaigns.currentVersion` once before the stages start. All artifacts in that run belong to that version.
- A **manual artifact edit** increments the version again, writes a new artifact version and invalidates quality and approval.
- A **brief edit** after artifacts exist increments the version and invalidates approval.
- A **quality-only run** does not increment the version. It reviews the current artifacts and records a fresh quality artifact at that version.
- The quality check `version-coherence` warns when the assembled draft predates the current version, for example after a strategy-only edit and quality-only re-review.

### Approval

`approvals` stores:

- the campaign version,
- the operation type (`publish_demo`),
- a SHA-256 **operation hash** over the campaign record, brief, business and every non-quality artifact,
- the approver display name, status and note.

Approval fails if the version differs, quality is missing/stale/failed, warnings are unacknowledged, or the campaign is busy. Execution recomputes the hash and refuses to proceed if anything changed after approval. Editing an artifact or the brief invalidates active approvals immediately.

### Demo execution

`executeCampaign`:

1. Verifies the campaign version and active approval hash.
2. Requires a draft and at least one channel.
3. Computes a per-channel idempotency key: `publish_demo:<campaignId>:v<version>:<channel>`.
4. Returns `already_executed` when every channel already succeeded.
5. Creates or reuses an `external_operations` row, then calls the demo adapter.
6. Records `PAUSED` resources with `simulated: true`, updates campaign status to `published_demo`, and writes audit events.

A partial failure records successful channels; retrying skips them. The demo adapter performs no network calls. Live adapters throw `PlatformNotConfiguredError` by design.

### Quality re-review

`POST /campaigns/:id/quality/revalidate` creates a workflow run containing only the quality stage. This supports the real review loop: edit an artifact, re-run quality without paying to regenerate strategy and copy, then re-approve. The quality artifact itself is read-only through the edit API so the verdict cannot be hand-edited.

## Data model

| Table | Purpose |
| --- | --- |
| `users` | Demo owner. One per signed browser session. |
| `user_settings` | Workspace label and default currency. |
| `businesses` | Brand facts, target customers and brand profile (voice, tone, colours, banned claims, CTAs). |
| `campaigns` | Brief, channels, budget, status and `current_version`. |
| `workflow_runs` | One workflow execution, provider/model, token usage and error summary. |
| `workflow_stage_runs` | Per-stage status, attempts, latency and output summary. |
| `workflow_events` | Monotonic sequence per campaign; drives SSE and replay via `since`. |
| `artifacts` | Immutable content versions keyed by campaign + type + version. |
| `assets` | Creative gallery metadata, dimensions, provider and storage key. |
| `approvals` | Version-bound approval and operation hash. |
| `external_operations` | Simulated (or future live) per-channel operation with idempotency key. |
| `audit_events` | Human-readable trail of every meaningful action. |

All owner-bearing tables reference `users.id` with cascade delete, so resetting a demo workspace removes its data. Routes always scope queries by the session `ownerId`; the API never trusts a client-supplied owner.

## Provider abstraction

`server/providers/types.ts` defines text and structured generation. `createProviderRegistry(config)` selects:

- **Mock** — deterministic templates and canned structured outputs. No network, no key, no cost. Used by default and by tests.
- **OpenAI-compatible** — `/chat/completions` with JSON mode and a corrective retry when validation fails. Suitable for OpenAI, Azure-compatible gateways, OpenRouter, local servers and similar APIs.

Each stage requests a **task profile** (`planning`, `copywriting`, `structured_extraction`, `creative_direction`, `quality_review`, `fast_utility`). A deployment can map profiles to different model IDs without changing stage code.

Image generation follows the same pattern: deterministic SVG mock, or an OpenAI-compatible `/images/generations` adapter. Generated binary assets go through `AssetStorage`; local filesystem is the only implementation today.

Research is a tool, not a provider: mock returns hypothesis-only guidance; Tavily can supply live search results when configured. Even with live research, the audience artifact records its evidence mode so the UI never implies customer data exists when it does not.

## URL and SSRF handling

Destination checks are intentionally split into two facts:

- **Syntax validity** — is this a well-formed `http(s)` URL without credentials?
- **Reachability** — can the server fetch it without touching private networks?

DNS is resolved first and private/loopback/link-local/metadata addresses are rejected. Redirects are followed manually (max 3) and revalidated. A valid URL that cannot be resolved is `syntaxValid: true, reachable: null`, producing a warning rather than a hard failure. Timeouts and 5xx responses are not treated as proof that a real page is down.

## Front end

- React Router route tree with lazy-loaded pages (`React.lazy` + `Suspense`) to keep the initial bundle small.
- React Query owns server state, mutations and invalidation. Campaign events stream over SSE; each event invalidates the relevant query and shows a toast.
- Campaign detail has eight tabs aligned to the review workflow: Strategy, Audience, Copy, Creative, Landing Page, Configuration, Quality, Approval.
- Artifact editing uses a validated JSON editor with a required change note. The server re-validates the artifact and recomputes copy/platform validation where applicable.
- The design tokens live in `src/index.css`: forest `#173D35`, leaf `#244D40`, gold `#D9C58D`, ivory `#F5F1E7`, body `#24352E`, muted `#6B776F`, border `#E5E0D5`.

## Failure and recovery

- A failed stage is retried once, then the run and campaign are marked failed with an error summary.
- `resume` keeps completed stage rows and starts from the first incomplete stage.
- `cancel` marks the run and running stage cancelled; completed artifacts stay.
- On boot, `recoverInterruptedRuns` marks runs left in `running` as failed so they can be resumed. This is recovery at a stage boundary, not exactly-once execution.
- Execution is idempotent per channel using the deterministic key; that is what makes safe retries possible without a job queue.

## Deliberate boundaries

This architecture is sized for a demo and a small pilot:

- Workflows run in the API process. A crash loses in-flight work, though the stage rows make it resumable.
- SSE and rate limiting are in-process, so multiple instances would need sticky sessions or shared pub/sub.
- Assets are local files. SVG creatives are also stored in PostgreSQL; binary images need a mounted disk or object storage for durability.
- Demo sessions are not real authentication.
- Live ad platform adapters are stubs, and no code claims otherwise.
