# HatidOne

Driver-first, reliability-first Philippine scheduled mobility. Next.js operations and passenger web, separate Expo passenger/driver apps, Supabase/PostgreSQL/PostGIS, and shared local route/matching providers. Default driver platform commission is **0%**, configurable by administrators; business subscriptions use manual billing.

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

Web: http://localhost:3100. Local Supabase API: http://127.0.0.1:55321. Studio: http://localhost:55323. The first local backend start applies migrations and fictional seed data. `npm run demo:reset` resets **only this local demo backend**. Public landing pages also work with no backend; protected pages explain setup.

Demo login: `passenger@hatidone.test`, `driver@hatidone.test`, `admin@hatidone.test`, `fleet@hatidone.test`, `partner@hatidone.test`, or `corporate@hatidone.test`. Shared local-only password: `DEMO-ONLY-HatidOne!42`.

For an existing Supabase project, copy `.env.example` to `apps/web/.env.local` and each mobile app’s `.env.example` to its `.env`, then supply only public URL/anon key. Never put a service-role key in Expo/browser configuration. Physical devices need your computer’s LAN IP instead of localhost. The apps support manual addresses/coordinates and foreground GPS without maps keys.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run test:db
npm run build
npm run check:mobile
npm exec --workspace apps/passenger-mobile -- expo export --platform all
npm exec --workspace apps/driver-mobile -- expo export --platform all
```

`test:db` starts and removes its own disposable PostgreSQL container; it never connects to a hosted database. Mobile bundle export is not a substitute for device testing.

## Structure and operation

- `apps/web`: booking, driver onboarding, dispatch, operations, organizations, referrals, acquisition pages.
- `apps/passenger-mobile`, `apps/driver-mobile`: separate Expo Router apps.
- `packages/types`: shared ride state machine; `packages/core`: routes, deterministic matching, provider interfaces; `packages/mobile`: secure sessions, native UI, resource loading and chat.
- `supabase/migrations`: append-only schema. Historical duplicate `0004` versions are preserved; the local runner stages uniquely numbered copies in ignored `.local-backend/`. **Never deploy those local copies to an existing remote migration history.**

See [demo scenarios](docs/DEMO_SCENARIOS.md), [solo developer runbook](docs/SOLO_DEVELOPER_RUNBOOK.md), [production integrations](docs/PRODUCTION_INTEGRATIONS.md), and [completion report](docs/FINAL_COMPLETION_REPORT.md) for tested scope and remaining launch work.
