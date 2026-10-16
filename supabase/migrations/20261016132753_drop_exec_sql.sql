-- public.exec_sql(text) was a SECURITY DEFINER function that executed arbitrary
-- SQL as the table owner and was callable with the public anon key. The app no
-- longer uses it; schema changes go through supabase/migrations instead.
drop function if exists public.exec_sql(text);
