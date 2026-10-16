# Staging & deploys

| | Production | Staging |
|---|---|---|
| Git branch | `main` | `staging` (and any feature branch) |
| Vercel | Production deploy | Preview deploys |
| Supabase | `OPV Database` (`mionfclzaixfaxuvrgfc`) | `opv-staging` (`xjixoueedizownmzwgvw`) |
| Local dev (`.env.local`) | — | ✓ |

Vercel env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` are set per environment: Production points at the
production database; Preview and Development point at staging.

## Shipping a change

1. Work on `staging` (or a feature branch). Push → Vercel builds a preview wired to staging,
   and the **CI** GitHub Action type-checks and builds the commit.
2. Database changes go in a new file in `supabase/migrations/` (`npx supabase migration new <name>`).
   Apply to staging: `npx supabase db push` (the repo is linked to staging).
3. Check https://opv-workflow-git-staging-godiscoapp.vercel.app.
4. Promote: merge `staging` → `main`. Vercel deploys production, and the
   **Migrate production database** action applies any new migrations to production.

The Vercel deploy and the migration action run at the same time, so migrations
must work with both the old and new code:

- **Adding** tables/columns: ship in one merge.
- **Removing or renaming** things the live code uses: two merges — first code that
  no longer uses it, then the migration that removes it.

## Automation

- `.github/workflows/ci.yml` — type check + build on every push and PR. The Next.js
  build also fails on type errors (no `ignoreBuildErrors`).
- `.github/workflows/migrate-production.yml` — on push to `main` touching
  `supabase/migrations/`, runs `supabase db push` against production. Needs the
  `PROD_DB_URL` repository secret (Supabase → Connect → **Session pooler** string;
  GitHub runners are IPv4-only so the direct connection won't work). Skips with a
  warning if the secret is missing.

## Notes

- Staging is on the Supabase free plan and pauses after ~1 week idle; restore it from the dashboard.
- `supabase/migrations/20261016000000_baseline.sql` is a snapshot of production as of 2026-10-16.
  Production already has it, so it must never be re-applied there.
