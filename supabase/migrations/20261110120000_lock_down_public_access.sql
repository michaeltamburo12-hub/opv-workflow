-- Close the database to the public anon key.
--
-- Before this, every table had an "allow all" policy, so anyone holding the anon key (which ships
-- to every browser) could read, edit and delete all data without logging in to the app.
-- The app now reaches the database only from its server, using the service role key, which
-- bypasses row level security. So: keep RLS on, drop every policy, and revoke the anon /
-- authenticated grants as a second layer.
--
-- DEPLOY ORDER: production must already be running code where the browser no longer queries
-- Supabase directly (app/page.tsx -> lib/db-client.ts -> /api/db). Ship that code in an earlier
-- merge to main, then ship this migration. Otherwise the live site breaks until the code lands.

drop policy if exists "Anon read - comps" on public.industrial_sale_comps;
drop policy if exists "Service role full access - comps" on public.industrial_sale_comps;
drop policy if exists "Allow all market_availabilities" on public.market_availabilities;
drop policy if exists "Allow all" on public.lease_comps;
drop policy if exists "Allow all" on public.lease_market_availabilities;
drop policy if exists "Allow all opv_reports" on public.opv_reports;
drop policy if exists "Allow all pcre_sales" on public.pcre_sale_transactions;
drop policy if exists "Allow all pcre_leases" on public.pcre_lease_transactions;

alter table public.industrial_sale_comps enable row level security;
alter table public.market_availabilities enable row level security;
alter table public.lease_comps enable row level security;
alter table public.lease_market_availabilities enable row level security;
alter table public.opv_reports enable row level security;
alter table public.pcre_sale_transactions enable row level security;
alter table public.pcre_lease_transactions enable row level security;

revoke all on table
  public.industrial_sale_comps,
  public.market_availabilities,
  public.lease_comps,
  public.lease_market_availabilities,
  public.opv_reports,
  public.pcre_sale_transactions,
  public.pcre_lease_transactions
from anon, authenticated;
