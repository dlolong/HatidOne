# Solo developer runbook

## First setup

```sh
nvm use # Node 24; install with nvm install if absent
npm ci
npm run backend:start
npm run demo:env
```

Docker must be running. Ports 55320–55324 are reserved for this project. On macOS the runner builds a cached Linux CLI image from `scripts/Dockerfile.cli` (Node24 and Docker CLI), avoiding a native CLI ICU incompatibility on older macOS. Set `HATIDONE_DOCKER_CLI=false` to use a compatible native CLI. First start may download container images. The `hatidone-cli-cache` volume caches CLI packages.

The default stack excludes optional Studio, its metadata API, image transformations, and Edge Runtime. Auth, database, REST, Storage, and Realtime remain enabled. To use Studio at `http://localhost:55323`, run `npm run backend:stop` followed by `HATIDONE_STUDIO=true npm run backend:start`. Running several Supabase projects in a shared 3 GB Docker VM can cause startup health checks to time out; stop unused projects yourself or increase Docker memory if needed.

The runner copies the repository config/seed and ordered migrations to `.local-backend/supabase`; duplicate historical `0004` versions receive unique local staging numbers. The tracked migrations are not renamed. This staging directory must never be used for remote deployment or migration repair.

`demo:env` reads local CLI status internally and writes only public URL/anon key plus explicit demo flags. Existing env files are kept. It never copies the service-role key. For a real device, edit both mobile `.env` URLs to your computer’s LAN IP (`http://YOUR_LAN_IP:55321`) and the driver's `EXPO_PUBLIC_WEB_URL` to port 3003. Keep phone and computer on the same network.

## Daily terminals

```sh
npm run backend:start # reuses the isolated local stack
npm run dev # web :3003
npm run dev:passenger # Expo :8081
npm run dev:driver # Expo :8082
```

Use Expo’s terminal instructions to open a compatible development client or simulator. SDK54 app bundles need a compatible Expo client; current store clients may target a newer SDK. A device build requires normal Apple/Android tooling, but no maps/payment/push credentials. Background location is deliberately disabled.

## Check before committing

```sh
npm run typecheck
npm run lint
npm test
npm run test:db
npm run test:http # local demo stack only; adds labeled test records
npm run build
npm run check:mobile
```

Database tests create a separate disposable Supabase PostgreSQL container with minimal Auth/Storage schema fixtures, apply every migration and seed, and execute real RLS/RPC assertions. The separate `npm run test:http` exercises the real local Auth/REST stack. Neither suite tests a hosted deployment or native devices. Read the final report for test limits.

## Seed/reset

```sh
npm run demo:reset # destroys local demo records and recreates fixtures
npm run demo:env # only creates missing env files
```

`demo:seed -- --confirm-local-reset` also resets the local database; it is not an additive production seed. Seeded users/businesses are fictional. Each user has an individual random password stored by local preparation in ignored `.local-backend/test-accounts.json` (0600). Open that file privately; never print or share its contents. Ordinary start preserves it; an explicitly confirmed disposable reset rotates it. Existing backend accounts do not change just because a new file is prepared. After a failed reset, `.local-backend/test-accounts.previous.json` retains the previous private credentials until a successful reset; treat it as sensitive too. Use a private/incognito window per role. Seed document metadata is fictional; upload actual fictional test files through onboarding when testing signed document downloads or review.

## Logs and exceptions

```sh
npm run backend:status
docker ps --format '{{.Names}}'
docker logs --tail 100 supabase_db_hatidone-local
docker logs --tail 100 supabase_auth_hatidone-local
```

Web/Expo logs stay in their terminals. Operations: `/admin/operations` → audit/safety/backup/verification. Dispatch: `/admin/dispatch`. Expire offers with the existing manual control; no scheduler is running. For an unconfirmed scheduled ride, inspect primary confirmation and use manual backup activation before the primary heads to pickup.

## Builds

```sh
npm run build
npm --workspace apps/web start
npm exec --workspace apps/passenger-mobile -- expo export --platform all
npm exec --workspace apps/driver-mobile -- expo export --platform all
```

Export writes ignored `dist` assets for web/iOS/Android. Device binaries, signing and store submission are separate work. `npm audit` reports dependency advisories; do not apply a forced Expo major upgrade without coordinating React Native and native validation.

## End of day / remote changes

```sh
npm run backend:stop
```

Before any hosted schema deployment, reconcile the repository's two historical `0004` migration versions against that project's actual migration history. Back up data and apply new migrations in order. No sprint command performs a remote push, repairs hosted history, or sets hosted demo flags.

## Mobile UI and simulator workflow

Run `npm run mobile:doctor` before a native build and `npm run mobile:check` for both app checks. Use `npm run mobile:passenger` and `npm run mobile:driver` after installing their separate development clients. For browser-only previews, use `npm --workspace apps/passenger-mobile run web` and `npm --workspace apps/driver-mobile run web`. See [MOBILE_SIMULATOR_GUIDE.md](MOBILE_SIMULATOR_GUIDE.md) for exact iOS/Android build, GPS and localhost commands; [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) defines the shared UI conventions.


### Passenger registration and driver applications

Use `/signup?intent=passenger` for booking and `/signup?intent=driver` for driving. Generic `/signup` requires choosing a journey. Existing passengers use Account → Driver application → Apply to drive; no second signup is needed. `/driver-application` reads the current state; only its Start application POST (or an authenticated driver signup POST) creates a pending draft. `/driver/onboarding` contains saved details, private uploads, submission and review/correction status. Applying preserves passenger role and history; only operations approval grants driver role.

Apply migration `0010_driver_application_journey.sql` after the existing migration history has been reconciled; do not manually renumber previously applied migrations. Before hosted rollout, configure the trusted `NEXT_PUBLIC_SITE_URL` and allow the same origin’s `/auth/callback` with journey query parameters in Supabase Auth. Password recovery continues using `/auth/recovery/callback` and its separate cookies. Confirmation links use PKCE: open them in the browser that requested them, or retain `intent=driver` when returning to sign in/request another confirmation link. Do not treat a different-browser failure as permission to bypass confirmation. See [driver registration report](DRIVER_REGISTRATION_REPORT.md) for verification evidence and owner-only rollout steps.


### Supabase controls signup confirmation

The application does not have a separate confirmation flag. Supabase signup returning a valid session immediately opens `/book` (or the authorized booking continuation) for passengers. Driver signup starts/resumes the same account’s pending application and opens `/driver/onboarding` or its existing review status. The web SSR client writes session cookies before redirecting. Native storage and auth-event refresh behavior are unchanged.

A successful response containing a user but **no session** stays unauthenticated and retains the selected passenger/driver context through confirmation/sign-in. A missing or malformed response is a retry error, not a success or delivery claim. Email-confirmation policy never grants driver approval. Missing web callback configuration does not block a session-returning signup; configure the trusted callback before using confirmation-enabled signup or recovery.

For the **hosted development project**, the owner must open that project’s Authentication settings, locate **Confirm email**, disable it, and save. No hosted setting was changed by this code update. The existing `[auth.email]` section in `supabase/config.toml` already has `enable_confirmations = false`; local configuration does not update hosted projects.

After changing local Supabase settings, restart the local services with `npm run backend:stop` followed by `npm run backend:start`. Do **not** use `demo:reset` or reset the database just to apply this setting. The test run restarted only its isolated registration QA stack; your existing local backend was not restarted. When enabling confirmation later, keep the trusted site URL, callback allowlist and mail configuration described in [the registration report](DRIVER_REGISTRATION_REPORT.md); registration code needs no policy switch.

Existing-account issues are separate from new signup policy: try normal sign-in and the established confirmation/password-recovery paths using the same account. This change does not automatically confirm, delete, recreate or alter old accounts. No existing-account remediation was performed.
