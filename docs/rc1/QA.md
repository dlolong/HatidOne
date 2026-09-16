# RC1 independent verification

**Code checks PASS; installed/deployed beta verification remains BLOCKED.** Evidence was collected on 2026-09-08 against the integrated, uncommitted working tree based on `c8b040c69d88ab5d65f373fc0914e28d0677afb9`. This is not a release tag. No hosted environment was changed, no existing database was reset, and no real customer data was used.

## Final executed evidence

Supported Node **24.20.0** was obtained through `npx --yes --package=node@24 node -p process.execPath`, then its binary directory was prepended to `PATH`. Host Node 23.2.0 is outside the declared engines. The exact final verification invocation was:

```sh
PATH='/Users/mardi/.npm/_npx/387698761821791d/node_modules/node/bin:'"$PATH" npm run verify:code
```

**Result: exit 0.** Full local command output: `/tmp/hatidone-rc1-verify-code.log` (temporary local evidence, not a tracked release artifact). The command explicitly printed three BLOCKED deployed/device gates; `--code-only` does not approve them.

| Check | Result | Evidence |
| --- | --- | --- |
| Environment safety | PASS | 5 executable tests, including secret-name/key rejection and hosted-test/production targeting guards. |
| Mobile preview safety | PASS | 6 executable tests; production targeting, private/tunnel endpoints, privileged keys and simulated providers rejected. |
| Workspace TypeScript | PASS | Driver, Passenger, Web and Core checks. |
| Workspace lint | PASS | Driver, Passenger and Web. |
| Unit/behavioral tests | PASS | Web 43 tests across 13 files; Core 14 across 2 files. Includes readiness authorization, dispatch errors and Manila calendar/date boundaries. |
| Next.js production build | PASS | Next.js 16.3.1; all 30 generated pages completed. Build uses existing local environment, not verified hosted release configuration. |
| Built web client credential-pattern scan | PASS | 23 client output files scanned. This is a pattern check, not a complete secret audit or approved release endpoint verification. |
| Expo compatibility | PASS | Both installed app dependency sets reported up to date. |
| Clean PostgreSQL migration/RLS/transaction suite | PASS | All canonical migrations through 0009; RC1 SQL 58 assertions, existing/expanded security SQL 74 assertions, 6 genuine concurrent transaction cases. |
| Upgrade PostgreSQL migration/RLS/transaction suite | PASS | Actual 0008 schema and preexisting fictional rows; 0009 refusal with active legacy state, no partial schema/ride mutation, fictional cancellation through old RPC, then successful upgrade preserving prior rows. Same 58 + 74 + 6 checks passed afterward. |
| Production-server anonymous HTTP smoke | PASS | Built Next started on isolated port 3109; `/api/health` returned 200, only `status: alive`, `Cache-Control: no-store`; `/api/readiness` returned 401 with only an error. Test server stopped afterward. No authenticated backend writes. |
| `git diff --check` | PASS | No whitespace errors at final verification. |

Both database cases ran in a newly created `hatidone-sql-test-PID` Docker container using `public.ecr.aws/supabase/postgres:17.6.1.165`, with separate `hatidone_test` and `hatidone_upgrade` databases. The harness removed only its own container and temporary logs. Existing HatidOne and unrelated local Supabase stacks remained untouched. Auth/Storage bootstrap schemas are test adapters: these tests prove PostgreSQL role/RLS and function behavior, not hosted token issuance, file delivery, or PostgREST integration.

## Acceptance matrix

| Required criterion | Result | Scope / limits |
| --- | --- | --- |
| Passenger/driver/fleet/admin authorization boundaries | PASS | Actual authenticated-role SQL; cross-role mutation denials and operations paths. |
| Cross-user booking / cross-fleet private documents | PASS | Direct RLS reads, private Storage object denial, fleet projections and unauthorized dispatch. |
| Direct role escalation / self-verification | PASS | Direct role/verification-column writes and review RPC attempts rejected. |
| Client fare, earnings, payment and assignment injection | PASS | Direct table writes rejected; manual request ignores client money/status fields. |
| Double booking / conflicting retry payload | PASS | Identical operation replay returns same booking; changed payload rejects; simultaneous submission produces one row. |
| Concurrent same-ride driver acceptance | PASS | One winner and one assignment across two real transactions. |
| One driver accepting overlapping schedules | PASS | One winner and one assignment across separate rides; exact 30-minute buffer boundary tested. |
| Cancellation versus acceptance | PASS | Concurrent race ends consistently cancelled. |
| Offer expiry race | PASS | Deterministic held ride lock makes acceptance wait past expiry; actual expiry rechecked after lock acquisition, no assignment created. |
| Suspended/ineligible driver and required documents | PASS | Suspension/expired-license acceptance denied; license expiry after assignment rejects arrival; no self-verification. Exhaustive device-time and every document-type combination were not run. |
| Quote/acceptance/manual assignment separation | PASS | Address-only pending request has no invented coordinates, fare or duration; reviewed PHP quote, passenger acceptance, manual assignment and explicit driver reconfirmation exercised separately. |
| Quote/version and immutable fare | PASS | Stale quote and dispatch version rejected; fractional-cent input rejected; assigned fare protected even against accidental privileged edits; original agreed fare/0% commission retained at completion. |
| Safe reassignment | PASS | Before-heading replacement increments assignment version, rejects stale version, changes trip/PIN credentials, clears reconfirmation, removes prior driver's trip authority and rejects reassignment after trip start. |
| Wrong / locked / replayed PIN | PASS | Five wrong attempts persist and lock; correct PIN cannot bypass lock; correct PIN works after expiry; replay after start rejected. Expected PINs/hashes are not printed. |
| Duplicate completion and collection | PASS | Completion replay creates one pending cash record; report/reconcile retries deduplicate; different-operation double-report rejected, including concurrent requests. |
| Accurate cash status / history | PASS | Driver report stays pending; only operations reconciles a full matching report; two append-only events; unrelated accounts cannot read history. No payment-gateway claim. |
| Pause and existing ride continuity | PASS | New request rejected while paused; existing operation reconciles and confirmed ride continues. |
| Pilot mock isolation | PASS | Private environment blocks demo even with legacy demo flags enabled; admin cannot enable it in pilot; simulated payment denied. |
| Account deletion request privacy | PASS | Owner derived from identity; repeated request returns one open record; unrelated reason reads, direct account erasure and self-marked fulfillment denied. Actual deletion awaits approved retention policy. |
| Server recovery after a lost response | PASS | Identical operation repeated after the first call completed reconciles durable server state. This does not simulate actual device network loss. |
| Network disconnect/reconnect/resume and account switching | BLOCKED | Installed-app/runtime test with authorized backend not performed; source changes and unit tests are not substitutes. |
| Passenger + Driver + Admin UI on one booking | BLOCKED | No authorized deployed RC1 backend or installed preview apps available. SQL exercised equivalent roles/functions; it is not a three-UI test. |
| No-laptop / no-Metro scenario | BLOCKED | No signed installed preview binaries plus verified deployed backend. Local build and JavaScript exports do not satisfy this gate. |
| Physical-device permission/location/terminated app | BLOCKED | Physical-device execution not established. No tracking guarantee. |
| Hosted confirmation/reset email and deep-link delivery | BLOCKED | Hosted delivery/redirect behavior not tested. |
| Backup restore | BLOCKED | No authorized disposable hosted restore target or backup artifact supplied. |

The full SQL lifecycle advances a fictional future booking to pickup time using owner-only fixture time travel: the test first asserts assigned fare/schedule immutability, temporarily disables only that trigger to change the fictional schedule, then immediately restores it. No client can perform this operation; this is not evidence of a real-time or deployed end-to-end run. The upgrade fixture includes a representative active ride state to exercise preflight; the main RC1 test separately creates real assignments/trips through release RPCs.

## Native evidence and remaining gates

Mobile engineer evidence: both Android Hermes JavaScript exports succeeded to `/tmp/hatidone-rc1-passenger-android` and `/tmp/hatidone-rc1-driver-android`. They are **development-config JavaScript/assets**, include expected local endpoints, and precede the final small source edits; they are not integrated release artifacts. No APK, AAB, IPA or simulator `.app` was produced. Native compilation was NOT RUN. Toolchain inspection found no full Xcode/simctl, Java 11 rather than 17, and missing Android API/build-tools 36; native signing and authorized staging configuration remain owner gates. See `../MOBILE_SIMULATOR_GUIDE.md` for exact preparation commands.

## Findings and retest disposition

Fixed and retested: payload-conflicting booking replay; action-time driver/document eligibility; explicit reconfirmation; production/demo override; expiry during lock waits; safe versioned reassignment; active-ride migration hazard; and RC1 SQL compilation. The migration now refuses active legacy rides before schema changes; drain them using the prior release first. No silent promotion of a legacy price occurs.

During development, a legacy PIN-denial assertion required updated error wording, a test timestamp needed SQL parentheses, and an initial timing-based concurrency test could not reliably observe its lock under load. These test defects were corrected; the final lock test uses an explicit open-transaction barrier. An initial `npx -c` verifier attempt inherited npm configuration that broke nested `npm exec`; final verification used the explicit supported Node path and completed successfully.

Earlier baseline evidence was 47 unit tests plus the original disposable SQL suite; the final evidence above supersedes it. Public deployment, remote migration, signing, store submission, backups, legal classification and actual transport operations were neither performed nor approved by these checks. The independent technical verdict is repository code checks PASS with the installed/deployed beta gate BLOCKED; operational and public-release verdicts remain subject to `PILOT_GATES.md` and `RELEASE_REPORT.md`.

## Final password-recovery delta

The complete `verify:code` pass above preceded the final password-recovery addition. Database behavior did not change afterward, so the clean/upgrade transaction suite was not needlessly repeated. The delta adds scoped web PKCE recovery cookies/actions/callback/pages and an optional mobile link to the fixed web recovery route; it does not exchange native tokens or send a test email.

Independent review found that installed `@supabase/ssr` replaces configured cookie `maxAge` with its long persistence default. The owner fixed this at the actual cookie-write boundary: 900-second HttpOnly/SameSite cookies, secure HTTPS handling, and zero-age deletion preserved. A second regression verifies uppercase HTTPS URLs still produce Secure cookies. This controls browser-cookie retention; it is not evidence of the hosted provider's token lifetime or delivered-link behavior.

Executed with the same Node 24.20.0 PATH:

```sh
npm --workspace apps/web test -- app/auth/recovery/actions.test.ts app/auth/recovery/callback/route.test.ts lib/supabase/recovery.test.ts
node --test packages/mobile/scripts/check-preview.test.cjs
```

Both exited 0: **18 recovery tests** and **8 mobile preview/recovery URL tests** PASS. Actual cookie write options, exclusion of ordinary application cookie names, fixed redirect origins, absent/expired/unverified recovery handling, malformed password rejection, non-enumerating provider failures, and cleanup after successful update were exercised with controlled provider mocks. Five independent adversarial cases additionally verify safe thrown-provider errors, no code/diagnostic leakage, and preservation of the successful update redirect if subsequent signout fails. `git diff --check` remained PASS.

These are behavioral tests and source/installed-SDK review, not hosted authentication proof. No email was sent and no real password or session was changed. Hosted delivery, real PKCE exchange, expired-link timing, physical-device browser return and native reauthentication remain BLOCKED. Operations engineer then verified the final cookie-fixed delta on Node24: full Web **61 tests PASS**, Web typecheck/lint PASS, and the production build PASS with 33 pages. Mobile engineer separately verified both app typechecks/lints after adding recovery links. No native exports/builds were rerun.

Independent GET-only smoke against that final built server on isolated port3109 also PASS: `/forgot-password` returned200 with the request form; `/reset-password` returned200 with the missing-recovery state and no password confirmation field; `/auth/recovery/callback?code=&next=...&sb_flow_id=...` rejected the empty code, redirected only to configured `/forgot-password`, stripped attacker-controlled redirect/flow values, and set `Cache-Control: no-store` plus `Referrer-Policy: no-referrer`. No recovery POST, email request, code exchange, real account or backend mutation was performed. The isolated test server was stopped afterward.

## Final fictional-credential delta

The inherited common fixture password was removed after the earlier checks. Canonical `supabase/seed.sql` now uses the explicitly supplied per-email setting or independent 32-byte random fallback values, including for the fictional admin. No existing local or hosted account was altered.

The affected **clean and upgrade database suites were rerun and PASS**, exit0, with the same 58 RC1 assertions, 74 security assertions and 6 concurrency cases per database. Active-ride preflight rejection, preserved legacy data and successful drained upgrade also passed. A one-off wrapper of the canonical harness added an actual cryptographic check that **all 10 fictional accounts reject the previous common password** in both databases. The prior candidate was read from the baseline Git blob only in process memory and passed to the disposable SQL process through stdin; no candidate, SQL text or raw provider diagnostic was printed or retained. Temporary helper/container resources were removed. Evidence: `/tmp/hatidone-rc1-seed-verification.log`; invocation: `python3 /tmp/hatidone-rc1-seed-verification.py`.

An independent memory-only scan of nonignored repository files found zero occurrences of the exact prior common password. The operational credential-file helper received a further review finding: `SELECT set_config` can return the complete credential map as query output. This was fixed with `DO`/`PERFORM` and escaping of both SQL layers. An independent actual-PostgreSQL smoke with deterministic in-memory fictional values proved that apostrophes, dollar signs, backslashes and Unicode survive serialization and **no credential result is returned**. This used a separate disposable `hatidone-credential-test-PID` container, created no accounts, and removed the container afterward; invocation: `python3 /tmp/hatidone-rc1-credential-sql-smoke.py`, exit0.

Independent `npm run test:release-safety` on Node24 then passed **11 tests**: environment5, fixture generation/validation/serialization3, and sanitized CLI status3. Source review confirms independent per-account entropy, rejection of missing/shared credential maps, private-file `0600` configuration, credential preservation on ordinary start, no common-password HTTP fallback, capture of all CLI output/error streams, and a status whitelist restricted to public local connection fields. `git check-ignore` confirmed the account file, previous-account backup and staged SQL are ignored; `git diff --check` passed. Real credential files were not generated during QA and the CLI backend workflow was not run against existing stacks. No HTTP fixture login was attempted against the unchanged existing backend; its old accounts remain unchanged until an owner-authorized local reset or rotation.
