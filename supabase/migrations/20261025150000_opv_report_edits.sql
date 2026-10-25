-- Persist report photo swaps and inline text edits with the OPV (previously
-- browser-only), plus a fingerprint of the data the frozen report was built from
-- so the app can tell when it is out of date. Additive only.
alter table public.opv_reports add column if not exists photo_overrides_json text;
alter table public.opv_reports add column if not exists text_edits_json text;
alter table public.opv_reports add column if not exists edited_report_sig text;
