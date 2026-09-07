# Completion audit — 2026-09-07

Baseline: `5819e40`, clean `main` working tree. All tracked apps, packages, migrations, auth/data helpers and existing tests inspected before implementation.

| Area | Finding | Action |
| --- | --- | --- |
| Complete baseline | Next.js strict TypeScript; Supabase cookie auth; active role gates; passenger-only public signup; private driver documents; scheduled requests; server fare RPC; timed offers/manual admin assignment | Preserve and extend |
| Partial | Shared state transition map exists, but no trip controls/PIN implementation; driver dashboard exposes offers; verification has submission but lacks admin review UI | Add transactional lifecycle and operations tools |
| Missing | Both Expo apps, messaging, notification center, preferences/Going Home/return matching, B2B accounts/subscriptions, marketing routes, local seed/runbook | Implement in dependency order |
| Broken setup | README refers to nonexistent database package; root env copy does not configure Next.js workspace; no local Supabase config/seed | Replace startup guide and provide reproducible bootstrap |
| Duplicate | Two historical `0004` migration versions; direct CLI migration history may conflict | Preserve historical files; provide local ordered migration runner; document remote reconciliation |
| Security risk | Existing tests mostly inspect SQL strings, not live RLS/concurrency; raw trip SELECT could expose PIN hash if granted broadly; fleet/partner/corporate policy coverage missing | Scope protected reads, RPC-only sensitive mutations; add executable database tests |
| Architecture risk | Hardcoded dispatch radius/timeout; no provider boundaries; `latest` dependency specifications; no mobile-safe shared data layer | Central config, local route/payment interfaces, pinned new dependencies |
| UX partial | Passenger booking needs coordinates; fleet and admin overview sparse; no native navigation | Known locations/manual entry, operational tables, native role-specific apps |
| Validation limitation | Supabase CLI/Docker not initially found on PATH; no device/emulator confirmed | Attempt available local validation; distinguish executed tests from review-only findings |

Assumptions: cash is supported; local estimates are not navigation instructions; B2B membership is separate from platform roles; manual billing/failover is explicit and has no fictional scheduler. No production deployment or remote database writes are part of this sprint.
