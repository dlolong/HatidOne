# Completion plan

1. Audit baseline and run existing checks (Agent 0).
2. Single database/domain/security owner adds new migrations, authorization, transactional trip/PIN/chat/preferences/config/B2B/subscription/referral primitives and local seed. Historical migrations remain unchanged (Agent 1).
3. Orchestrator adds mobile-safe route/config/matching provider package while Passenger and Driver agents build independent Expo Router applications (Agents 2 and 3).
4. Orchestrator executes Web Operations, Reliability/Monetization, Growth and UX roles sequentially: protected B2B/admin workflows, provider boundaries, acquisition pages and compact accessible forms (Agents 4–7).
5. After integration execute adversarial QA and release review roles (Agents 8–9). Fix confirmed failures; report all unexecuted runtime checks explicitly.
6. Deliver demo scenarios, integration guide, solo runbook and final completion report.

## Ownership and integration

Three independent worktrees/branches isolate database, passenger and driver changes. The lead owns root package/lock/config, web and new shared provider package. Database owner alone edits migrations and Supabase seed/config. Schema requests live in `docs/schema-requests/`. Integrate domain first, then mobile; no agent edits another owner's files. Four concurrent execution slots require remaining named roles to run sequentially.

## Defaults

0% default platform commission, B2B manual subscriptions, explicit development/demo payment flag, local route estimates, foreground location, in-app notifications, no paid integrations. Real Supabase Auth/RLS remains authoritative in both mobile apps. Demo data uses fictional identities and reserved example.test email addresses.

## Execution outcome

Domain and both native app branches were integrated. The lead implemented web operations, growth, provider/matching interfaces and release documentation. Passenger and driver agents then independently reviewed UX/runtime and authorization respectively; confirmed issues were fixed by the owning agent. Final validation includes 47 unit/static tests, 71 real database/concurrency checks, 27 local Auth/REST checks, web/mobile browser flows, web production build and mobile web/iOS/Android exports. Remaining native-device and launch work is explicitly listed in FINAL_COMPLETION_REPORT.md.
