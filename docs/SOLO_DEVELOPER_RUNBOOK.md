# Solo developer runbook

## First setup

```sh
nvm use # Node 24; install with nvm install if absent
npm ci
npm run backend:start
npm run demo:env
```

Docker must be running. Ports 55320–55324 are reserved for this project. On macOS the runner builds a cached Linux CLI image from `scripts/Dockerfile.cli` (Node24 and Docker CLI), avoiding a native CLI ICU incompatibility on older macOS. Set `HATIDONE_DOCKER_CLI=false` to use a compatible native CLI. First start may download container images. The `hatidone-cli-cache` volume caches CLI packages.

The runner copies the repository config/seed and ordered migrations to `.local-backend/supabase`; duplicate historical `0004` versions receive unique local staging numbers. The tracked migrations are not renamed. This staging directory must never be used for remote deployment or migration repair.

`demo:env` reads local CLI status internally and writes only public URL/anon key plus explicit demo flags. Existing env files are kept. It never copies the service-role key. For a real device, edit both mobile `.env` URLs to your computer’s LAN IP (`http://YOUR_LAN_IP:55321`) and the driver's `EXPO_PUBLIC_WEB_URL` to port 3100. Keep phone and computer on the same network.

## Daily terminals

```sh
npm run backend:start # reuses the isolated local stack
npm run dev # web :3100
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

`demo:seed` also resets the local database; it is not an additive production seed. Seeded users/businesses are fictional and share `DEMO-ONLY-HatidOne!42`. Use a private/incognito window per role. Seed document metadata is fictional; upload actual fictional test files through onboarding when testing signed document downloads or review.

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
