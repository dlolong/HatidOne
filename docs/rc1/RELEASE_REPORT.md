# HatidOne RC1 release report

RC1's manual scheduled-ride repository slice is implemented and independently tested. **The release is not ready for an installable beta, compensated pilot, or public launch.** No deployed cross-app journey or installed no-Metro application has been verified. All work remains uncommitted for owner review on the shared working tree based on `c8b040c69d88ab5d65f373fc0914e28d0677afb9`.

## Separate verdicts

| Scope | Verdict | Meaning |
| --- | --- | --- |
| Repository code / database slice | PASS for the verified slice | Manual quote → acceptance → assignment/reassignment → reconfirmation → PIN → completion → cash reporting/reconciliation passed executable checks. This does not certify UI/device operation. |
| Installable invited beta | BLOCKED | No signed native artifacts, authorized deployed RC1 backend, cross-app UI journey or no-laptop evidence. |
| Compensated operational pilot | BLOCKED | Beta gates plus owner evidence of authority, geography, insurance, fare/discount policy, staffing/support, privacy, retention and tested recovery. |
| Public store release | BLOCKED | Distribution/signing/accounts, approved privacy/deletion/support behavior, accurate metadata and store review remain outstanding. |

## Implemented changes

- `supabase/migrations/0009_rc1_release_contract.sql`: privileged environment isolation; actor-scoped request/payload idempotency; address-only requests with no fabricated coordinates/fare; immutable versioned operator quotes in PHP with 0% commission; passenger acceptance; driver/document/vehicle/schedule checks; reconfirmation; PIN retry/replay protection; lock-time offer expiry; idempotent accepted-offer reconciliation; versioned, reasoned assignment and pre-heading reassignment; PIN rotation/reconfirmation after reassignment; immutable assigned fare/schedule; separate cash report/reconcile/dispute events; audited booking/area/integration controls; account-deletion review requests. All newly exposed tables use RLS/read-only client privileges and authorized mutations.
- Existing ride lifecycle states remain unchanged; requests, assignments, trips, quotes and cash events remain distinct. New manual routes require an operator-reviewed occupied duration; the existing 30-minute scheduling buffer remains. No precise ETA, automatic dispatch guarantee, new commission or payment gateway was introduced.
- Passenger/Driver apps and `packages/mobile`: manual request/quote/acceptance and collection history; persistent actor-scoped operation identifiers; authoritative state refresh after uncertain mutations; local session cleanup and account cache separation; resume/reconnect reads; visible stale/error state; driver reconfirmation; safe account-review requests. Native behavior is implemented but physical runtime checks remain blocked.
- Web operations: Needs Attention, quote review/acceptance, cash audit, guarded assignment/reassignment, release controls, account requests, truthful safety/capability copy, liveness and authenticated readiness. Fixed a dispatch server action that caught Next.js success redirects as errors. Incomplete real organization booking and unversioned backup activation fail closed; existing demo data and Going Home/Return Matching are preserved.
- Native configuration: existing Expo54/RN0.81.5 and registered app IDs retained. Development/internal preview/production profiles are distinct; preview bundles JS and targets APK, production Android targets AAB, iOS simulator profile is separate. Public HTTPS/environment/credential guards reject unsafe release preparation. No native directories were regenerated and no signing material was generated.
- Root verification/CI: npm scripts, supported Node24, environment and client-output checks, clean/upgrade database tests, explicit blocked external gates, non-deploying CI. Local seed/reset require explicit local/disposable acknowledgment and individual random fixture passwords; no shared fixed admin password remains in the seed. Private generated test credentials are stored only in ignored local files with restrictive permissions. Existing ignored environments were not edited; no dependencies or lockfile changes were needed.
- Final auth delta: browser password recovery and optional native recovery links, independently checked separately below. Delivery, redirect allowlists and physical app/browser return behavior are not inferred from source tests.

The complete changed-file inventory is in STATUS.json. AUDIT.md contains the actual entry-point and environment-name inventory; PLAN.md records ownership and integration order.

## Database and migration evidence

Only new migration `0009_rc1_release_contract.sql` was created. No applied migration was edited. It was applied only in newly created, self-cleaning Docker databases `hatidone_test` and `hatidone_upgrade`; **nothing was applied to the existing local development backend or a hosted project**.

Clean application and an actual0008→0009 upgrade both passed. Upgrade fixtures verify preservation of old records and that existing active rides cause preflight rejection before schema changes. Owner must freeze intake/dispatch and safely drain active rides on the old release before hosted application; do not cancel real trips merely to satisfy migration preflight. Historical duplicate0004 identifiers still require a target-specific reviewed migration-history mapping. Do not run an unreviewed hosted `db push` or deploy `.local-backend` renumbered copies.

The database test Auth/Storage bootstrap is a test adapter. PostgreSQL JWT-role claims used by the harness prove SQL authorization, RLS and transactions; they do not prove hosted Supabase Auth token verification, actual object delivery or email delivery.

## Executed evidence

Final integrated command before the isolated auth and seed/CLI deltas: `PATH='/Users/mardi/.npm/_npx/387698761821791d/node_modules/node/bin:'"$PATH" npm run verify:code`, Node24.20.0, **PASS exit0**. Log: `/tmp/hatidone-rc1-verify-code.log`. See QA.md for exact command and detailed adversarial cases.

| Check | Result | Observed evidence |
| --- | --- | --- |
| Environment/local credential/CLI safety tests | PASS | 11 final tests:5 environment,3 fixture credential,3 status-output cases |
| Mobile preview/recovery URL safety tests | PASS | 8 final tests (6 at the integrated checkpoint) |
| Workspace typechecks and lint | PASS | All applicable workspaces |
| Web/core unit tests | PASS | Final web61 + unchanged core14; web includes18 independently checked recovery tests |
| Next production build | PASS | Built existing web/API application |
| Client credential pattern scan | PASS | 23 generated client files; no privileged pattern findings; not an exhaustive security proof |
| Expo compatibility | PASS | Both apps match installed SDK dependencies |
| Clean and upgrade SQL | PASS | Each database: RC1 SQL58 + existing security/RLS74 assertions |
| Real concurrent transactions | PASS | Each database: 6 cases, including two-driver/same-ride, overlapping same-driver schedules, cancellation/acceptance, double request, double cash report and lock-wait expiry |
| Upgrade active-ride preflight | PASS | Rejected unsafe upgrade and retained old schema; fictional fixture drained through old flow before upgrade |
| Public liveness / anonymous readiness | PASS | Built server on private test port3109; HTTP200 `{status:alive}` / HTTP401; process stopped afterward |
| Current release environment validation | BLOCKED as intended | Existing local endpoints/missing explicit release environment rejected; no values changed |
| Both Android JS exports | PASS, development only | Packaging evidence below; exports predate final small UI/auth edits |
| Signed APK / IPA / simulator application | BLOCKED | Missing toolchains/signing prerequisites; none produced |
| Three-client UI/deployed journey | BLOCKED | No authorized deployed RC1 backend and installed preview apps |
| No-laptop / restart/account-switch / physical GPS | BLOCKED | Not run on installed apps/devices |
| Email confirmation/recovery delivery | BLOCKED | No delivery/redirect configuration or accounts tested |
| Backup / restore | BLOCKED | No authorized backup artifact/restore target or evidence |

The verifier prints BLOCKED deployed/device gates even in `--code-only` mode. `verify:code` exit0 means repository checks only. `verify:rc1` returns exit2 with passing code while the external gates remain blocked; its release verdict must not be relabeled PASS.

Final auth-delta checks on Node24.20.0: web typecheck, lint, `npm --workspace apps/web test` (61 tests, including18 recovery cases), `npm run build` (33 pages), and `npm run check:build-secrets` (23 files) all PASS. Both mobile typechecks/lint and8 preview/recovery URL guards PASS. Independent QA ran18 recovery cases and3 GET-only checks on the final built server: forgot form200; missing-session reset200 with no password form; invalid callback with malicious next/flow safely redirected without leaking parameters and with no-store/no-referrer. The temporary server was stopped.

QA found and retested the Supabase SDK overriding the intended recovery-cookie lifetime; the adapter now enforces its15-minute browser-cookie window at the actual write boundary, preserves deletion and correctly recognizes HTTPS. Recovery cookies are separate from normal app sessions; verified recovery identity authorizes password updates. These tests use mocks and anonymous GETs; no email, authorization-code exchange or actual password mutation was sent. Database code did not change for this delta, so its passing suite was not repeated. Full scope and limits are in QA.md.

Final seed/CLI delta: `npm run test:release-safety` independently PASS11; backend/HTTP script syntax, ignored private artifact paths and whitespace checks PASS. The inherited shared fixture password was removed. In-memory verification against actual cryptographic hashes proved every fictional account (including admin) rejects that prior password in both newly seeded databases; it was not logged or retained. The clean and upgrade suites were rerun after the seed change, again passing58 RC1 +74 security assertions and6 concurrency cases each. Log: `/tmp/hatidone-rc1-seed-verification.log`.

Generated local per-account credentials and staged seed are restricted to mode0600 ignored files. The credential map is set with a no-output SQL block. CLI startup/reset/status output is captured and only approved public status fields or sanitized outcomes are emitted. Existing local accounts were not changed and no private credential files were generated during this implementation; owner must explicitly choose a disposable reset to replace an older demo backend. The HTTP smoke script now requires its individual local credential file instead of a fixed-password fallback.

## Artifact inventory

No APK, AAB, IPA, or simulator `.app` was produced. No store, EAS cloud build, hosted deployment or signing operation was executed.

| Output | App/version/platform | Backend / source | Limit |
| --- | --- | --- | --- |
| `/tmp/hatidone-rc1-passenger-android` | Passenger0.1.0 / Android JS export | Development configuration; base commit above + prefinal RC1 working tree | Hermes bundle3,246,017 bytes /1060 modules; contains local endpoints; NOT installable/distributable |
| `/tmp/hatidone-rc1-driver-android` | Driver1.0.0 / Android JS export | Development configuration; base commit above + prefinal RC1 working tree | Hermes bundle3,285,259 bytes /1070 modules; contains local endpoints; NOT installable/distributable |
| `apps/web/.next` | Web production-build output | Local build configuration | Build evidence only; rebuild with validated approved staging configuration before deployment |

Both development JS exports scanned with zero privileged credential patterns; local endpoint matches were found (Passenger3, Driver4). They are deliberately not release artifacts. Temporary outputs may disappear and must never be uploaded as RC1 binaries. The simulator guide has exact export/build commands and official Expo references.

## Remaining blockers and limitations

No unresolved critical defect is known in the tested scheduled-ride SQL slice. This is bounded evidence, not a security certification. Outstanding P1 release gates are:

1. Owner-authorized staging target, reviewed migration-history mapping, drain/preflight, migration rehearsal and restore evidence.
2. Correct explicit public HTTPS configuration, separate individual invited Auth accounts, tested confirmation/recovery delivery and redirect allowlists.
3. Native toolchains: this host lacks full Xcode/simulator support, Java17, Android API36/Build Tools36. The default Node23.2 shell is unsupported; checks used Node24.20.0. Owner signing/distribution material remains unavailable/unauthorized.
4. Actual signed preview installation and Passenger/Driver/Admin same-booking UI journey, including no-Metro, lost-response, offline/resume, account-switch, permissions and GPS tests.
5. Approved privacy notice, data retention and actual deletion processing; software currently records review requests only. Truthful staffed contact/hours and incident responsibility must be supplied before real use.
6. Cash adjustments/partial-balance resolution beyond the append-only report/reconcile/dispute slice need an approved operations procedure; software deliberately rejects duplicate kinds, overcollection and disputed reconciliation. Do not use manual database edits as a workaround.

Lower-priority limitations: manual capped Needs Attention queries are not an exhaustive deployed scheduler; background tracking/push/SMS/maps/gateway delivery remain unavailable; driver money totals were removed rather than calculated in clients (per-trip server amounts remain); independent native visual/accessibility and device handling remain unverified. Optional business booking remains hidden in real pilot mode. Existing guide/demo claims outside RC1 are not substituted for current evidence.

## Owner handoff

Follow OWNER_ACTIONS.md in order, DEPLOYMENT.md for authorized rollout/recovery, PILOT_RUNBOOK.md for manual operations, and PILOT_GATES.md for separate private-test/beta/commercial/store evidence. No public URL is listed because none was known and verified for RC1. No remote changes, real bookings, passenger transport, commits, merges or pushes occurred.
