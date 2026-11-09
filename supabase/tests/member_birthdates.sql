-- The date of birth a member declared (migration 0010, PLT-125): declared once and never replaced, refused under 13, readable by the server only, and deleted with the account.
--
-- Run it on `pbgo-preview` once the migration is applied (the Supabase MCP's `execute_sql`, or the SQL editor). It is one `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled back, and the
-- message is the answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production.

DO $do$
declare
  u uuid := '00000000-0000-4000-8000-0000000000a1';
  v uuid := '00000000-0000-4000-8000-0000000000b2';
  w uuid := '00000000-0000-4000-8000-0000000000c3';
  thirteen_today date := (current_date - interval '13 years')::date;
  r text := '';
  kept boolean;
  refused boolean;
begin
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;

  insert into auth.users (id) values (u), (v), (w);

  -- 1. A date is declared once
  kept := public.set_member_birthdate(u, date '1990-04-02');
  r := r || pg_temp.check_that('a first date is kept', kept, kept::text);
  r := r || pg_temp.check_that('it is the date that is stored', (select birthdate from public.member_birthdates where user_id = u) = date '1990-04-02', (select birthdate::text from public.member_birthdates where user_id = u));
  r := r || pg_temp.check_that('it is stamped with the moment it was declared', (select set_at from public.member_birthdates where user_id = u) > now() - interval '1 minute', null);

  -- 2. It is never replaced, whatever the date: another date and the same one both answer false
  kept := public.set_member_birthdate(u, date '1980-01-01');
  r := r || pg_temp.check_that('a second, other date is not kept', not kept, kept::text);
  kept := public.set_member_birthdate(u, date '1990-04-02');
  r := r || pg_temp.check_that('the same date again is not kept either', not kept, kept::text);
  r := r || pg_temp.check_that('the first date is still the one stored', (select birthdate from public.member_birthdates where user_id = u) = date '1990-04-02', (select birthdate::text from public.member_birthdates where user_id = u));
  r := r || pg_temp.check_that('one row for the member', (select count(*) from public.member_birthdates where user_id = u) = 1, (select count(*)::text from public.member_birthdates where user_id = u));

  -- 3. Another member has a date of their own
  kept := public.set_member_birthdate(v, date '2001-12-31');
  r := r || pg_temp.check_that('another member declares theirs', kept and (select birthdate from public.member_birthdates where user_id = v) = date '2001-12-31', kept::text);

  -- 4. Under 13, and the future, are refused, and nothing is kept
  refused := false;
  begin
    perform public.set_member_birthdate(w, thirteen_today + 1);
  exception when sqlstate '22023' then
    refused := true;
  end;
  r := r || pg_temp.check_that('the day before the 13th birthday is refused', refused, refused::text);
  refused := false;
  begin
    perform public.set_member_birthdate(w, current_date + 1);
  exception when sqlstate '22023' then
    refused := true;
  end;
  r := r || pg_temp.check_that('a date in the future is refused', refused, refused::text);
  r := r || pg_temp.check_that('nothing is kept for a refused date', not exists (select 1 from public.member_birthdates where user_id = w), null);
  kept := public.set_member_birthdate(w, thirteen_today);
  r := r || pg_temp.check_that('the 13th birthday itself is kept', kept and (select birthdate from public.member_birthdates where user_id = w) = thirteen_today, kept::text);

  -- 5. Only the server reads and writes it
  r := r || pg_temp.check_that('row level security is on', (select relrowsecurity from pg_class where oid = 'public.member_birthdates'::regclass), null);
  r := r || pg_temp.check_that('no policy gives a browser a way in', not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'member_birthdates'), null);
  r := r || pg_temp.check_that('the public roles have no right on the table',
    not has_table_privilege('anon', 'public.member_birthdates', 'select') and not has_table_privilege('authenticated', 'public.member_birthdates', 'select')
    and not has_table_privilege('anon', 'public.member_birthdates', 'insert') and not has_table_privilege('authenticated', 'public.member_birthdates', 'update'), null);
  r := r || pg_temp.check_that('the public roles cannot call the function',
    not has_function_privilege('anon', 'public.set_member_birthdate(uuid, date)', 'execute') and not has_function_privilege('authenticated', 'public.set_member_birthdate(uuid, date)', 'execute'), null);
  r := r || pg_temp.check_that('the service role can read the table and call the function',
    has_table_privilege('service_role', 'public.member_birthdates', 'select') and has_function_privilege('service_role', 'public.set_member_birthdate(uuid, date)', 'execute'), null);

  -- 6. It goes with the account
  delete from auth.users where id = u;
  r := r || pg_temp.check_that('deleting the account deletes the date', not exists (select 1 from public.member_birthdates where user_id = u), null);
  r := r || pg_temp.check_that('the others are not touched', (select count(*) from public.member_birthdates where user_id in (v, w)) = 2, (select count(*)::text from public.member_birthdates where user_id in (v, w)));

  raise exception 'RESULT %', r;
end
$do$;
