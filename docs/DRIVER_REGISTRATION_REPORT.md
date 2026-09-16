# Driver registration and passenger signup verification

**Latest update:** the [Supabase confirmation-policy follow-up](#follow-up-supabase-email-confirmation-policy) below verifies both confirmation OFF and ON, including immediate driver onboarding. Hosted development settings still require the owner action documented there.

Original registration verification — Date: 2026-09-08. Scope: desktop/mobile **web**, existing Supabase Auth and application lifecycle. No hosted configuration, production data, actual `.env` files, package dependencies, native authentication, or historical migrations were changed for this task. The working tree already contained RC1 changes; this report describes the additional registration work.

## Confirmed causes and fixes

| Confirmed cause | Implemented correction |
| --- | --- |
| The original homepage used vague “Drive” navigation; none of the baseline home/signup/login screenshots had an “Apply to drive” action. | Public header, initial homepage view, `/drivers`, footer, login, and Account expose the same clear action. `components/public-navigation.tsx`, public pages, footer and Account. |
| Signup/login/callback did not carry a driver application journey through authentication. | `lib/auth/journey.ts`, `app/auth/actions.ts`, `app/auth/callback/route.ts`, and Supabase proxy allowlist only `passenger`/`driver` and validate destinations against the configured site origin. Signup, login, confirmation, resend and recovery preserve this navigation context. |
| New accounts correctly defaulted to passenger, but onboarding assumed an operational driver role; the old application operation converted roles too early and rejected passengers with bookings. | Migration `0010_driver_application_journey.sql` separates application permission from operational role. `lib/driver/data.ts` and onboarding actions admit only the active owning applicant to their application. Applying retains passenger role and history. |
| Existing passengers lacked an obvious same-account start/resume path. | `/driver-application` resolves the verified session and current canonical application state. Its GET is read-only; an explicit `Start application` POST creates or resumes the account's own draft. Account shows identity and the appropriate application action. |
| Signup choice held only initial component state, so a same-route Next link could leave the wrong selection after navigation. | `components/signup-journey.tsx` derives choice from the URL; switching updates the URL while retaining ordinary input nodes. Passwords are not persisted. |
| Default Next server actions rejected uploads above 1 MB despite the established 5 MB document limit. | `next.config.ts` permits a 6 MB multipart action body; existing signature, MIME and 5 MB file validation remain enforced. Actual 1,500,650-byte fictional PDFs uploaded successfully. |
| Restricted-profile and failed database reads could look like missing profiles or empty progress. | Profile error screen distinguishes restrictions. Driver data helpers report actionable load errors instead of treating failures as absent records. |
| Switching accounts discarded driver intent. | The resolver's explicit logout form carries allowlisted driver intent into the normal sign-in route. |
| Approval changes the existing role to driver, which previously hid passenger history and could strand active passenger bookings. | Own history reads use an active verified profile plus an explicit `passenger_id` filter. Trusted approval waits until active passenger bookings finish/cancel; a profile lock and insertion trigger serialize booking creation with approval. No new passenger-booking mutation rights are granted to approved drivers. |

The implementation preserves existing document requirements and private buckets. It introduces no promised review deadline, invented support contact, new self-selectable privilege, OAuth provider, or parallel application lifecycle.

## Routes and permissions

| State | Apply destination | Permission |
| --- | --- | --- |
| Signed out | `/signup?intent=driver`, with `/login?intent=driver` alternative | No application write from GET/prefetch. |
| Active account, no application | `/driver-application` introduction and `Start application` | POST derives the user from the verified session; creates one own pending, offline draft. |
| `pending` | `/driver/onboarding` | Own personal details, vehicle and private documents; passenger privileges remain. |
| `under_review` | `/driver/onboarding`, “Application submitted” | Read-only status/application; not eligible to drive. |
| `rejected` | `/driver/onboarding`, item-specific correction reasons | Existing replacement/resubmission flow; replay cannot erase rejection. |
| `verified` | `/driver` | Trusted review grants existing driver role; operational eligibility checks still apply. |
| `suspended` / restricted account | Restricted status/support guidance | No new-application bypass or applicant edit. Trusted admin reinstatement retains existing eligibility checks. |
| Operations/business account | Account-specific explanation | Journey choice never converts existing privileged accounts. |

Passenger signup/login uses `intent=passenger` and continues `/book` or the allowlisted existing booking destination. Neutral login keeps established routing. Approval preserves the same user ID and historical ride ownership. Within the existing single-role model, approved drivers cannot create new passenger bookings; choosing a passenger navigation link cannot overwrite their driver privileges. Approval remains under review while an existing passenger trip is active, with a clear operations message to finish or cancel it first.

## Migration and security boundary

`0010_driver_application_journey.sql` reuses the existing unique application-per-user constraint and `pending`, `under_review`, `verified`, `rejected`, `suspended` states. It replaces application/edit/submit/review functions, adds private applicant/booking lock helpers, revokes direct sensitive table writes and narrows private document Storage policies. Profile-before-application lock order serializes retries, writes, submission and trusted review. Only verified administrative review promotes a passenger to operational driver.

The migration does not bulk-create applications, reinterpret untrusted Auth metadata as privileges, modify existing review history, or change existing native operational guards. Driver Mobile still requires the trusted driver role; passenger applicants cannot use availability, offer acceptance or active-trip operations.

## Verification evidence

All Auth and Storage writes below used a **new disposable local** `hatidone-registration-qa` Supabase project at loopback ports 56321/56322, confirmation enabled and a local Mailpit inbox at 56324. Each fixture account had an independently generated private credential. Chrome used a fresh temporary profile, never the owner's profile. No real email recipient, personal identity document or existing local backend was used.

| Check | Result and evidence |
| --- | --- |
| Web unit/security regressions | **PASS**: independent Node 24 run, 89 tests in 23 files. Includes journey allowlist, actions, callback/proxy, application retry, recovery, own history and waiting-for-active-booking review response. |
| TypeScript, lint, production build | **PASS**: lead's final affected web checks; production build generated 33 routes. No disabled checks. |
| Build credential scan | **PASS**: lead's 25 client files checked for privileged credential patterns. Public local URL/anon configuration is expected in this local build. |
| Real SQL/RLS, clean and upgrade | **PASS**: disposable harness, each database runs 41 application + 58 RC1 + 74 security assertions; 11 concurrency/security cases. Log `/tmp/hatidone-driver-registration-db-final.log`. |
| Concurrent application lifecycle | **PASS**: two simultaneous starts produce one pending application and one audit event. Observed actual lock waits prove edits blocked behind submit/approval cannot change data after commit; a booking checked before approval but waiting at insertion is rejected after role promotion. Existing six ride/cash concurrency cases also pass. |
| Browser full journey | **PASS**: 28 actual Chrome/Auth/Storage checks; [machine-readable results](screenshots/driver-registration/after/journey-results.json). |
| Local resend/cross-browser/password recovery | **PASS**: 9 additional actual browser/Auth checks; [results](screenshots/driver-registration/after/auth-resume-results.json). |
| Responsive discovery | **PASS**: home, signup and login at 360, 390, 430, 768 and 1440 CSS pixels. Fifteen before and fifteen after snapshots; no horizontal overflow. After-change mobile homepage driver action is in the initial viewport. |
| Final whitespace check | **PASS**: `git diff --check`. |
| Native checks this phase | **NOT RUN**: no native or shared mobile source changed; existing server-side operational denials are tested against the pending account. No native build or physical-device claim. |
| Hosted delivery, hosted redirect allowlist/templates, production journey | **BLOCKED / not exercised**: requires owner configuration and a separately authorized deployment. Local captured mail is not evidence of hosted delivery. |

The full browser run proves contextual and generic signup selection, same-route Apply navigation, ordinary-input preservation, reload without password persistence, confirmation-required driver and passenger signup, local real confirmation, read-only callback/resolver, explicit draft creation, save/reload, actual >1 MB private driver/vehicle uploads, submission, outsider Storage download denial, trusted rejection with visible reason, replacement/resubmission, approval and same-identity dashboard access. It also proves approved-driver own history access, existing-passenger application/history, switch-account intent, and invalid callback rejection. Admin decisions in this run use the existing authenticated review RPC against the disposable backend; SQL verifies the submitted review queue predicate. Visual admin queue interaction is **NOT RUN**.

The separate live Auth run verifies the resend response retains driver intent, a confirmation opened in a second fresh browser cannot transplant PKCE state, and signing in there with the same confirmed account resumes the application resolver. It also verifies an ordinary app session cannot reset a password, the actual local reset email/callback establishes isolated recovery authorization, successful password update retains a driver-context sign-in link, recovery authorization is cleared afterward, and an invalid recovery code fails closed. The resend test verifies the provider-safe response; it does not assert a second email was delivered despite the provider's resend throttle. No hosted email delivery is claimed.

Unit tests cover bootstrap failure/retry without a second signup, malformed/external redirect inputs, provider-safe errors, forged fields, and supported callback/recovery compatibility. SQL tests directly exercise RLS/privileges, ownership, document isolation, restricted-account denial and operational denial. These checks do not substitute mocks for database authorization.

Browser scripts are dependency-free CDP checks using installed Chrome and Node's WebSocket: `scripts/qa-driver-registration-browser.mjs`, `scripts/qa-driver-registration-journey.mjs`, and `scripts/qa-driver-registration-auth-resume.mjs`. The journey runner expects the freshly seeded isolated fixture state; it is not a production smoke script. Credentials and local confirmation URLs stay in memory and are not emitted into evidence. Temporary stack configuration/credential files remain ignored beneath `.local-backend/registration-qa`.

## Screenshots

| View | Before | After |
| --- | --- | --- |
| Homepage, 360 | [Before](screenshots/driver-registration/before/home-360.png) | [After](screenshots/driver-registration/after/home-360.png) |
| Homepage, 1440 | [Before](screenshots/driver-registration/before/home-1440.png) | [After](screenshots/driver-registration/after/home-1440.png) |
| Signup, 360 | [Before](screenshots/driver-registration/before/signup-360.png) | [Driver context](screenshots/driver-registration/after/signup-driver-360.png) |
| Signup, 1440 | [Before](screenshots/driver-registration/before/signup-1440.png) | [Driver context](screenshots/driver-registration/after/signup-driver-1440.png) |
| Application, ready | Not available before targeted fix | [390](screenshots/driver-registration/after/onboarding-ready-390.png) |
| Submitted status | Not available before targeted fix | [390](screenshots/driver-registration/after/onboarding-submitted-390.png), [1440](screenshots/driver-registration/after/onboarding-submitted-1440.png) |

All public width measurements are in [before](screenshots/driver-registration/before/measurements.json) and [after](screenshots/driver-registration/after/measurements.json). Web UX independently inspected the 360/1440 homepage and signup and the submitted application screenshots. Normal page scrolling is intentional; there is no nested viewport-scrolling workaround.

## Changed files for this task

Paths below are relative to the repository; web entries are under `apps/web/`.

- Discovery and account UI: `app/page.tsx`, `app/drivers/page.tsx`, `app/(protected)/account/page.tsx`, `components/public-navigation.tsx`, `components/marketing/acquisition.tsx`, `components/app-shell.tsx`, `app/globals.css`.
- Signup/login presentation: `app/signup/page.tsx`, `app/login/page.tsx`, `components/auth-form.tsx`, `components/signup-journey.tsx`, `components/password-field.tsx`.
- Auth contracts: `app/auth/actions.ts`, `app/auth/callback/route.ts`, `app/auth/profile-error/page.tsx`, `lib/auth/journey.ts`, `lib/auth/redirects.ts`, `lib/supabase/proxy.ts`.
- Recovery context: `app/auth/recovery/actions.ts`, `app/auth/recovery/callback/route.ts`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`.
- Application and review: `app/(protected)/driver-application/page.tsx`, `app/(protected)/driver-application/actions.ts`, `app/(protected)/driver/onboarding/page.tsx`, `app/(protected)/driver/onboarding/actions.ts`, `app/(protected)/driver/page.tsx`, `lib/driver/data.ts`, `app/(protected)/admin/operations/page.tsx`, `app/(protected)/admin/operations/actions.ts`, `lib/booking/data.ts`.
- Build/test configuration: `next.config.ts`, `vitest.config.mts`, and adjacent auth, application-action, review-action, booking-data, journey and proxy regression tests.
- Database: `supabase/migrations/0010_driver_application_journey.sql`, `supabase/config.toml`, `supabase/tests/driver_application_test.sql`, `supabase/tests/security_test.sql`, `supabase/tests/concurrency.py`.
- Evidence and documentation: the three `scripts/qa-driver-registration-*.mjs` runners, `docs/screenshots/driver-registration/`, this report, `docs/SOLO_DEVELOPER_RUNBOOK.md`, and `docs/schema-requests/PRODUCT_CONTRACTS.md`.

## Owner configuration before hosted use

1. Apply migration 0010 through the normal reviewed migration process after the required RC1 migration prerequisites; no dashboard-only schema edits.
2. Set the actual site's `NEXT_PUBLIC_SITE_URL` to its approved HTTPS origin and use the existing project's public Supabase URL/anon key. Do not add a service-role key to public configuration.
3. In that project's Auth URL configuration, add `https://YOUR_APPROVED_HOST/auth/callback**` and `https://YOUR_APPROVED_HOST/auth/recovery/callback**` for the approved host so query context survives, alongside existing invitation/native URLs. Local `supabase/config.toml` documents localhost/127.0.0.1 port 3003 callbacks and retains native patterns; this did not change a running or hosted project's settings.
4. Ensure confirmation/recovery templates use the provider's generated confirmation URL rather than replacing it with a bare site URL. Preserve the app-provided redirect/context. Confirm the configured mail provider delivers to intended pilot addresses; do not disable confirmation as a testing shortcut.
5. Exercise deployed confirmation, resend and recovery once deployment is separately authorized. PKCE browser state is not portable: if confirmation opens elsewhere, the app offers driver-context sign-in/resend using the same account. Password reset requires the browser that requested the link; an ordinary app session does not authorize resetting a password.

## Exact user paths

**New driver:** Homepage **Apply to drive** → `/signup?intent=driver` → create account → confirm email when required → `/driver-application` → **Start application** → `/driver/onboarding` → save personal/vehicle details and required private documents → **Submit application** → return to **Application submitted** → `/driver` after trusted approval.

**Existing passenger:** **Account → Driver application → Apply to drive**, or the public **Apply to drive** action → sign in at `/login?intent=driver` if needed → `/driver-application` with current identity → **Start application** → same onboarding and review flow. No second identity or email is needed; passenger history remains owned by the same account.

**Passenger:** **Book a ride** → passenger-context signup/login → confirmation when required → `/book` or the authorized booking continuation.

## Cleanup

Browser sessions used only temporary Chrome profiles and were closed. The dedicated local registration Supabase stack was stopped after verification; existing stacks were left running. The lead owns stopping the local Next3139 server. Ignored QA configuration and individually generated credential files remain mode 0600 for local reproducibility; they are not report artifacts or committed secrets.

The lead also stopped the temporary Next server on port 3139 after the final browser run.


## Follow-up: Supabase email-confirmation policy

This section updates the earlier registration verification. Supabase is the sole source of the signup confirmation requirement. There is no `NODE_ENV`, demo, URL, or application confirmation flag.

### Confirmed findings and changes

- The previous web implementation already continued immediately for a returned session. No unconditional email screen, stale `email_verified` gate, or callback-only application bootstrap was found. Normal profile initialization still uses the existing database bootstrap, and server guards independently verify the authenticated user.
- A callback-URL preflight could reject signup **before calling Supabase**, even when confirmation was disabled. `apps/web/app/auth/actions.ts` now sends a safe configured callback when available without making it a prerequisite for a session-returning signup. If no session is returned and the callback is missing, the page explains the configuration problem and preserves same-account sign-in/retry context.
- Empty/malformed results could fall through to a confirmation continuation. `packages/core/src/signup-result.ts` now classifies a successful valid session, a user with explicitly no session, and failed/unexpected responses. Errors take precedence; no success is inferred from absent data. Web actions and `packages/mobile/src/auth.tsx` use this shared classifier. The internal workspace dependency is declared in `packages/mobile/package.json` and `package-lock.json`; no external library versions changed.
- The generic SSR cookie adapter swallowed cookie-write errors for read-only Server Components. Auth actions and the existing callback now require successful cookie writes. The installed Supabase SDK saves the session and awaits its SSR cookie subscriber before the awaited signup resolves. Read-only Server Component behavior is preserved. Native SecureStore/localStorage, auth events, refresh and deep-link behavior are unchanged.
- Driver application initialization still uses the existing authenticated, idempotent operation. It never changes role/approval based on confirmation policy. No migrations, RLS, review requirements, MFA, password requirements, recovery security, invitations or native operational permissions were changed in this follow-up.

### Expected paths

| Actual Supabase signup response | Passenger | Driver |
| --- | --- | --- |
| Error, absent or malformed result | Recoverable signup error; no protected redirect | Same; no application initialization |
| Valid session (confirmation OFF) | Session cookies persisted → `/book` or authorized booking continuation | Session cookies persisted → start/resume own unapproved application → `/driver/onboarding` or actual existing status; no email screen or extra login |
| User, no session (confirmation ON) | Unauthenticated confirmation/sign-in continuation → selected passenger destination | Unauthenticated continuation → supported callback/sign-in → `/driver-application` and explicit Start when no draft exists → onboarding/status |
| Authenticated driver signup, application service fails | Not applicable | Current account retained → actionable retry → one own application when the service recovers |

Automatic email acceptance under Supabase's development setting is not driver approval or proof that someone manually checked the inbox. Existing users were not automatically confirmed, deleted or recreated. Existing-account problems must use normal sign-in/confirmation/recovery and be investigated separately.

### Follow-up verification

The same production web build was used with the isolated local Supabase policy OFF and ON; no application setting or code changed between them. Only the isolated backend was restarted, without a database reset. Test-only labels in `scripts/qa-confirmation-policy.mjs` specify assertions; they are never passed to the application as policy overrides. Tests used new fictional identities and local captured email; credentials and confirmation links were not printed.

| Check | Result |
| --- | --- |
| Real confirmation OFF | **PASS — 21 checks**: both signup journeys immediately receive persisted session cookies and reach `/book` or `/driver/onboarding`; refresh and logout/login work; one pending application; repeated requests stay idempotent; trip acceptance, availability, self-approval and role escalation denied. [Evidence](qa/confirmation-off.json) |
| Real confirmation ON | **PASS — 26 checks**: no-session accounts cannot enter protected pages or create applications; actual local email confirmation restores passenger/driver intent; cookies survive refresh and login; identical pending-driver security denials. [Evidence](qa/confirmation-on.json) |
| Real application setup failure/retry | **PASS — 4 checks**: the disposable application's execute permission was temporarily revoked, then restored in `finally`; signup retained the authenticated account and offered retry; retry created one own draft. No new signup or login was required. [Evidence](qa/confirmation-retry.json) |
| Duplicate-email and failed signup | **PASS**: both actual policy runs exercise provider-safe duplicate/error responses; web unit tests separately verify the resulting safe UI redirects and absence of application writes. |
| Missing/unexpected responses and cookie errors | **PASS, mocked/pure tests**: no success inferred from empty data or incomplete sessions; error precedence; callback absence does not block authenticated signup; failed cookie persistence is surfaced. These are not presented as real provider faults. |
| Unit tests | **PASS — 95 web tests and 18 core tests**, including the shared result classifier. |
| Workspace TypeScript and lint | **PASS**, including both mobile apps and the shared core consumer. |
| Web production build | **PASS — 33 routes**; 25 client build files passed privileged-credential pattern scanning. |
| Mobile SDK compatibility | **PASS**, both Expo dependency checks. Native storage/refresh implementation unchanged. |
| Native emulator/device signup and app restart | **NOT RUN** in this follow-up. Web browser refresh/logout/login and mobile type/lint/compatibility checks are separate evidence. |
| Hosted project setting, delivery and deployed behavior | **NOT RUN / owner configuration pending**. Local policy changes do not update hosted Supabase. |

Additional regression files are `packages/core/src/signup-result.test.ts`, `apps/web/app/auth/actions.test.ts`, and `apps/web/lib/supabase/server.test.ts`. The callback's existing tests also passed with strict cookie persistence. The new test runner requires the explicitly isolated loopback QA backend and its ignored private fixture files; it refuses a hosted Supabase URL. Existing RLS and migration files were not edited for this correction.

The host's current native Supabase CLI could not start because of a system ICU dependency. Verification used the repository's existing Docker CLI approach instead, with no dependency upgrade or host modification. This did not block either real policy test.

### Required development configuration

**Hosted development:** owner opens the development project's Authentication settings, locates **Confirm email**, disables it, and saves. This task did not change any hosted setting, send hosted email, or deploy code. Keep the configured site/callback allowlist ready for later confirmation-enabled use.

**Supabase CLI:** the repository already has exactly one `[auth.email]` section with `enable_confirmations = false`. Only explanatory comments were added. After changing it, restart local services with `npm run backend:stop` and `npm run backend:start`; do not reset the database. Local `config.toml` does not update a hosted project. This verification restarts only the isolated registration QA stack, leaving existing local projects untouched.

Follow-up cleanup: the temporary Next server on port 3139 and the isolated registration QA Supabase stack were stopped after both policy runs. Existing local projects were left running; no database reset or hosted change was performed.
