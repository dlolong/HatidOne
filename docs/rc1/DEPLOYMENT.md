# RC1 deployment preparation

Status: preparation only. No hosted endpoint, migration, backup, restore, signing or deployment was performed by the operations engineer. See RELEASE_REPORT.md and QA.md for integrated evidence. The repository has no previously configured hosting target; Next.js production build/start is retained without selecting a paid host.

## Configuration

Use Node 24 and npm. Keep `.env.local`/mobile `.env` ignored. Configure values on the authorized host; do not paste secrets into reports.

| Variable name | Scope | Release requirement |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser/server | Intended staging/production Supabase HTTPS origin |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser/server | Public publishable/anon key only |
| `NEXT_PUBLIC_SITE_URL` | browser/server auth redirect | Intended web HTTPS origin |
| `HATIDONE_ENVIRONMENT` | server | `staging` or `production` |
| `HATIDONE_DEMO_MODE` | server | `false` |
| `EXPO_PUBLIC_APP_ENVIRONMENT` | each native build | `staging` or `production` |
| `EXPO_PUBLIC_SUPABASE_URL` | each native build | Same intended backend |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | each native build | Public publishable/anon key only |

No service-role key is required for the app runtime. Database migration authorization belongs to the owner/secure administrative tooling, never public client variables. Maps, payment gateway, SMS and push credentials are not required for the manual slice and those integrations must not be described as live. Environment validation prints names/problems only. It cannot prove a project identified as staging is actually disposable: owner must verify project identity and data isolation.

```sh
npm ci
npm run check:env:release
npm run build:release
npm start
```

These commands prepare/run the existing server, default port 3003; they do not publish. Public web config is bundled at build time: rebuild when switching backend. Native preview builds also require explicit backend selection and rebuild. Do not distribute a staging binary against production by silently changing environment configuration.

## Migration and deployment order

1. Identify the exact authorized staging project and its migration history read-only. Record project reference without credentials. Confirm that it contains fictional or explicitly approved test data.
2. The repository retains two historical `0004` migrations. The local runner stages renumbered copies solely for its local backend. **Do not use `.local-backend` migrations for a hosted database or run an unreviewed `supabase db push`.** Hosted history mapping is BLOCKED until the owner compares applied versions and content and approves a project-specific reconciliation plan. Do not edit applied migrations.
3. Freeze booking intake on the old release and **drain all existing assigned/active rides before migration 0009**. Its preflight aborts rather than rewrite accepted legacy trips. Check on the specifically authorized target:

   ```sql
   select status, count(*) from public.ride_requests
   where status in ('assigned','driver_en_route','driver_arrived','trip_started')
   group by status;
   ```

   Expected result: zero rows, confirmed again immediately before application while intake/dispatch remains frozen. Requested legacy prices remain pending operator review and passenger acceptance; they are never silently promoted. Do not cancel real trips merely to make this check pass.
4. Run `npm run test:db` against its disposable container. It creates no hosted connection. Inspect QA evidence for clean and upgrade coverage. Rehearse the approved migration sequence on a separate disposable target before authorized staging application.
5. Confirm a backup/restore recovery point before hosted mutation. Backup existence and restore have not been verified. Preserve old binary and server build references and migration hashes.
6. Apply only reviewed missing migrations with authorized administrative tooling. Deploy the matching web build. Keep bookings paused until smoke tests pass. SQL schema changes precede app versions that query new columns/RPCs.
7. For the invited beta, disable public self-signup in the authorized Supabase Auth project and verify direct public signup rejection; provision only individual invited test accounts. This hosted control has not been changed or verified here. Configure Supabase Auth site/redirect allowlists for the chosen HTTPS site and the distinct native schemes in the app configs. Verify email confirmation and password reset deliveries with individual fictional accounts. Never add testers as project administrators. Native SDK RPCs authenticate directly to Supabase; they do not require Next cookie sessions or a web CORS proxy. Test allowed web origins and avoid broad credentialed CORS.
8. Install both preview apps against that backend and perform the same booking through request, reviewed quote, acceptance, assignment, driver reconfirmation, PIN start, completion and separate cash report/reconciliation. Close Metro and local Next first. Record versions, anonymized booking ID and observed events. This test is currently an owner/device gate.

## Health and smoke tests

`GET /api/health` is public, uncached liveness returning `{ "status": "alive" }`. It makes no database, email, monitoring or legal-readiness claim. `GET /api/readiness` requires a current active admin cookie session; it checks that admin authorization and an `app_config` read work. Unauthenticated access returns 401; non-admin access 403; dependency failure 503. No sensitive diagnostics or provider credentials are returned.

For an authorized target, set a shell variable to its verified HTTPS origin, then `curl --fail "$HATIDONE_STAGING_ORIGIN/api/health"`. Check readiness through the signed-in administrator browser. Verify cross-user reads fail, paused/closed-area requests fail, existing active trips still progress, quote changes require a new acceptance, cash remains pending after completion, and demo RPCs fail. Do not infer RLS protection from an HTTP 200 health response.

## Backup and recovery rehearsal

Owner action: use the hosting provider's approved backup/export tooling, store it privately, restore into an explicitly authorized **disposable** project/database with outbound integrations disabled, then run migration and read-only consistency checks plus fictional-account lifecycle tests. Compare counts and critical invariants without exporting passenger/location/identity records into reports. Record backup time, restore time, schema version and result. No destructive restore command is provided because no target or backup authority has been established.

During an incident pause new bookings and retain access to confirmed/active trips. Contact participants using the agreed channel, record incident/recovery reason, and reconcile uncertain mutations before retrying. Roll the app/server back only to a build verified compatible with the expanded schema. Never roll back by dropping financial/audit tables or replaying seed data. If server controls are unavailable, stop accepting requests operationally and restore service before editing records. Keep existing trips under human supervision.


## Password recovery delivery gate

Web recovery is implemented at `/forgot-password` → `/auth/recovery/callback` → `/reset-password`, using the installed Supabase PKCE reset API. The callback validates the recovery flow and calls `getUser`; password update uses only that verified identity. Separate HttpOnly `hatidone-recovery` cookies avoid replacing the normal signed-in app account, are retained for 15 minutes by the browser, and are cleared after update. An ordinary app session or a URL to the password form does not authorize reset. Missing/expired/replayed/wrong-browser links return to the request page. Email responses do not disclose account existence or promise delivery.

Owner staging action: add the **exact** intended HTTPS origin plus `/auth/recovery/callback` to the Supabase Auth redirect allowlist, alongside the existing `/auth/callback` signup route. Verify that the configured recovery email template preserves the supplied redirect destination and PKCE `code`; do not replace it with a raw access-token URL. If the installed SDK's optional `sb_flow_id` mode is enabled later, keep that parameter through the callback and review the allowlist accordingly. Never enable arbitrary external return URLs.

With a single fictional invited account, request a reset from the deployed web login page and open the email in the same browser within 15 minutes (the provider may expire the link sooner). Set a new password, then separately sign in with it; verify the old password fails, the consumed link cannot be replayed, missing/expired recovery is rejected, and an unrelated existing browser account was not replaced. Opening a reset email in another app/browser lacks its PKCE verifier: start again in the intended browser. Installed-native recovery may open this page only through an explicitly owner-configured HTTPS web origin; cross-app deep-link behavior remains unverified.

No reset emails were sent by the agent and no actual recovery delivery, provider policy, or native deep-link test ran. The missing gate is **delivery/integration verification**, not missing web recovery code. Provider rate limits still apply; retries do not imply delivery. References checked: [Supabase reset API](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail) and [Supabase SSR/PKCE guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide), plus the installed SDK source.


Local fixture tooling now prepares individual random passwords in ignored mode-0600 `.local-backend/test-accounts.json`, passing them through a mode-0600 staged seed with non-returning `DO/PERFORM` settings. The canonical seed is never given a shared fixed password. All Supabase CLI stdout/stderr is captured and suppressed because initialization/status/errors can include privileged credentials; `backend:status -- --json` returns only the local API URL and checked public anon/publishable key used by `demo:env`. No service-role or database URL is forwarded. Existing local accounts/files were not regenerated or reset during this work. Ordinary start preserves the private account file; only an explicitly confirmed disposable reset rotates it. `test:http` reads that file without a shared fallback and cannot authenticate an unchanged legacy backend with newly prepared values.
