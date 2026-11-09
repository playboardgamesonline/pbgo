-- The accounts of the providers the hub signs members in with itself (migration 0010): one row per account at a provider, at most one account of a provider per member, a SteamID64 of 17 digits, deleted with the member, and
-- out of reach of the public roles.
--
-- Run it once the migration is applied, on a throwaway database or on `pbgo-preview` (the Supabase MCP's `execute_sql`, or the SQL editor). It is one `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is
-- rolled back, and the message is the answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production.

DO $do$
declare
  a uuid := '00000000-0000-4000-8000-0000000000a1';
  b uuid := '00000000-0000-4000-8000-0000000000b2';
  r text := '';
begin
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;

  insert into auth.users (id) values (a), (b);

  -- 1. A member holds an account at a provider
  insert into public.external_identities (provider, subject, user_id) values ('steam', '76561198000000000', a);
  r := r || pg_temp.check_that('a member holds a Steam account', (select user_id from public.external_identities where provider = 'steam' and subject = '76561198000000000') = a, null);
  r := r || pg_temp.check_that('the row is dated', (select created_at is not null from public.external_identities where subject = '76561198000000000'), null);

  -- 2. An account at a provider is held by one member
  begin
    insert into public.external_identities (provider, subject, user_id) values ('steam', '76561198000000000', b);
    r := r || 'FAIL a second member holds the same Steam account; ';
  exception when unique_violation then
    r := r || 'ok a second member cannot hold the same Steam account; ';
  end;

  -- 3. A member holds one account of a provider
  begin
    insert into public.external_identities (provider, subject, user_id) values ('steam', '76561198000000001', a);
    r := r || 'FAIL a member holds two Steam accounts; ';
  exception when unique_violation then
    r := r || 'ok a member cannot hold two Steam accounts; ';
  end;

  -- 4. ... but may hold one at each provider, and two members hold one each
  insert into public.external_identities (provider, subject, user_id) values ('epic', 'abc123', a), ('steam', '76561198000000002', b);
  r := r || pg_temp.check_that('a member holds one account at each provider, two members one each', (select count(*) from public.external_identities where user_id in (a, b)) = 3, (select count(*)::text from public.external_identities where user_id in (a, b)));

  -- 5. What is not a SteamID64, and what is not a provider of ours, is refused
  begin
    insert into public.external_identities (provider, subject, user_id) values ('steam', '12345', gen_random_uuid());
    r := r || 'FAIL a Steam account of five digits is accepted; ';
  exception when check_violation then
    r := r || 'ok a Steam account must have 17 digits; ';
  when foreign_key_violation then
    r := r || 'FAIL the digits were not checked before the member (foreign key first); ';
  end;
  begin
    insert into public.external_identities (provider, subject, user_id) values ('steam', '7656119800000000a', b);
    r := r || 'FAIL a Steam account with a letter is accepted; ';
  exception when check_violation then
    r := r || 'ok a Steam account is digits only; ';
  end;
  begin
    insert into public.external_identities (provider, subject, user_id) values ('myspace', '1', b);
    r := r || 'FAIL an unknown provider is accepted; ';
  exception when check_violation then
    r := r || 'ok an unknown provider is refused; ';
  end;
  begin
    insert into public.external_identities (provider, subject, user_id) values ('epic', '', b);
    r := r || 'FAIL an empty subject is accepted; ';
  exception when check_violation then
    r := r || 'ok an empty subject is refused; ';
  end;

  -- 6. The rows go with the member
  delete from auth.users where id = a;
  r := r || pg_temp.check_that('the rows of a member are deleted with them', not exists (select 1 from public.external_identities where user_id = a) and exists (select 1 from public.external_identities where user_id = b), (select count(*)::text from public.external_identities));

  -- 7. Out of reach of the public roles
  r := r || pg_temp.check_that('row level security is on', (select relrowsecurity from pg_class where oid = 'public.external_identities'::regclass), null);
  r := r || pg_temp.check_that('the public roles have no grant', not has_table_privilege('anon', 'public.external_identities', 'select, insert, update, delete') and not has_table_privilege('authenticated', 'public.external_identities', 'select, insert, update, delete'), null);
  r := r || pg_temp.check_that('no policy opens the table', not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'external_identities'), null);
  r := r || pg_temp.check_that('the service role can read and write it', has_table_privilege('service_role', 'public.external_identities', 'select') and has_table_privilege('service_role', 'public.external_identities', 'insert') and has_table_privilege('service_role', 'public.external_identities', 'delete'), null);

  raise exception 'RESULT %', r;
end
$do$;
