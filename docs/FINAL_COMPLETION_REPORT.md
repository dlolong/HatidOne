# HatidOne completion report — 2026-09-07

## 1. Executive summary

The repository now has separate passenger and driver Expo applications, a reusable mobile/provider foundation, transactional trip/PIN/chat/payment primitives, B2B workspaces, operational administration and a reproducible local Supabase demo. Existing passenger booking, onboarding and dispatch were extended rather than replaced. Default driver platform commission remains 0%; configurable server snapshots preserve fare/earnings consistency.

This is a substantially expanded **local pilot candidate**, not an assertion of production launch readiness or complete native-device certification. No hosted database was modified, no external account connected, no service-role key placed in browser/mobile configuration, and no payment collected.

## 2. Features completed

- Passenger: Expo Router Home/Bookings/Activity/Account, Supabase email/password auth and persisted sessions, manual/known/GPS location input, locally labeled route choices, server fare preview and booking, timeline/detail/cancel/rebook, assigned driver/vehicle/PIN, private chat/unread/report, safe sharing and emergency contacts.
- Driver: separate Jobs/Trips/Earnings/Account app; visible offer pickup/dropoff/schedule/capacity/vehicle/fare/commission/earnings; accept/decline, persisted availability/preferences, Going Home and buffered Return suggestions; scheduled confirmation; heading/arrival/PIN/start/complete/cancel/no-show; foreground GPS with manual fallback; document status and onboarding links.
- Domain: centralized configuration and plans, immutable fare snapshots, authoritative state transitions, private PIN storage and retry lockout, audited review/assignment/payment/subscription actions, participant messaging, notifications, referrals, generic organization memberships and saved locations.
- Web: map-free booking with server preview and partner intent, assigned driver/PIN/chat/rebooking/live updates, pending driver enrollment, admin document review/operations/config/subscriptions/safety/backups/audit; fleet resources and scoped manual dispatch; partner guest requests/referral projection; corporate members/employee requests/monthly planning summaries.
- Growth: `/drivers`, `/fleets`, `/partners/resorts`, `/business`, three configured corridor pages, manually reviewed referral events and QR-compatible booking URLs.
- Local operation: isolated Supabase stack, fictional seed accounts, public-env generation, disposable database security tests, HTTP smoke script, runbook and ten demo scenarios. Web uses dedicated port 3100; unrelated applications and containers were preserved.

## 3. Partially completed / deliberately limited

- Native iOS/Android JavaScript/Hermes bundles export, but no signed native binaries, simulator/hardware GPS/session testing, app-store distribution or background location certification was performed.
- Instant automated hailing, scheduled workers, automatic offer expiration/backup failover, push/SMS and live road navigation are not enabled. Offers/dispatch/failover remain operator-driven.
- Local routing uses approximate reference points and straight-line distance; arbitrary addresses need coordinates for a chargeable estimate. Tolls remain unknown unless configured. Route preference does not establish a fastest/toll-free road path.
- Fleet tools provide linked driver/vehicle views and dispatch; creating a vehicle uses existing driver onboarding and operations links it to a fleet. Full standalone fleet CRUD/document administration and graphical calendar are not complete.
- Corporate summaries are planning summaries from up to 200 bookings, not accounting statements. Cost centers/policies are basic purpose/reference fields; enterprise controls, exports and invoicing remain future work.
- Subscription statuses/plans/manual billing are implemented; feature quotas/entitlement enforcement and recurring charges are not. Backup readiness is manually inspected, with no promise of background alerts.
- Working-time/avoid-area preferences, normalized service-area polygons and a full route-options catalog are not implemented. Existing typed service arrays, preferred/destination areas and private Going Home coordinates avoid duplicate domain tables.
- Reliability uses explainable existing trip/arrival/cancellation records and a minimum sample threshold. Passenger no-shows are not misclassified as driver misconduct. Driver-attributed no-show tracking is explicitly unavailable pending an operations taxonomy.
- Seeded verified document **metadata** has no file bytes. Upload fictional test documents through onboarding to exercise real signed downloads and approval. Existing Storage authorization is enforced.
- Optional production provider contracts are documented; SMS/real checkout/push transports are not implemented. The payment interface remains demo-oriented until a real provider is selected.

## 4. Files/modules added

`apps/passenger-mobile/`, `apps/driver-mobile/`, `packages/mobile/`, `packages/core/`, web `lib/operations`, `lib/communication`, booking handoff parser, native/auth/booking/operational components, organization/admin/referral/growth routes, `scripts/backend.mjs`, `scripts/demo-env.mjs`, `scripts/test-http.mjs`, `scripts/Dockerfile.cli`, `.nvmrc`, Supabase config/seed/tests, and completion/demo/integration/runbook documentation. Root workspace scripts and lockfile cover all applications.

## 5. Migrations added

- `0007_product_foundation.sql`: config, organizations/members/locations/subscriptions, preferences, trip/PIN/lifecycle, messaging/read markers, safety/emergency contacts, payments/events, referral records, backup assignments, audited operations, protected projections and fixture-compatible access.
- `0008_configured_matching.sql`: configured fare duration and deterministic server scoring; document/vehicle review race serialization; removal of legacy direct vehicle writes.

Historical migrations are unchanged. The pre-existing duplicate `0004` version is handled only by ordered local staging. Hosted history must be reconciled before deployment.

## 6. RLS changes

New protected tables have RLS and explicit SELECT policies; sensitive writes use checked RPCs. Organizations distinguish owner/manager/rider membership from platform role. Fleet dispatch requires authorization on the **target booking** and fleet vehicle. Partner referrals use a sanitized RPC projection. Trips grant only explicit non-PIN columns; the private PIN schema is unavailable to API roles. Driver home coordinates and documents remain owner/operations-only. Realtime subscriptions retain table RLS.

## 7. Security review results

Confirmed and fixed during independent review:

- Cross-organization fleet dispatch by known booking ID.
- Predicted-schedule overlap versus an actually running trip.
- Legacy assignments missing trip/PIN initialization.
- Immediate no-show reporting after late arrival.
- Inconsistent schedule buffers and distant return candidates being excluded.
- Onboarding document/vehicle edits racing verification.
- External booking/referral return paths losing intent; unsafe external redirect targets are rejected.
- Native dependency duplication and mobile navigation visibility/contrast.

Server amounts ignore client fare/earnings fields. Wrong PIN attempts persist, repeated failures lock, completion/payment/message/request replays are idempotent, and offers/driver documents are revalidated at acceptance. Driver enrollment can only create a pending offline driver and cannot grant verification/admin privileges.

Dependency audit after the compatible PostCSS patch reports **24 advisories: 16 moderate, 8 high, 0 critical**, predominantly inherited through Expo SDK54/native tooling. They are not suppressed. Expo major upgrades were not forced because they require a coordinated native stack migration. Review these before a public launch.

## 8. Test results

- TypeScript: all app/core workspace checks pass in strict mode.
- ESLint: web and both mobile apps pass without disabling rules to hide failures.
- Unit/static regression tests: **47 passed** (36 web, 11 shared core).
- Real PostgreSQL tests: **71 passed** (68 SQL assertions plus three concurrent transaction races). Every historical/new migration and seed applies in a fresh disposable PostgreSQL17 container. Tests cover RLS, role escalation, documents, fare injection, PIN privacy/state/retry, idempotency, expiry/suspension, fleet isolation, configuration, return/buffer behavior and concurrent acceptance/cancellation.
- Full Supabase Auth/PostgREST HTTP smoke: **27 passed** with seven role logins, booking/fare tampering/idempotency, offer/assignment, protected PIN, messaging, lifecycle/completion replay, partner projection, corporate isolation, subscription activation and demo payment replay.
- Browser: responsive public-page smoke without overflow; protected-route gates; authenticated passenger fare preview/history/detail; mobile passenger/driver sign-in and reload restoration, data screens, persisted preferences, assigned driver/PIN, chat delivery/unread. No application runtime errors found in these checks.

The disposable SQL harness uses minimal Auth/Storage fixtures; the separate HTTP suite verifies the real local Auth and REST services. Native hardware and external-provider behavior remain untested.

## 9. Web build result

Next.js production build passes, including all new protected routes and three statically generated service corridors. Public pages render without backend credentials; protected pages provide setup guidance. Dedicated local web port is 3100 to avoid the existing unrelated service on 3000.

## 10. Passenger mobile result

Expo SDK54.0.37, TypeScript and ESLint pass; Expo dependency compatibility passes; **Expo Doctor 17/17** after deduplicating expo-font. Web/iOS/Android export passes. Browser-rendered app successfully signs in, restores sessions, displays bookings/account/assigned driver/PIN, and reads driver messages. Native device launch and foreground GPS still need hands-on validation.

## 11. Driver mobile result

Same SDK/check status: **Expo Doctor 17/17**, TypeScript, ESLint, compatible dependencies and web/iOS/Android exports pass. Browser-rendered app signs in/restores, displays offers/trips/earnings/documents, persists Going Home preferences, shows trip controls and sends authorized chat. Real device foreground/background behavior is not certified; background collection is disabled.

## 12. Demo instructions

```sh
nvm use
npm ci
npm run backend:start
npm run demo:env
npm run dev
# Separate terminals
npm run dev:passenger
npm run dev:driver
```

Open `http://localhost:3100`. API: `http://127.0.0.1:55321`. Use `passenger@hatidone.test`, `driver@hatidone.test`, `admin@hatidone.test` (or fleet/partner/corporate), password `DEMO-ONLY-HatidOne!42`. Full steps: DEMO_SCENARIOS.md. `npm run test:http` adds clearly labeled local test records; `npm run demo:reset` restores the fixtures.

## 13. Remaining manual setup

For a fresh machine: Node24, Docker, dependency/container downloads and compatible Expo/device tooling. Existing env files are never overwritten automatically. Physical devices require LAN-accessible public URLs. Upload fictional files for document-download testing. Hosted deployment needs actual migration-history reconciliation, backups, production account provisioning, configuration review and device/build signing. No new paid service keys are required for local use.

## 14. Production integration placeholders

See PRODUCTION_INTEGRATIONS.md for routing, payment, notification, SMS, analytics and crash-reporting boundaries and proposed server-only environment names. Keep demo flags off for a real launch. Cash remains pending until an authorized operational collection workflow is defined; the sprint does not pretend a cash record proves collection.

## 15. Regulatory assumptions requiring validation

No claim of transport authorization, insurance coverage, approved fare schedules, tax treatment, driver classification or legal compliance is encoded. Validate the actual Philippine operating model, service areas, safety escalation, privacy/retention practices and business agreements with qualified local advisers before transporting real passengers. Local quotes and verification fixtures are demonstrations, not regulatory evidence.

## 16. Remaining launch blockers

Native device acceptance testing; dependency advisory resolution/coordinated Expo upgrade assessment; real document review and operator procedures; hosted migration reconciliation/RLS verification on the target deployment; payment/settlement policy and production fare validation; privacy/retention and safety/transport authorization review. A staffed pilot must explicitly operate manual dispatch, confirmation, backup and billing workflows.

## 17. Next ten tasks by business impact

1. Run a staffed end-to-end scheduled-transfer pilot on real Android/iOS devices and capture failed flows.
2. Validate operating permissions, insurance, fares, safety response and privacy agreements for one service corridor.
3. Reconcile hosted migrations, apply to staging and rerun the SQL/HTTP authorization/race suites there with isolated test data.
4. Resolve inherited dependency advisories through a coordinated supported Expo/React Native upgrade and native tests.
5. Finish fleet driver/vehicle administration, document attention queues and a practical calendar/export flow.
6. Add an explicit scheduled-confirmation worker with monitoring, retries and operator escalation before automatic failover.
7. Define cash collection/reconciliation and add a signature-verified payment provider only when needed.
8. Improve route/service-area data and operating windows for the first corridor; validate real toll assumptions.
9. Enforce B2B plan entitlements and add useful monthly exports/invoice handoff without complex accounting.
10. Expand device UI/security regression coverage, telemetry/retention controls and support workflows from pilot feedback.
