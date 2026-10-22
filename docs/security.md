# Security and safety model

This document describes what Tulivu protects, how it does so, and where the demo model deliberately stops. It is not a production security certification.

## Threat model

Tulivu handles campaign briefs, brand details, generated copy, destinations and creative assets. The demo is exposed publicly, so the relevant risks are:

1. One visitor reading or modifying another visitor's workspace.
2. Server-side request forgery through destination checks or model-supplied URLs.
3. Prompt injection causing unsafe copy or unintended tool use.
4. Fabricated claims, testimonials or performance data being presented as real.
5. Accidental live ad spend or live platform calls.
6. Secret leakage through logs, exports or the browser.
7. Abuse of the public API (rate, payload size, disk use).

## Authentication and workspace isolation

- Each browser receives a signed, HttpOnly session cookie (`tulivu_session`) via `@fastify/secure-session`.
- On first API request, the server creates a random owner ID and a private seeded workspace.
- Every business, campaign, artifact, asset, run, event, approval, operation and audit query is scoped by `request.ownerId`.
- The API never accepts an owner ID from the client.
- Asset bytes are looked up by key **and** owner, so guessing another key returns 404.
- Deleting a user cascades to its workspace rows.

### What this is not

This is **not authentication**. There is no password, email verification, MFA, account recovery, team membership, role model or admin. Anyone who obtains a session cookie has the workspace. Clearing cookies creates a new workspace. It is suitable only for a public demo with fictional data.

For a real deployment, add an identity provider, server-side sessions or short-lived tokens, organisation/team roles, audit attribution to real users, and a data retention policy. Do not put customer or personal data into this demo.

## Transport and headers

- `HttpOnly`, `SameSite=Lax`, `Path=/` cookies; `Secure` in production.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Asset responses add a restrictive `Content-Security-Policy` and `Content-Disposition: inline`.
- Request bodies are capped at 1 MiB.
- Rate limiting is global at 120 requests/minute per client; tests raise it temporarily.
- Same-origin API, no permissive CORS. State-changing routes use JSON bodies; `SameSite=Lax` plus the JSON content type materially reduces classic CSRF. There is no CSRF token, which is acceptable for a demo but should be revisited for real accounts.

A full Content-Security-Policy for the SPA is not set because the app uses inline styles and the Vite development server. Add and test one before treating the app as hardened.

## Secrets

- `SESSION_SECRET` is required in production; startup fails without it. A development fallback exists only for convenience.
- `MODEL_API_KEY`, `IMAGE_API_KEY` and `TAVILY_API_KEY` stay server-side and are never included in `publicConfig`.
- `GET /api/config` exposes only provider names, task model IDs, mode, persistence kind and demo-safe flags.
- Logs are Fastify structured logs; provider error messages may include an HTTP status and a truncated response body. Do not enable verbose request-body logging with secrets.
- Exports include campaign content but no secrets.

Generate a session secret with:

```bash
openssl rand -hex 32
```

Rotate it by changing the value and restarting; all demo sessions will be reset.

## Server-side request forgery

Destination checks are the only place the server fetches a user-supplied URL. The implementation in `server/services/url-check.ts`:

1. Parses the URL and allows only `http:`/`https:`.
2. Rejects embedded credentials.
3. Blocks `localhost`, `.local`, `.internal`, metadata hostnames and IP literals in private, loopback, link-local, CGNAT, multicast and reserved ranges.
4. Resolves DNS and rejects hostnames that map to private or link-local addresses.
5. Fetches with `redirect: "manual"`, revalidating every redirect target (max 3).
6. Uses a 6-second timeout and does not analyse or store response bodies.
7. Treats unreachable URLs as unverified (`reachable: null` or `false`), not automatically malicious.

Residual risk: DNS rebinding between resolution and fetch is not fully eliminated. A production system should pin the validated IP or use an egress proxy with network-level deny rules. The demo also does not fetch arbitrary URLs from model output except through the conversion stage.

## Prompt injection and model safety

- User text is passed as campaign context, not as system instructions. System prompts define the task and schema.
- Structured outputs are validated by Zod. The OpenAI-compatible adapter retries once with a corrective message, then fails the stage.
- Platform copy validation is deterministic and runs after generation, independent of the model.
- The quality review runs deterministic claim, testimonial, audience, budget, destination and asset checks. Model critique is optional and additive.
- Tools are a fixed registry (research, image generation, URL check, ad preview/publish). There is no shell, filesystem browser, arbitrary HTTP fetch or code execution tool.
- With a live model, prompt injection can still produce policy-violating copy. Do not treat generation as a safety boundary; keep the human approval gate and review warnings.

## Claims and honesty controls

- Banned claims from the brand profile are checked against the generated copy.
- Guarantee-style language (`guarantee`, `100%`, `clinically proven`, `cures acne/eczema`) produces at least a warning.
- Customer-proof language without supplied testimonials fails the review.
- The UI, export, SSE notes and seed data repeatedly label simulated resources.
- No impressions, clicks, spend, conversions, ROAS or audience-size numbers are generated or displayed, because none exist.
- Live ad adapters throw a configuration error rather than pretending to publish.
- The mock image provider draws a visible `MOCK VISUAL` label.

## Approval integrity

- Approval is bound to the campaign version and a SHA-256 hash over the brief, campaign record, business and non-quality artifacts.
- Quality staleness is timestamp-based: editing any non-quality artifact after the review makes quality stale.
- The quality artifact is read-only through the edit API.
- Execution recomputes the hash and invalidates approval if it differs.
- Warnings require explicit acknowledgement; a `fail` verdict blocks approval.
- A demo operation is idempotent per campaign version and channel.

These controls reduce accidental divergence; they do not make the demo a financial control system. Real ad approval would need separation of duties, spend limits, platform-side change history and possibly dual approval.

## Denial-of-service and resource limits

- 1 MiB JSON body limit.
- 120 requests/minute per client by default.
- Workflow runs are guarded so a campaign cannot have two active runs.
- Stage retries are capped at two attempts.
- URL checks have timeouts, redirect limits and body cancellation.
- Image and model calls have configurable timeouts.
- Exports read existing artifacts; they do not call providers.

Residual risk: public users can still create workspaces and consume disk/CPU. For a public demo, add IP/account quotas, scheduled cleanup of old workspaces, and a size cap on generated images. The reset endpoint is scoped to the current workspace only.

## Logging and auditing

- `audit_events` records actor, campaign, run, event type, metadata and timestamp.
- Workflow events provide a replayable sequence for SSE.
- Fastify logs avoid request bodies by default.
- Provider errors are truncated before storage in stage errors.
- Audit metadata is intentionally descriptive, for example "Demo execution. No real advertising account is contacted."

## Production hardening checklist

If this demo becomes a real product:

- [ ] Replace demo sessions with real authentication and organisation roles.
- [ ] Encrypt sensitive fields at rest and define retention/deletion.
- [ ] Add CSRF tokens or a strict same-origin policy with a full CSP.
- [ ] Add per-account quotas and workspace cleanup.
- [ ] Move workflows to a durable queue with workers and leases.
- [ ] Use shared rate limiting and SSE pub/sub for multiple instances.
- [ ] Store images in object storage with malware scanning and content limits.
- [ ] Add an egress proxy and DNS pinning for URL checks.
- [ ] Implement real platform OAuth/credentials, least-privilege tokens, spend caps and dual approval.
- [ ] Add dependency scanning, secret scanning, SAST and a disclosure policy.
- [ ] Have legal review ad claims, consent, data processing and platform policy compliance.

## Reporting a problem

Do not open a public issue containing a secret, session cookie or customer data. Report privately to the repository owner once a security contact is published.
