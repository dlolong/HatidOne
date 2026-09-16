# RC1 implementation audit

Initial tree clean at audit. npm workspaces; Next16.3.1 / React19.2.8 web; Expo54 / RN0.81.5 native. Installed dependencies present. Existing documentation is not verification evidence.

| Capability | Initial status / integration | Paths / risk | Owner / acceptance / dependency |
|---|---|---|---|
| Auth + permissions | Implemented, DB tests pending / real Supabase | packages/mobile/src/auth.tsx; migrations0002–0008. Native RPC does not require browser cookies. | Lead + mobile / active role, RLS and account separation |
| Scheduled booking + fare | Partial / simulated straight-line | create_transport_request and create_scheduled_ride_request authorize placeholder fares; retry payload conflicts unchecked | Lead / reviewed immutable quote, explicit Manila schedule, replay mismatch rejected |
| Dispatch | Implemented, unverified / manual + offers | SQL locks driver/vehicle; no quote acceptance gate; manual driver reconfirmation unenforced | Lead + ops / competing accepts, expired docs and cancellation race |
| Trip/PIN | Partial / real RPC | advance_trip persists failed PIN attempts; eligibility not fully rechecked at start | Lead / reconfirmation, expiry, PIN replay, duplicate completion |
| Collection | Missing cash reporting / mock payments available | payments has pending cash on completion; demo enabled by mutable app_config alone | Lead + mobile + ops / actor-scoped cash audit, separate report/reconcile |
| Mobile state | Partial / real backend | shared auth/resource; localhost examples; stale and timeout recovery incomplete | Mobile / resume, account switch, offline, visible uncertainty |
| Native artifacts | Missing / unavailable | app.json identifiers exist, no internal profiles | Mobile / bundled preview APKs, simulator distinct from device; signing/toolchains |
| Operations | Partial / manual | admin operations exceptions exist; no safe booking pause | Ops / Needs Attention and audited server controls |
| Deployment | Partial / unavailable hosted evidence | no CI/liveness/release verifier | Ops / build, explicit environment and failing blocked gates |
| DB security evidence | Existing executable harness / isolated Docker | supabase/tests; duplicate0004 migration identifiers | QA / clean+upgrade schema and concurrent transactions |
| Deployed shared-ride/no-laptop | NOT RUN / unavailable authorized environment | No exact remote action authorized | Owner / deployed HTTPS backend + installed apps |
| Privacy/operations policy | Unverified / manual owner decision | support, retention, legal, distribution require evidence | Ops / separate pilot gates |

P0/P1 implementation priorities: isolate simulation using privileged environment; remove fabricated fare authority; transactional versioned quotes and cash records; enforce reconfirmation/action eligibility; mobile state/session recovery; native preparation; reproducible verification. Hosted changes, signing, accounts, store submission and real transport are not authorized.

Environment variable names and final checks are inventoried in DEPLOYMENT.md, QA.md and RELEASE_REPORT.md. No environment values or customer data are evidence artifacts.

## Actual entry points and integrated contract

| Journey action | Entry points | Trusted backend / final disposition |
| --- | --- | --- |
| Login/signup | `apps/web/app/auth/actions.ts`, `app/auth/callback/route.ts`; native `packages/mobile/src/auth.tsx` | Supabase email/password; native SecureStore, refresh, `getUser` verification; runtime delivery/device behavior BLOCKED |
| Password recovery | web `/forgot-password`, `/auth/recovery/callback`, `/reset-password`; optional native browser links | Separate HttpOnly recovery session; verified user and fixed redirect;18 recovery tests +3 anonymous route checks PASS; delivery BLOCKED |
| Scheduled request | web `components/booking-planner.tsx` → `app/(protected)/book/actions.ts`; passenger `app/book.tsx` | `create_transport_request`; server future bounds, explicit offset; actor/key/payload reconciliation; address-only manual review |
| Quote review/accept | admin `components/needs-attention.tsx`; web/passenger booking detail | `admin_review_ride_quote`, `accept_ride_quote`; immutable quote versions, PHP numeric amounts, zero commission; actual SQL PASS |
| Driver eligibility/offers | web `lib/dispatch`, driver `src/data.ts` | `find_eligible_drivers`, `driver_can_take_ride`, `accept_ride_offer`; current docs/vehicle/role, serialized conflict interval; PASS |
| Manual assign/reassign | admin dispatch and Needs Attention; fleet form | `rc1_manual_assign_ride`, `rc1_reassign_ride`; quote version/assignment version, reason, eligibility, PIN rotation; reassignment only before heading; PASS |
| Passenger cancellation | web book actions; passenger detail | `cancel_own_ride_request`; existing ride lock/state machine; acceptance race PASS |
| Driver reconfirm/advance | driver context/trip detail; existing web driver actions | `confirm_ride_assignment`, `advance_trip`; active driver/vehicle/docs rechecked, persistent PIN attempt lock, replay refusal; PASS |
| History/collection | passenger detail, driver trip/earnings, operations cash audit | `trips`, `payments`, `cash_collection_events`, `record_cash_collection`; completion ≠ collection ≠ reconciliation; PASS |
| Account request | `/account`, both native Account screens | `request_account_deletion`; scoped/idempotent review queue; actual deletion/retention implementation BLOCKED pending policy |
| Health/control/recovery | `/api/health`, `/api/readiness`, admin operations | Liveness only; admin readiness scoped to checks; audited pause/area/optional-integration controls; manual staffing/recovery gate |

No client imports server-only Next modules. Native authenticated Supabase RPCs are the existing approved API surface. SQL0009 wraps legacy APIs privately and removes inherited API grants. Existing ride lifecycle states are unchanged. The occupied interval is the operator-reviewed duration plus the existing 30-minute buffer against another assignment; unknown route distance remains null. Driver assignment and trip rows remain separate.

## Environment name inventory (no values)

Existing ignored files were read for variable **names only**; no values were changed:

- Root `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `PAYMENT_PROVIDER`, `PAYMENT_SECRET_KEY`, `PAYMENT_WEBHOOK_SECRET`.
- Web `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `HATIDONE_DEMO_MODE`.
- Passenger `.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_DEMO_MODE`.
- Driver `.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_WEB_URL`.

`NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` are client-visible. The root privileged/payment names are not required by the current manual app runtime and must stay server-only/unbundled; no live gateway is implemented. New explicit app environment names and release-required names are in DEPLOYMENT.md. `EXPO_PUBLIC_WEB_URL` selects the optional recovery/document browser destination. Tooling variables (`HATIDONE_DOCKER_CLI`, `HATIDONE_STUDIO`, `HATIDONE_TEST_POSTGRES_IMAGE`, `HATIDONE_RELEASE_BUILD`, `EAS_BUILD_PROFILE`) are local/build controls, not authorization. Existing local configurations intentionally fail release validation and were preserved.

## Remaining evidence boundaries

No hosted Supabase/Next endpoint, individual invited account delivery, email recovery delivery, installed native app, terminated-app location, physical-device account switch, restore or operational staffing was verified. PostgreSQL Auth/Storage bootstrap tests prove database logic and privileges, not the Supabase Auth HTTP service. Optional business booking and legacy automatic backup activation fail closed on real data; Going Home/Return Matching remain for valid coordinate data. No scheduler or live push delivery was added.

The inherited shared demo-account password was removed from canonical seeding. Disposable SQL fixtures receive independently random passwords; the local CLI can supply per-account generated credentials via private ignored files. This is local software-test provisioning only. Existing development database credentials were not changed; an owner-authorized disposable reset is needed to refresh an old demo backend. Final seed/credential checks are recorded in QA.md.
