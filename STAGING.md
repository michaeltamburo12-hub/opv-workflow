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

1. Work on `staging` (or a feature branch). Push → Vercel builds a preview wired to staging.
2. Database changes go in a new file in `supabase/migrations/` (`npx supabase migration new <name>`).
   Apply to staging: `npx supabase db push` (the repo is linked to staging).
3. Check the preview URL.
4. Promote: apply the same migration to production, then merge `staging` → `main`.
   Production deploys automatically from `main`.

Apply migrations to production **before** merging code that depends on them.

## Notes

- Staging is on the Supabase free plan and pauses after ~1 week idle; restore it from the dashboard.
- `supabase/migrations/20261016000000_baseline.sql` is a snapshot of production as of 2026-10-16.
  Production already has it, so it must never be re-applied there.
