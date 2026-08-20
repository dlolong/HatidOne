# HatidOne Starter

AI-first starter repository for a Philippine scheduled transportation / mobility marketplace.

## MVP focus
1. Passenger scheduled booking
2. Driver onboarding + verification
3. Fleet management + manual dispatch
4. Ride assignment and trip lifecycle
5. Deposit/full payment plumbing
6. Ratings, trust, fraud flags, and safety events

## Suggested local setup
```bash
cp .env.example .env.local
npm install
npm run dev
```

## Repository layout
- `apps/web` – Next.js web app / admin / initial passenger experience
- `packages/types` – shared domain types and ride states
- `packages/database` – shared DB helpers (stubbed)
- `supabase/migrations` – versioned SQL migrations
- `docs` – product/architecture specifications
- `codex-prompts` – bounded tasks to give to Codex agents

## Important
This starter is intentionally conservative. Do not connect it to production payments, production Supabase service-role credentials, or real regulated transport operations until the relevant security, compliance, and regulatory work is complete.
