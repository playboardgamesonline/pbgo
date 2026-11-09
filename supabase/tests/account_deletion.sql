-- The deletion of an account, end to end (migration 0011): the link, its confirmation, the hold, the keeping, the erasure with the scrub of the tables, the lines of the audit log, the cascade, the race with a member who keeps their
-- account, the clean-up of the links nobody confirmed, and who may call what. It also counts, for the day another table is added, that nothing of ours blocks the deletion of an account.
--
-- Run it on `pbgo-preview` once the migrations are applied (the Supabase MCP's `execute_sql`, or the SQL editor). It is one `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled back, and the
-- message is the answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production. It makes fixture rows in `auth.users` that the rollback takes back: it creates no account anywhere.
-- (To try the migration itself without applying it: put the statements of the migration right after the `begin` below, in this same block.)

DO $do$
declare
  ua uuid := '00000000-0000-4000-8000-0000000000d1';
  ub uuid := '00000000-0000-4000-8000-0000000000d2';
  uc uuid := '00000000-0000-4000-8000-0000000000d3';
  ud uuid := '00000000-0000-4000-8000-0000000000d4';
  ue uuid := '00000000-0000-4000-8000-0000000000d5';
  uf uuid := '00000000-0000-4000-8000-0000000000d6';
  hash_a text := repeat('a', 64);
  hash_b text := repeat('b', 64);
  hash_c text := repeat('c', 64);
  t0 timestamptz := '2026-11-01 10:00:00+00';
  r text := '';
  s text;
  n integer;
  kept boolean;
  when_a timestamptz;
  when_e timestamptz;
  sid_a uuid := gen_random_uuid();
  sid_b uuid := gen_random_uuid();
begin
  -- A check: the line tells what it was and what the database said
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;

  -- The accounts, with the app metadata Supabase Auth gives an account made with an address
  insert into auth.users (id, email, raw_app_meta_data) values
    (ua, 'ann@example.test', '{"provider":"email","providers":["email"]}'),
    (ub, 'bob@example.test', '{"provider":"email","providers":["email"]}'),
    (uc, 'cy@example.test', '{"provider":"email","providers":["email"]}'),
    (ud, 'dee@example.test', '{"provider":"email","providers":["email"]}'),
    (ue, 'eve@example.test', '{"provider":"email","providers":["email"]}'),
    (uf, 'fay@example.test', '{"provider":"email","providers":["email"]}');

  -- 0. Nothing of ours may block the deletion of an account: every key from a table of `public` to `auth.users` cascades or sets null
  select count(*), string_agg(c.conrelid::regclass::text || ' ' || c.confdeltype::text, ', ') into n, s
  from pg_constraint c join pg_namespace ns on ns.oid = c.connamespace
  where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and ns.nspname = 'public' and c.confdeltype in ('a', 'r');
  r := r || pg_temp.check_that('no table of public holds an account with no action or restrict', n = 0, s);

  -- 1. A link is asked for
  r := r || pg_temp.check_that('an unknown account is told so', public.request_account_deletion('00000000-0000-4000-8000-0000000000ff', hash_a, now() + interval '1 hour') = 'unknown', null);
  r := r || pg_temp.check_that('a first link is sent', public.request_account_deletion(ua, hash_a, now() + interval '1 hour') = 'sent', null);
  r := r || pg_temp.check_that('the row awaits: a token, no date', (select token_hash = hash_a and scheduled_for is null and token_expires_at > now() from public.account_deletions where user_id = ua), null);
  r := r || pg_temp.check_that('a second link within a minute is refused', public.request_account_deletion(ua, hash_b, now() + interval '1 hour') = 'wait', null);
  r := r || pg_temp.check_that('and leaves the first one in place', (select token_hash = hash_a from public.account_deletions where user_id = ua), null);
  -- (A function that writes and a query that reads it cannot share a statement: the query keeps the snapshot it started with. So each answer is taken first.)
  s := public.request_account_deletion(ua, hash_b, now() + interval '1 hour', interval '0 seconds');
  r := r || pg_temp.check_that('a new link replaces the old one', s = 'sent' and (select token_hash = hash_b from public.account_deletions where user_id = ua), s);
  begin
    perform public.request_account_deletion(ua, hash_c, now() - interval '1 minute');
    r := r || 'FAIL a link already expired was accepted; ';
  exception when others then
    r := r || 'ok a link that has already expired is refused; ';
  end;

  -- 2. What the page of the link may show
  r := r || pg_temp.check_that('the good link shows the address', public.peek_account_deletion(ua, hash_b) = 'ann@example.test', public.peek_account_deletion(ua, hash_b));
  r := r || pg_temp.check_that('the replaced link shows nothing', public.peek_account_deletion(ua, hash_a) is null, null);
  r := r || pg_temp.check_that('another account shows nothing', public.peek_account_deletion(ub, hash_b) is null, null);
  r := r || pg_temp.check_that('looking changes nothing', (select token_hash = hash_b and scheduled_for is null from public.account_deletions where user_id = ua), null);
  update public.account_deletions set token_expires_at = now() - interval '1 second' where user_id = ua;
  r := r || pg_temp.check_that('a link that has expired shows nothing and confirms nothing', public.peek_account_deletion(ua, hash_b) is null and public.confirm_account_deletion(ua, hash_b, now() + interval '30 days') is null, null);
  update public.account_deletions set token_expires_at = now() + interval '1 hour' where user_id = ua;

  -- 3. The link is confirmed: the account goes on hold, signed out everywhere
  insert into auth.sessions (id, user_id) values (sid_a, ua), (sid_b, ub);
  insert into auth.refresh_tokens (token, user_id, session_id, revoked) values ('test-token-a', ua::text, sid_a, false), ('test-token-b', ub::text, sid_b, false);
  r := r || pg_temp.check_that('a wrong token confirms nothing', public.confirm_account_deletion(ua, hash_a, now() + interval '30 days') is null and (select scheduled_for is null from public.account_deletions where user_id = ua), null);
  when_a := public.confirm_account_deletion(ua, hash_b, now() + interval '30 days');
  r := r || pg_temp.check_that('the right token puts the account on hold on the day given', when_a = now() + interval '30 days', when_a::text);
  r := r || pg_temp.check_that('the token is spent', (select token_hash is null and token_expires_at is null and scheduled_for = when_a from public.account_deletions where user_id = ua), null);
  r := r || pg_temp.check_that('the day is on the account, as the server reads it', (select raw_app_meta_data ->> 'pbgo_deletion_at' = to_char(when_a at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') from auth.users where id = ua), (select raw_app_meta_data::text from auth.users where id = ua));
  r := r || pg_temp.check_that('the other keys of the account are left as they were', (select (raw_app_meta_data - 'pbgo_deletion_at') = (select raw_app_meta_data from auth.users where id = ub) from auth.users where id = ua), null);
  r := r || pg_temp.check_that('its sessions and refresh tokens are gone, the other account keeps its own', not exists (select 1 from auth.sessions where user_id = ua) and not exists (select 1 from auth.refresh_tokens where user_id = ua::text) and exists (select 1 from auth.sessions where user_id = ub) and exists (select 1 from auth.refresh_tokens where user_id = ub::text), null);
  r := r || pg_temp.check_that('the same link a second time confirms nothing', public.confirm_account_deletion(ua, hash_b, now() + interval '31 days') is null and (select scheduled_for = when_a from public.account_deletions where user_id = ua), null);
  r := r || pg_temp.check_that('an account on hold is not mailed another link', public.request_account_deletion(ua, hash_c, now() + interval '1 hour', interval '0 seconds') = 'on_hold', null);
  r := r || pg_temp.check_that('nobody else is on hold', (select count(*) from auth.users where raw_app_meta_data ->> 'pbgo_deletion_at' is not null and id in (ub, uc, ud, ue)) = 0, null);

  -- 4. A member keeps their account
  perform public.request_account_deletion(uc, hash_c, now() + interval '1 hour');
  perform public.confirm_account_deletion(uc, hash_c, now() + interval '30 days');
  r := r || pg_temp.check_that('a second account is on hold', (select scheduled_for is not null from public.account_deletions where user_id = uc) and (select raw_app_meta_data ->> 'pbgo_deletion_at' is not null from auth.users where id = uc), null);
  kept := public.cancel_account_deletion(uc);
  r := r || pg_temp.check_that('keeping it removes the row and the mark', kept and not exists (select 1 from public.account_deletions where user_id = uc) and (select raw_app_meta_data ->> 'pbgo_deletion_at' is null from auth.users where id = uc), null);
  kept := public.cancel_account_deletion(uc);
  r := r || pg_temp.check_that('keeping it twice is told so and harms nothing', not kept, null);
  r := r || pg_temp.check_that('the first account is still on hold', (select scheduled_for = when_a from public.account_deletions where user_id = ua), null);

  -- 5. The tables the accounts sat at, before the erasure
  insert into public.games (game, code, host_id, status, players, member_ids, version, created_at, updated_at) values
    ('zz-test', 'D1AAAA', 'pa', 'playing', '[{"id":"pa","nickname":"Ann","avatarUrl":"https://example.com/a.png"},{"id":"pb","nickname":"Bob","avatarUrl":"https://example.com/b.png"}]', jsonb_build_object('pa', ua::text, 'pb', ub::text), 7, t0, t0),
    ('zz-test', 'D2AAAA', 'pa2', 'over', '[{"id":"pa2","nickname":"Ann"}]', jsonb_build_object('pa2', ua::text), 3, t0, t0),
    ('zz-test', 'D3AAAA', 'pb3', 'lobby', '[{"id":"pb3","nickname":"Bob","avatarUrl":"https://example.com/b.png"},{"id":"pg3","nickname":"Guest"}]', jsonb_build_object('pb3', ub::text), 1, t0, t0),
    ('zz-test', 'D4AAAA', 'pd', 'lobby', '[{"id":"pd","nickname":"Dee","avatarUrl":"https://example.com/d.png"},{"id":"pg4","nickname":"Guest"}]', jsonb_build_object('pd', ud::text), 2, t0, t0);

  -- Rows that hang on the account: its rank, its totals, its seats in the games played, its presence, its feedback is not here (the server finds it by address)
  insert into public.ratings (user_id, game, points, display_name, avatar_url) values (ua, 'zz-test', 40, 'Ann', 'https://example.com/a.png'), (ub, 'zz-test', 10, 'Bob', null);
  insert into public.player_stats (user_id, game, games_played) values (ua, 'zz-test', 3), (ub, 'zz-test', 1);
  insert into public.member_presence (user_id) values (ua), (ub);
  insert into public.game_results (id, game, table_created_at, finished_at, rating_kind, player_count, engine_version)
    values ('00000000-0000-4000-8000-00000000f001', 'zz-test', t0, t0 + interval '10 minutes', 'elo', 2, 'test');
  insert into public.game_participants (game_result_id, seat, user_id, display_name, avatar_url, outcome, finished_at) values
    ('00000000-0000-4000-8000-00000000f001', 0, ua, 'Ann', 'https://example.com/a.png', 'win', t0 + interval '10 minutes'),
    ('00000000-0000-4000-8000-00000000f001', 1, ub, 'Bob', null, 'loss', t0 + interval '10 minutes');

  -- The audit log of Supabase Auth, when the project writes it to the database: lines about the account by its id, by the account it acted on, by its address alone, and a line about someone else
  insert into auth.audit_log_entries (id, payload) values
    (gen_random_uuid(), ('{"actor_id":"' || ua || '","actor_username":"ann@example.test","action":"login","log_type":"account"}')::json),
    (gen_random_uuid(), ('{"actor_id":"00000000-0000-0000-0000-000000000000","action":"user_modified","log_type":"user","traits":{"user_id":"' || ua || '"}}')::json),
    (gen_random_uuid(), '{"actor_username":"Ann@Example.test","action":"login","log_type":"account"}'::json),
    (gen_random_uuid(), ('{"actor_id":"' || ub || '","actor_username":"bob@example.test","action":"login","log_type":"account"}')::json);

  -- A provider that the hub signs in with itself (migration of Steam's sign-in), when it is there: its rows hang on the account too
  if to_regclass('public.external_identities') is not null then
    execute format('insert into public.external_identities (provider, subject, user_id) values (%L, %L, %L)', 'steam', '76561198000000001', ua);
  end if;

  -- 6. The day has not come: nothing is erased, and the clean-up finds nothing
  r := r || pg_temp.check_that('before the day, the account is not due', not exists (select 1 from public.due_account_deletions(when_a - interval '1 second') where user_id = ua), null);
  r := r || pg_temp.check_that('and an erasure that waits for the day does nothing', not public.erase_account(ua, when_a - interval '1 second') and exists (select 1 from auth.users where id = ua), null);
  r := r || pg_temp.check_that('an account that was never on hold is never due', not public.erase_account(ub, now() + interval '100 years') and exists (select 1 from auth.users where id = ub), null);
  select string_agg(user_id::text || '/' || coalesce(email, ''), ',') into s from public.due_account_deletions(when_a);
  r := r || pg_temp.check_that('on the day, it is due, with its address', s = ua::text || '/ann@example.test', s);
  r := r || pg_temp.check_that('the limit is respected', (select count(*) from public.due_account_deletions(when_a + interval '1 year', 0)) = 0, null);

  -- A member who keeps their account at that very moment: the row is gone, so is the erasure
  perform public.request_account_deletion(ue, hash_c, now() + interval '1 hour');
  perform public.confirm_account_deletion(ue, hash_c, now() + interval '30 days');
  perform public.cancel_account_deletion(ue);
  r := r || pg_temp.check_that('an account that was kept in the meantime is not erased', not public.erase_account(ue, now() + interval '100 years') and exists (select 1 from auth.users where id = ue), null);

  -- 7. The day has come
  r := r || pg_temp.check_that('the erasure goes through on the day', public.erase_account(ua, when_a), null);
  r := r || pg_temp.check_that('the account is gone, and its row', not exists (select 1 from auth.users where id = ua) and not exists (select 1 from public.account_deletions where user_id = ua), null);
  r := r || pg_temp.check_that('its rank, totals and presence went with it, the other account keeps its own', not exists (select 1 from public.ratings where user_id = ua) and not exists (select 1 from public.player_stats where user_id = ua) and not exists (select 1 from public.member_presence where user_id = ua) and exists (select 1 from public.ratings where user_id = ub) and exists (select 1 from public.player_stats where user_id = ub) and exists (select 1 from public.member_presence where user_id = ub), null);
  r := r || pg_temp.check_that('its seat in the game played stays, as a deleted player', exists (select 1 from public.game_participants where game_result_id = '00000000-0000-4000-8000-00000000f001' and seat = 0 and user_id is null and display_name is null and avatar_url is null and outcome = 'win'), null);
  r := r || pg_temp.check_that('the seat of the other account is as it was', exists (select 1 from public.game_participants where game_result_id = '00000000-0000-4000-8000-00000000f001' and seat = 1 and user_id = ub and display_name = 'Bob'), null);
  if to_regclass('public.external_identities') is not null then
    execute 'select count(*) from public.external_identities where user_id = $1' into n using ua;
    r := r || pg_temp.check_that('its other provider was freed too', n = 0, n::text);
  else
    r := r || 'ok (no table of external identities here); ';
  end if;

  -- The tables it sat at keep the seat, as "Deleted player", whatever the status of the table
  r := r || pg_temp.check_that('in a table in play, its seat is a deleted player with no picture and no account', (select p ->> 'nickname' = 'Deleted player' and p ->> 'avatarUrl' is null from public.games g, jsonb_array_elements(g.players) p where g.game = 'zz-test' and g.code = 'D1AAAA' and p ->> 'id' = 'pa') and (select member_ids ->> 'pa' is null from public.games where game = 'zz-test' and code = 'D1AAAA'), (select players::text from public.games where game = 'zz-test' and code = 'D1AAAA'));
  r := r || pg_temp.check_that('the other player of that table is untouched, and so is the order of the seats', (select players -> 1 = '{"id":"pb","nickname":"Bob","avatarUrl":"https://example.com/b.png"}'::jsonb and players -> 0 ->> 'id' = 'pa' and member_ids = jsonb_build_object('pb', ub::text) from public.games where game = 'zz-test' and code = 'D1AAAA'), (select players::text || member_ids::text from public.games where game = 'zz-test' and code = 'D1AAAA'));
  r := r || pg_temp.check_that('in a table that is over, too', (select players -> 0 ->> 'nickname' = 'Deleted player' and member_ids = '{}'::jsonb from public.games where game = 'zz-test' and code = 'D2AAAA'), null);
  r := r || pg_temp.check_that('a table without the account is not touched', (select players::text like '%Bob%' and member_ids = jsonb_build_object('pb3', ub::text) from public.games where game = 'zz-test' and code = 'D3AAAA'), null);
  r := r || pg_temp.check_that('a table is no move: neither its version nor its last write changed', (select count(*) from public.games where game = 'zz-test' and code in ('D1AAAA', 'D2AAAA') and updated_at = t0 and version in (7, 3)) = 2, null);

  -- The audit log: what was about the account is gone, what was about the other account stays
  r := r || pg_temp.check_that('its lines of the audit log went, by id, by the account acted on and by address (whatever the case)', not exists (select 1 from auth.audit_log_entries where payload::text like '%' || ua::text || '%' or lower(payload::text) like '%ann@example.test%'), null);
  r := r || pg_temp.check_that('the other account keeps its own', exists (select 1 from auth.audit_log_entries where payload ->> 'actor_id' = ub::text), null);

  -- 8. A deletion from the dashboard scrubs the tables too, with nothing from the job
  delete from auth.users where id = ud;
  r := r || pg_temp.check_that('a deletion of the dashboard scrubs the tables as well', (select players -> 0 ->> 'nickname' = 'Deleted player' and players -> 0 ->> 'avatarUrl' is null and players -> 1 ->> 'nickname' = 'Guest' and member_ids = '{}'::jsonb from public.games where game = 'zz-test' and code = 'D4AAAA'), (select players::text from public.games where game = 'zz-test' and code = 'D4AAAA'));
  r := r || pg_temp.check_that('erasing an account that does not exist harms nothing', not public.erase_account('00000000-0000-4000-8000-0000000000fe'), null);

  -- 9. The links nobody confirmed: one that expired two days ago, one still good, and an account on hold that must never be touched
  perform public.request_account_deletion(uc, hash_a, now() + interval '1 hour');
  update public.account_deletions set token_expires_at = now() - interval '2 days' where user_id = uc;
  perform public.request_account_deletion(ub, hash_b, now() + interval '1 hour');
  perform public.request_account_deletion(ue, hash_c, now() + interval '1 hour');
  when_e := public.confirm_account_deletion(ue, hash_c, now() + interval '30 days');
  r := r || pg_temp.check_that('a dry run counts the links that expired and deletes none', public.purge_deletion_links(now() - interval '1 day', true) = 1 and exists (select 1 from public.account_deletions where user_id = uc), public.purge_deletion_links(now() - interval '1 day', true)::text);
  n := public.purge_deletion_links(now() - interval '1 day');
  r := r || pg_temp.check_that('the clean-up deletes the link that expired two days ago, not the good one nor the account on hold', n = 1 and not exists (select 1 from public.account_deletions where user_id = uc) and exists (select 1 from public.account_deletions where user_id = ub and token_hash = hash_b) and exists (select 1 from public.account_deletions where user_id = ue and scheduled_for = when_e), null);
  begin
    insert into public.account_deletions (user_id) values (uf);
    r := r || 'FAIL a row with neither a token nor a day was accepted; ';
  exception when check_violation then
    r := r || 'ok a row with neither a token nor a day is refused; ';
  end;
  begin
    insert into public.account_deletions (user_id, token_hash, token_expires_at, scheduled_for) values (uf, hash_a, now() + interval '1 hour', now() + interval '1 day');
    r := r || 'FAIL a row with a token and a day was accepted; ';
  exception when check_violation then
    r := r || 'ok a row with a token and a day is refused; ';
  end;

  -- 10. Who may call what
  r := r || pg_temp.check_that('the public roles can call nothing and read nothing',
    not has_function_privilege('anon', 'public.request_account_deletion(uuid,text,timestamptz,interval)', 'execute')
    and not has_function_privilege('authenticated', 'public.confirm_account_deletion(uuid,text,timestamptz)', 'execute')
    and not has_function_privilege('authenticated', 'public.erase_account(uuid,timestamptz)', 'execute')
    and not has_function_privilege('anon', 'public.peek_account_deletion(uuid,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.due_account_deletions(timestamptz,integer)', 'execute')
    and not has_function_privilege('anon', 'public.scrub_member_from_tables(uuid)', 'execute')
    and not has_table_privilege('anon', 'public.account_deletions', 'select')
    and not has_table_privilege('authenticated', 'public.account_deletions', 'select')
    and has_function_privilege('service_role', 'public.erase_account(uuid,timestamptz)', 'execute')
    and has_function_privilege('service_role', 'public.confirm_account_deletion(uuid,text,timestamptz)', 'execute')
    and has_table_privilege('service_role', 'public.account_deletions', 'select')
    and (select relrowsecurity from pg_class where oid = 'public.account_deletions'::regclass), null);

  raise exception 'RESULT %', r;
end
$do$;
