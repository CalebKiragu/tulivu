# Porting Nuru-Wellness features into Tulivu

This plan tracks the merge of Nuru's booking/client management/storefront into Tulivu (agent-first platform). Goal: keep all existing Tulivu functionality intact; extend to support bookings, customers, services, staff/scheduling, and a simplified storefront while wiring operations to the agent where useful.

## Mapping

| Nuru | Tulivu (target) | Status |
|---|---|---|
| Multi-tenant (tenants/memberships/domains) | Organizations + memberships + owner-scoped data | Done (backend) |
| Services, staff, availability, hours | New modules with business scoping | Done |
| Customers, consents | New | Done |
| Bookings/holds/status history | Transactional booking engine with conflict checks, buffers and idempotency | Done |
| Storefront config/publishing | New storefront module | Pending |
| Dashboard (calendar/bookings/customers/services/staff/marketing/settings) | Routes under `/app/*` | Done (internal UI) |
| Marketing campaigns (simple) | Integrate with existing agent/campaigns | Existing Tulivu workflow retained |
| AI assistant/approvals | Leverage existing workflow/approvals | Existing Tulivu workflow retained |

## Phases

- [x] Phase 0: Branch + plan
- [x] Phase 1: Schema unification
- [x] Phase 2: Backend services & APIs
- [ ] Phase 3: Agent tools for operations
- [x] Phase 4: UI port & simplification
- [ ] Phase 5: Public storefront
- [x] Phase 6: Tests & hardening

## Hardening implemented

- Real account registration, login, logout, `me` and staff account creation with role checks.
- Organizations and memberships; all operations remain scoped by the organization owner id.
- Business-scoped customers, services, staff, business hours, bookings and status history.
- Bookings derive price, currency, duration and buffers from the selected service.
- Per-staff advisory locking plus overlap, hours, availability and time-off checks inside a transaction.
- Idempotency keys return the original booking instead of creating duplicates.
- Explicit status transitions, cancellation and reschedule endpoints.
- Business-hours saves replace only the selected business.
- Acceptance tests cover auth, tenant isolation, cross-workspace references, double booking, invalid dates, idempotency, hours enforcement, derived pricing and status history.

## Notes

- Stack: Tulivu = Vite + React + Fastify; Nuru = Next.js. Port logic, not Next-specific code.
- Scoping: all operations are scoped by owner/business.
- Demo-safe: simulated providers remain clearly labelled until live credentials are configured.
- Non-breaking: existing Tulivu routes remain functional.
