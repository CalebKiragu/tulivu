# Demo limitations and honest claims

Tulivu is built to demonstrate an operating loop, not to imply that real advertising has happened. This page is the canonical list of what is simulated, what is incomplete, and what must not be claimed.

## The one-sentence version

Tulivu demonstrates a bounded marketing agent that produces a versioned, quality-reviewed campaign package and stops for human approval. "Launch" creates clearly labelled **simulated, paused** resources; it does not contact Meta or Google, spend money, or produce performance data.

## What is real

- The eight-stage workflow, retries, cancellation, resume and SSE progress.
- Versioned artifacts validated with Zod.
- Independent deterministic quality checks.
- Approval bound to an exact campaign version and content hash.
- Audit trail, exports, demo workspace isolation and reset.
- Platform copy-limit validation against versioned specs in code.
- SSRF-aware destination checks.
- The React UI, API, database schema and deployment path.
- Optional live model/image/research calls when explicitly configured — these produce real model output, but still no real ad publishing.

## What is simulated

| Area | Reality |
| --- | --- |
| Ad publishing | `DemoAdPlatformAdapter` creates local `PAUSED` records with IDs like `demo-meta-...`. No HTTP request is made to Meta or Google. |
| Ad performance | There are no impressions, clicks, CTR, CPC, spend, conversions, ROAS or audience sizes. The UI never shows them. |
| Ad accounts | No OAuth, business manager, ad account, pixel, conversion API or billing connection exists. |
| Creatives | The default images are deterministic SVG placeholders labelled `MOCK VISUAL`. |
| Research | Default research is empty/mock and audience output is labelled hypothesis-based. |
| Seed business | **Mkono Skincare, its website, address, products, prices and campaign are fictional.** The domain `mkonoskincare.co.ke` and the seeded product URL are not real destinations. |
| Seed destination checks | Because the destination is fictional/unreachable, the quality review normally warns. This is intentional and is not proof that a real customer site is down. |
| Model critique | In mock mode there is no independent model review; the quality artifact states this. |

## What is deliberately not implemented

- Live Meta or Google campaign creation.
- Live ad account authentication.
- Real budgets, billing or spend controls.
- Scheduled publishing, pausing or optimisation.
- Conversion tracking installation.
- Performance reporting or attribution.
- Image editing, video generation or asset approval workflows.
- Multi-user teams, roles, comments or reviewer assignment.
- Real authentication, SSO, password reset or account recovery.
- Durable job queue, worker fleet or horizontal SSE fan-out.
- Object storage for binary assets.
- A legal claims-review workflow.

## Authentication warning

Each browser session gets a private workspace through a signed cookie. There is no login. This is adequate for a public demo with fictional data and **not adequate for customer data, confidential briefs or anything with financial consequences**. Do not describe it as secure multi-tenant authentication.

## "Autonomous" is bounded

The agent autonomously executes the eight generation and review stages inside a fixed workflow. It does **not**:

- choose to spend money,
- contact ad platforms,
- publish without approval,
- invent a missing destination URL,
- override a failed quality verdict,
- silently retry forever,
- or operate without a human gate.

Calling it "fully autonomous advertising" would be inaccurate. It is a bounded agent with a human approval gate and a simulated execution layer.

## Quality verdicts are not guarantees

The quality stage checks required artifacts, platform limits, banned claims, fabricated proof, brand voice, CTA consistency, destination status, budget/schedule coherence, sensitive targeting, creative availability, prior submission and version coherence. It is useful, deterministic and inspectable — but it is not legal review, medical review, platform policy review or a guarantee of ad approval. A `pass` is not permission to make a regulated claim.

The seeded campaign intentionally produces warnings because its destination is fictional. Warnings must be acknowledged before approval; failures block approval.

## No fabricated numbers policy

If you extend the UI or exports:

- Never invent performance metrics, audience sizes, competitor spend or expected ROAS.
- Never present mock creatives as final brand assets.
- Never label a simulated resource as live.
- Never claim a real platform integration exists while the adapter is a stub.
- Keep the "simulated" and "no real ads" language in exports and execution results.

## Safe demo script

1. State up front: "This is a demo with a fictional brand and simulated ad resources."
2. Show the brief and the eight-stage run.
3. Open the Quality tab and point out the warning caused by the fictional destination.
4. Approve with warnings acknowledged.
5. Simulate launch; show the paused demo IDs and the `simulated: true` field.
6. Run launch again and show idempotency.
7. Edit an artifact, show quality/approval invalidation, then re-run quality only.
8. Export the Markdown/JSON package and show the disclaimer.
9. Close by naming the limitations above, especially authentication and the absence of performance data.

## If you need a real pilot

The shortest credible path is:

1. Replace demo auth with a real identity provider.
2. Add durable workflows and object storage.
3. Implement one platform adapter against its sandbox with least-privilege credentials and hard spend caps.
4. Add explicit human confirmation of budget and account.
5. Keep the approval hash and audit trail, and add platform-side reconciliation.
6. Add legal/policy review and a data retention policy.
7. Only then describe the product as connected to a live ad platform.
