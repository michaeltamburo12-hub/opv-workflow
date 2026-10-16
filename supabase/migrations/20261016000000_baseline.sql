-- Baseline: snapshot of the production schema as of 2026-10-16.
-- Production already has these objects; this file recreates them on a fresh
-- database (staging). Everything is idempotent so it is safe to re-run.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ── industrial_sale_comps ───────────────────────────────────────────────
create table if not exists public.industrial_sale_comps (
  id uuid default gen_random_uuid() not null primary key,
  address text,
  city text,
  state text default 'NY'::text,
  property_type text,
  building_sf numeric,
  lot_size_ac numeric,
  num_floors numeric,
  ceiling_height text,
  column_spacing text,
  loading_docks text,
  drive_ins text,
  power text,
  heat text,
  parking text,
  sprinkler text,
  sewer text,
  zoning text,
  real_estate_taxes numeric,
  sale_price numeric,
  price_per_sf numeric,
  sale_date date,
  sale_status text,
  asking_price numeric,
  actual_cap_rate numeric,
  pro_forma_cap_rate numeric,
  sale_type text,
  buyer text,
  seller text,
  listing_broker text,
  market text,
  submarket text,
  zip_code text,
  county text,
  notes text,
  created_at timestamp with time zone default now(),
  status text default 'Closed'::text
);
create index if not exists idx_comps_county on public.industrial_sale_comps using btree (county);
create index if not exists idx_comps_city on public.industrial_sale_comps using btree (city);
create index if not exists idx_comps_building_sf on public.industrial_sale_comps using btree (building_sf);
create index if not exists idx_comps_sale_date on public.industrial_sale_comps using btree (sale_date);
create index if not exists idx_comps_zoning on public.industrial_sale_comps using btree (zoning);

-- ── market_availabilities ───────────────────────────────────────────────
create table if not exists public.market_availabilities (
  id uuid default gen_random_uuid() not null primary key,
  address text,
  city text,
  state text default 'NY'::text,
  zip_code text,
  county text,
  property_type text,
  building_sf numeric,
  lot_size_ac numeric,
  ceiling_height text,
  loading_docks text,
  drive_ins text,
  power text,
  heat text,
  parking text,
  sprinkler text,
  sewer text,
  zoning text,
  real_estate_taxes numeric,
  asking_price numeric,
  price_per_sf numeric,
  pricing_guidance text,
  availability_type text,
  listing_broker text,
  submarket text,
  market text,
  loopnet_url text,
  notes text,
  created_at timestamp with time zone default now(),
  status text default 'Available'::text
);

-- ── lease_comps ─────────────────────────────────────────────────────────
create table if not exists public.lease_comps (
  id uuid default gen_random_uuid() not null primary key,
  created_at timestamp with time zone default now(),
  transaction_date date,
  address text,
  town text,
  county text default 'Nassau'::text,
  building_sf numeric,
  lot_size_ac numeric,
  ceiling_height text,
  loading_docks text,
  drive_ins text,
  asking_rent numeric,
  deal_rent numeric,
  rent_type text default 'NNN'::text,
  taxes numeric,
  lease_term_years numeric,
  rent_concession_months numeric,
  ti_ll_work text,
  mgmt_fee_pct numeric,
  tenant text,
  landlord text,
  status text default 'Active'::text,
  notes text,
  escalations text,
  office_sf numeric,
  parking text,
  power text,
  sprinkler text,
  heat text,
  sewer text,
  zoning text,
  property_type text,
  re_taxes numeric
);

-- ── lease_market_availabilities ─────────────────────────────────────────
create table if not exists public.lease_market_availabilities (
  id uuid default gen_random_uuid() not null primary key,
  address text,
  town text,
  county text default 'Nassau'::text,
  building_sf numeric,
  lot_size_ac numeric,
  ceiling_height text,
  loading_docks text,
  drive_ins text,
  power text,
  sprinkler text,
  parking text,
  asking_rent numeric,
  rent_type text default 'NNN'::text,
  taxes numeric,
  lease_term_years numeric,
  escalations text,
  landlord text,
  listing_broker text,
  loopnet_url text,
  status text default 'Available'::text,
  notes text,
  created_at timestamp with time zone default now(),
  heat text,
  sewer text,
  zoning text,
  property_type text,
  re_taxes numeric,
  office_sf numeric
);

-- ── opv_reports ─────────────────────────────────────────────────────────
create table if not exists public.opv_reports (
  id uuid default gen_random_uuid() not null primary key,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  saved_by text,
  address text,
  current_step text,
  subject_json text,
  comps_json text,
  lease_comps_json text,
  avails_json text,
  analytics_json text,
  ai_text text,
  folders_json text,
  assignment_json text,
  edited_report_html text,
  lease_avails_json text,
  photo_urls_json text,
  verification_json text
);

-- ── pcre_sale_transactions ──────────────────────────────────────────────
create table if not exists public.pcre_sale_transactions (
  id uuid default gen_random_uuid() not null primary key,
  address text,
  city text,
  county text,
  property_type text,
  building_sf numeric,
  sale_price_text text,
  sale_date date,
  buyer text,
  seller text,
  notes text,
  created_at timestamp with time zone default now()
);

-- ── pcre_lease_transactions ─────────────────────────────────────────────
create table if not exists public.pcre_lease_transactions (
  id uuid default gen_random_uuid() not null primary key,
  address text,
  city text,
  county text,
  tenant text,
  landlord text,
  building_sf numeric,
  lease_price text,
  lease_date date,
  lease_term text,
  notes text,
  created_at timestamp with time zone default now()
);

-- ── Row level security (mirrors production as-is) ───────────────────────
alter table public.industrial_sale_comps enable row level security;
alter table public.market_availabilities enable row level security;
alter table public.lease_comps enable row level security;
alter table public.lease_market_availabilities enable row level security;
alter table public.opv_reports enable row level security;
alter table public.pcre_sale_transactions enable row level security;
alter table public.pcre_lease_transactions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'industrial_sale_comps' and policyname = 'Anon read - comps') then
    create policy "Anon read - comps" on public.industrial_sale_comps for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'industrial_sale_comps' and policyname = 'Service role full access - comps') then
    create policy "Service role full access - comps" on public.industrial_sale_comps for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'market_availabilities' and policyname = 'Allow all market_availabilities') then
    create policy "Allow all market_availabilities" on public.market_availabilities for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lease_comps' and policyname = 'Allow all') then
    create policy "Allow all" on public.lease_comps for all to public using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lease_market_availabilities' and policyname = 'Allow all') then
    create policy "Allow all" on public.lease_market_availabilities for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'opv_reports' and policyname = 'Allow all opv_reports') then
    create policy "Allow all opv_reports" on public.opv_reports for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pcre_sale_transactions' and policyname = 'Allow all pcre_sales') then
    create policy "Allow all pcre_sales" on public.pcre_sale_transactions for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pcre_lease_transactions' and policyname = 'Allow all pcre_leases') then
    create policy "Allow all pcre_leases" on public.pcre_lease_transactions for all to public using (true) with check (true);
  end if;
end $$;

-- Note: production also has public.exec_sql(text), a SECURITY DEFINER
-- function that runs arbitrary SQL. It is intentionally NOT recreated here.
