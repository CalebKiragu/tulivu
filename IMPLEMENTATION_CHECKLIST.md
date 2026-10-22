# Implementation checklist

Status as of the final verification pass. Checked items are implemented and exercised locally; deferred items are explicit, not silently skipped.

## 1. Deployable application

- [x] One TypeScript monorepo with a Vite/React front end and Fastify API.
- [x] Same-origin `/api` in production; Vite proxy in development.
- [x] PostgreSQL through Drizzle ORM when `DATABASE_URL` is set.
- [x] Embedded PGlite fallback for local development and tests, using the same schema and migrations.
- [x] Generated SQL migration committed under `apps/web/drizzle`.
- [x] Automatic migrations at boot.
- [x] Production SPA static serving with client-route fallback.
- [x] `render.yaml` blueprint with a web service, PostgreSQL and generated session secret.
- [x] `.env.example` documenting every supported variable.
- [x] `.env` loading for local server processes (root and app directory, without overriding real env vars).
- [x] Graceful shutdown and startup validation for production secrets/providers.
- [x] Health endpoint at `/api/health`.

## 2. Bounded eight-stage workflow

- [x] Intake and requirements.
- [x] Marketing strategy.
- [x] Audience and market research.
- [x] Campaign and copy generation.
- [x] Creative production.
- [x] Conversion readiness.
- [x] Campaign assembly.
- [x] Independent quality review.
- [x] Per-stage status, attempt, latency, summary and error records.
- [x] One retry per failed stage.
- [x] Cancellation between stages.
- [x] Resume from the first incomplete stage.
- [x] Recovery of interrupted runs at boot.
- [x] Workflow events persisted with a sequence for SSE replay.
- [x] Audit events for run, stage, edit, approval, execution and settings actions.

## 3. Artifacts, versioning and approval

- [x] Eight artifact types: brief, strategy, audience, copy, creative, conversion, draft, quality.
- [x] Zod validation before persistence.
- [x] Immutable artifact history with per-type version numbers.
- [x] Full workflow run bumps the campaign version once and writes all artifacts at that version.
- [x] Manual artifact edit bumps the version, writes a new artifact version and requires a change note.
- [x] Brief edit after artifacts exist bumps the version and invalidates approval.
- [x] Quality artifact is read-only through the edit API.
- [x] Quality staleness detected after any non-quality artifact changes.
- [x] Quality-only re-review endpoint and UI action.
- [x] Approval bound to campaign version + SHA-256 operation hash.
- [x] Approval requires a fresh quality review and explicit warning acknowledgement.
- [x] Quality `fail` blocks approval.
- [x] Execution recomputes the hash and rejects changed packages.
- [x] Approval invalidation leaves history rather than deleting it.

## 4. Demo execution

- [x] Demo ad adapter creates deterministic `PAUSED` resources for Meta and Google.
- [x] Every execution result carries `simulated: true`.
- [x] Per-channel idempotency key: `publish_demo:<campaignId>:v<version>:<channel>`.
- [x] Duplicate launch returns `already_executed`.
- [x] Partial failure records successes and skips them on retry.
- [x] Campaign transitions through `approved`, `executing`, `published_demo` / `failed`.
- [x] No network calls to ad platforms in demo mode.
- [x] Live Meta/Google adapters are explicit `PlatformNotConfiguredError` stubs.
- [x] Exports and UI consistently label simulated resources.
- [x] No fabricated impressions, clicks, spend, conversions or ROAS.

## 5. Model and integration abstraction

- [x] Provider registry with `mock` and `openai-compatible` implementations.
- [x] Six task profiles: planning, copywriting, structured extraction, creative direction, quality review, fast utility.
- [x] Per-profile model environment variables.
- [x] Structured generation with JSON mode, schema validation and one corrective retry.
- [x] Timeouts, auth/rate-limit classification and token usage recording.
- [x] Mock model works with no credentials.
- [x] Mock image provider produces labelled SVG placeholders.
- [x] Optional OpenAI-compatible image provider.
- [x] Optional Tavily research provider; mock research is hypothesis-only.
- [x] Tool registry limited to research, image, URL checks and ad preview/publish.
- [x] SSRF-aware destination checks with DNS/private-range blocking, redirect revalidation and timeouts.
- [x] Syntax validity and reachability recorded as separate facts.
- [x] Versioned Meta/Google copy limits and deterministic validation.

## 6. API and security

- [x] Signed, HttpOnly, SameSite demo session cookie.
- [x] Isolated seeded workspace per browser session.
- [x] Owner scoping on every query; no client-supplied owner accepted.
- [x] Asset access checked by key and owner.
- [x] Global rate limiting.
- [x] 1 MiB body limit.
- [x] Zod request parsing with normalized error envelope.
- [x] Security headers (`nosniff`, referrer policy, frame deny, permissions policy).
- [x] SSE ownership check and replay via `since`.
- [x] Production `SESSION_SECRET` enforcement.
- [x] No provider secrets in public config.
- [x] Per-workspace demo reset; production-wide CLI reset requires explicit confirmation.
- [x] Documented that demo authentication is not production authentication.

## 7. User interface

- [x] Tulivu brand tokens: forest, leaf, gold, ivory, body, muted, border.
- [x] Lowercase `tulivu` wordmark with leaf/sprout mark.
- [x] Calm, premium, responsive layout using Fraunces + Manrope.
- [x] Public landing page.
- [x] App shell with navigation and mobile behaviour.
- [x] Overview dashboard.
- [x] Businesses list, create, edit and delete.
- [x] Campaigns list, create and update.
- [x] Campaign workspace with tabs: Strategy, Audience, Copy, Creative, Landing Page, Configuration, Quality, Approval.
- [x] Workflow rail with live stage state.
- [x] Run, cancel, resume, quality-only review, approve, simulate launch and export actions.
- [x] Artifact JSON editor with validation feedback and change note.
- [x] Quality checks, warnings, score and model critique/skip reason.
- [x] Approval gate with warning acknowledgement and version display.
- [x] Creative Studio gallery, filters and lightbox.
- [x] Activity feed.
- [x] Settings, provider information and workspace reset.
- [x] Not-found page.
- [x] SSE toasts and query invalidation.
- [x] Route-level code splitting so the main bundle stays below Vite's warning threshold.
- [x] Accessible focus states, semantic controls and aria labels on custom UI.
- [x] Empty, loading and error states on data pages.

## 8. Tests

- [x] Unit tests: shared utilities, brief validation, copy limits, SVG escaping, URL-check classification.
- [x] API tests: health/config, seeding, validation, business/campaign CRUD, settings, ownership isolation, demo reset.
- [x] Acceptance test: run all eight stages → quality → warning acknowledgement → approval → simulated launch → idempotent retry → Markdown/JSON export.
- [x] Acceptance test: artifact edit bumps version, invalidates quality/approval, rejects premature execution and quality editing, supports quality-only re-review and re-approval.
- [x] Tests run against in-memory PGlite with temp asset/data directories.
- [x] Full suite passes: **25/25 tests in 3 files**.

## 9. Documentation

- [x] `README.md` — overview, quick start, demo script, commands, API table, limitations.
- [x] `docs/architecture.md` — topology, stages, versioning, approval, execution, data model, failure/recovery.
- [x] `docs/security.md` — threat model, demo auth, headers, secrets, SSRF, prompt injection, approval integrity, hardening checklist.
- [x] `docs/provider-configuration.md` — mock/live providers, task profiles, images, research, adapters, env reference, cost.
- [x] `docs/deployment.md` — Render blueprint, generic hosting, migrations, TLS, SSE proxy notes, scaling, backups, checklist.
- [x] `docs/demo-limitations.md` — canonical honest-claims page and safe demo script.
- [x] `.env.example`.
- [x] `render.yaml`.
- [x] This checklist.

## 10. Verification performed

- [x] `pnpm -r typecheck` — all three workspace projects pass.
- [x] `pnpm test` — 25 tests pass.
- [x] `pnpm build` — production client builds; main chunk ~402 kB (122 kB gzip), no size warning.
- [x] Backend smoke flow: seeded workspace → eight stages → quality warning → approval → simulated launch → duplicate launch → export.
- [x] Production-style server serves API and SPA fallback.
- [x] Confirmed no live platform credentials or network publishing path is active by default.

## 11. Deliberately deferred (with rationale)

- [ ] **Real authentication and teams.** The demo uses isolated signed-cookie workspaces. Adding auth properly requires an identity provider, roles, invitations and a data model change; a fake login screen would be worse than an honest demo boundary.
- [ ] **Live Meta/Google publishing.** Adapters are stubs. Real publishing needs OAuth, sandbox validation, spend controls, policy review and reconciliation. Shipping a half-working live path would risk real spend and false claims.
- [ ] **Performance metrics.** There is nothing to measure because nothing is published. Fabricating numbers would violate the brief.
- [ ] **Durable job queue.** Workflows are in-process with stage-level recovery. A queue/worker split is the right next step for reliability but is unnecessary for a single-instance demo.
- [ ] **Object storage.** Binary images use local disk; SVG creatives also live in PostgreSQL. Durable images need a disk or object storage.
- [ ] **Horizontal scaling.** SSE and rate limiting are in-process. The deployment guide explains what to change.
- [ ] **Full CSP and CSRF tokens.** SameSite + JSON + no CORS is acceptable for the demo; a production auth model should add both.
- [ ] **Scheduled optimisation.** The workflow produces and launches a package; it does not monitor or optimise live campaigns.
- [ ] **Legal/policy review workflow.** Quality checks are not a substitute for legal review.
- [ ] **Persisting generated binary assets in Postgres.** Kept out to avoid bloating the database; local storage is explicit.

## 12. Product decisions worth flagging

1. **PGlite is a development fallback, not a production database.** It made the demo runnable without Docker or a local PostgreSQL service while keeping the real PostgreSQL path. Production uses `DATABASE_URL`.
2. **One version per package, not per artifact.** Artifacts have their own version counters, but approval and quality operate on the campaign package version. This is simpler to reason about and prevents approving a mix of revisions.
3. **Any manual edit invalidates quality and approval.** That is deliberately conservative. A quality-only re-review exists so the reviewer does not have to regenerate everything.
4. **Quality-only review may leave the draft at an older version.** The quality report warns about this (`version-coherence`) and execution still requires a matching approval hash. The alternative — silently regenerating the draft — would hide a changed configuration.
5. **Warnings require explicit acknowledgement.** The seeded fictional destination produces warnings, which makes the approval gate visible in the demo instead of pretending everything is perfect.
6. **The demo adapter is first-class.** A mock path that is treated as a second-class citizen tends to rot. Here it is the default, fully tested and clearly labelled.
7. **We do not claim "fully autonomous".** The agent is bounded by the eight-stage workflow, a human approval gate and a simulated execution layer.

## 13. Before showing it publicly

- [ ] Replace or clearly label the fictional seed business and domain.
- [ ] Confirm the deployment uses a strong `SESSION_SECRET`.
- [ ] Confirm `ADAPTER_MODE=demo`.
- [ ] Confirm no live provider keys have unlimited spend.
- [ ] Read `docs/demo-limitations.md` aloud once and remove any slide or sentence that contradicts it.
- [ ] Check the quality/approval flow on the deployed instance.
- [ ] Verify SSE works through the host/proxy.
- [ ] Verify exports contain the simulated-resource disclaimer.
