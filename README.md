# HatidOne

Driver-first, reliability-first Philippine scheduled mobility. Next.js operations and passenger web, separate Expo passenger/driver apps, Supabase/PostgreSQL/PostGIS, and shared local route/matching providers. The RC1 pilot policy keeps driver platform commission at **0%**; business subscriptions use manual billing.

## Start locally

Requires Node 24 (`nvm use`) and Docker. No paid API keys are needed.

```sh
npm ci
npm run backend:start
npm run demo:env
npm run dev
# Separate terminals:
npm run dev:passenger
npm run dev:driver
```

Web: http://localhost:3003. Local Supabase API: http://127.0.0.1:55321. Studio is optional: stop the local backend, then run `HATIDONE_STUDIO=true npm run backend:start` to enable it at http://localhost:55323. The first local backend start applies migrations and fictional seed data. `npm run demo:reset -- --confirm-local-reset` deletes and recreates **only this disposable local demo backend**; do not run it against valuable local data. Public landing pages also work with no backend; protected pages explain setup.

Demo login: `passenger@hatidone.test`, `driver@hatidone.test`, `admin@hatidone.test`, `fleet@hatidone.test`, `partner@hatidone.test`, or `corporate@hatidone.test`. Each account has its own random password in the ignored private file `.local-backend/test-accounts.json` (mode 0600). Open it privately in your editor; do not print, share or commit it. New backend initialization uses that file; ordinary start preserves it. An older running backend keeps its existing credentials until you explicitly run `npm run demo:reset -- --confirm-local-reset` on disposable data. No account credentials were generated or changed during this implementation.

For an existing Supabase project, copy `.env.example` to `apps/web/.env.local` and each mobile app’s `.env.example` to its `.env`, then supply only public URL/anon key. Never put a service-role key in Expo/browser configuration. Physical devices need your computer’s LAN IP instead of localhost. The real pilot path uses manual address/landmark review and an operator quote accepted by the passenger; no verified maps provider is assumed. Foreground GPS is optional. Run `npm run check:env:release` before release builds.

## Verify

```sh
npm run verify:code
npm exec --workspace apps/passenger-mobile -- expo export --platform all
npm exec --workspace apps/driver-mobile -- expo export --platform all
```

`verify:code` runs typecheck, lint, unit tests, web build, Expo compatibility and disposable database checks; its success is code evidence only. `npm run verify:rc1` additionally reports unexecuted deployed/device gates and exits nonzero; it is not an automatic release approval.

`test:db` starts and removes its own disposable PostgreSQL container; it never connects to a hosted database. Mobile bundle export is not a substitute for device testing.

Password recovery is available from web Login → **Forgot your password?** It requires a configured web origin, an allowed Supabase recovery callback and actual email delivery. Open reset links in the requesting browser; see [deployment recovery checks](docs/rc1/DEPLOYMENT.md).

## Structure and operation

- `apps/web`: booking, driver onboarding, dispatch, operations, organizations, referrals, acquisition pages.
- `apps/passenger-mobile`, `apps/driver-mobile`: separate Expo Router apps.
- `packages/types`: shared ride state machine; `packages/core`: routes, deterministic matching, provider interfaces; `packages/mobile`: secure sessions, native UI, resource loading and chat.
- `supabase/migrations`: append-only schema. Historical duplicate `0004` versions are preserved; the local runner stages uniquely numbered copies in ignored `.local-backend/`. **Never deploy those local copies to an existing remote migration history.**

RC1 evidence and owner gates supersede earlier completion claims: [release report](docs/rc1/RELEASE_REPORT.md), [deployment](docs/rc1/DEPLOYMENT.md), [operator runbook](docs/rc1/PILOT_RUNBOOK.md), [owner actions](docs/rc1/OWNER_ACTIONS.md), and [pilot gates](docs/rc1/PILOT_GATES.md). No hosted/no-laptop test or signed native artifact is implied by a JavaScript export.

See [demo scenarios](docs/DEMO_SCENARIOS.md), [solo developer runbook](docs/SOLO_DEVELOPER_RUNBOOK.md), [production integrations](docs/PRODUCTION_INTEGRATIONS.md), and [completion report](docs/FINAL_COMPLETION_REPORT.md) for tested scope and remaining launch work.

## UI and mobile development

See [Design system](docs/DESIGN_SYSTEM.md), [UI/UX completion report](docs/UI_UX_COMPLETION_REPORT.md), and [Mobile simulator guide](docs/MOBILE_SIMULATOR_GUIDE.md). Run `npm run mobile:doctor` to check local native prerequisites. The guide covers local development builds and browser previews for both apps.
