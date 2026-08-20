# HatidOne Development Rules

## Stack
- Next.js + React + TypeScript
- React Native / Expo for mobile apps (later phase)
- Supabase Auth / PostgreSQL / Realtime / Storage
- PostGIS for geospatial queries

## Architecture
- Treat ride lifecycle as a strict state machine.
- Never trust fare, payment, role, or assignment values from the client.
- Privileged mutations must be server-side.
- Never expose the Supabase service-role key to browser/mobile clients.
- All user-owned tables require RLS.
- Financial calculations happen server-side.
- Payment webhooks must be signature-verified and idempotent.
- Driver/passenger location data must only be exposed to authorized trip participants and operations staff.

## Code Quality
- TypeScript strict mode.
- Avoid `any` unless justified in a comment.
- Prefer small reusable components and pure business-logic functions.
- Add tests for business-critical logic and regressions.
- Add loading, empty, success, and error states to user flows.
- Do not duplicate database access logic across UI components.

## Database
- Use migrations only; do not make undocumented dashboard-only schema changes.
- Add foreign keys, indexes, constraints, and timestamps.
- Prefer immutable trip/payment event logs for auditability.
- Keep `ride_requests`, `ride_assignments`, and `trips` separate.

## Security Review Checklist
Before merging any auth, payment, booking, dispatch, or safety change:
1. Verify authorization on the server.
2. Verify RLS behavior.
3. Verify replay/idempotency behavior.
4. Verify race conditions around booking acceptance/cancellation.
5. Verify that sensitive fields are not returned to unrelated users.

## UX
- Mobile-first.
- Large touch targets.
- Clear fare breakdowns.
- Clear driver earnings breakdowns.
- Avoid hiding pickup/dropoff and expected earnings from eligible drivers.
