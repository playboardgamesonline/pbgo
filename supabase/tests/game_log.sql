-- The log of a game (migration 0016): what the table accepts, the cascade with its table, the clean-up of the state of a finished table that takes the log with it (and only that table's), and who may touch it.
--
-- Run it on `pbgo-preview` once the migrations are applied (the Supabase MCP's `execute_sql`, or the SQL editor). It is one `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled back, and the
-- message is the answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production.
-- (To try the migration itself without applying it: put the statements of the migration right after the `begin` below, in this same block.)

DO $do$
declare
  old timestamptz := now() - interval '3 days';
  n integer;
  s jsonb;
  m text;
  r text := '';
begin
  -- A finished table whose game is recorded, and a table still in play
  insert into public.games (game, code, host_id, status, state, version, created_at, updated_at) values
    ('zz-test', 'DONE01', 'h', 'over', '{"a":1}', 5, old, old),
    ('zz-test', 'PLAY01', 'h', 'playing', '{"a":2}', 3, old, old);
  insert into public.game_results (game, table_created_at, finished_at, rating_kind, player_count, engine_version) values ('zz-test', old, old, 'none', 2, 'test');
  insert into public.game_log (game, code, version, entries) values
    ('zz-test', 'DONE01', 4, '[{"event":{"kind":"x"}}]'),
    ('zz-test', 'DONE01', 5, '[{"event":{"kind":"y"},"to":["a"],"masked":{"kind":"y2"}}]'),
    ('zz-test', 'PLAY01', 3, '[{"event":{"kind":"z"}}]');

  -- The clean-up of the states takes the log of the finished table with it, and only that one
  select public.drop_finished_states(now(), 10, true) into n;
  r := r || case when n = 1 then 'ok ' else 'FAIL ' end || 'a dry run counts ' || n || E' (expected 1); ';
  select count(*) into n from public.game_log where code = 'DONE01';
  r := r || case when n = 2 then 'ok ' else 'FAIL ' end || 'a dry run deletes nothing: ' || n || E' rows left (expected 2); ';
  select public.drop_finished_states(now(), 10, false) into n;
  r := r || case when n = 1 then 'ok ' else 'FAIL ' end || 'a real run drops ' || n || E' (expected 1); ';
  select state into s from public.games where code = 'DONE01';
  r := r || case when s is null then 'ok ' else 'FAIL ' end || E'the state of the finished table is null; ';
  select count(*) into n from public.games where code = 'DONE01' and version = 5;
  r := r || case when n = 1 then 'ok ' else 'FAIL ' end || E'the row of the table and its version stay; ';
  select count(*) into n from public.game_log where code = 'DONE01';
  r := r || case when n = 0 then 'ok ' else 'FAIL ' end || 'the log of the finished table is gone: ' || n || E' left; ';
  select count(*) into n from public.game_log where code = 'PLAY01';
  r := r || case when n = 1 then 'ok ' else 'FAIL ' end || 'the log of the table in play stays: ' || n || E' left (expected 1); ';

  -- What the table accepts
  begin
    insert into public.game_log values ('zz-test', 'DONE01', 9, '[]');
    r := r || E'FAIL an empty list of entries is accepted; ';
  exception when check_violation then
    r := r || E'ok an empty list of entries is refused; ';
  end;
  begin
    insert into public.game_log values ('zz-test', 'DONE01', 9, '{"event":{}}');
    r := r || E'FAIL an object instead of a list is accepted; ';
  exception when check_violation then
    r := r || E'ok an object instead of a list is refused; ';
  end;
  begin
    insert into public.game_log values ('zz-test', 'DONE01', 0, '[{"event":{}}]');
    r := r || E'FAIL version 0 is accepted; ';
  exception when check_violation then
    r := r || E'ok version 0 is refused; ';
  end;
  begin
    insert into public.game_log values ('zz-test', 'NOPE99', 1, '[{"event":{}}]');
    r := r || E'FAIL a log for a table that does not exist is accepted; ';
  exception when foreign_key_violation then
    r := r || E'ok a log for a table that does not exist is refused; ';
  end;
  begin
    insert into public.game_log values ('zz-test', 'PLAY01', 3, '[{"event":{}}]');
    r := r || E'FAIL the same move written twice is accepted; ';
  exception when unique_violation then
    r := r || E'ok the same move written twice is refused; ';
  end;

  -- The log goes with its table
  delete from public.games where code = 'PLAY01';
  select count(*) into n from public.game_log where code = 'PLAY01';
  r := r || case when n = 0 then 'ok ' else 'FAIL ' end || 'deleting the table deletes its log: ' || n || E' left; ';

  -- Who may touch it
  select case when relrowsecurity then 'ok row level security is on; ' else 'FAIL row level security is off; ' end into m from pg_class where oid = 'public.game_log'::regclass;
  r := r || m;
  r := r || case when not has_table_privilege('anon', 'public.game_log', 'select') and not has_table_privilege('authenticated', 'public.game_log', 'select') then 'ok ' else 'FAIL ' end || E'anon and authenticated cannot read it; ';
  r := r || case when has_table_privilege('service_role', 'public.game_log', 'insert') and has_table_privilege('service_role', 'public.game_log', 'select') and has_table_privilege('service_role', 'public.game_log', 'delete') then 'ok ' else 'FAIL ' end || E'the service role can read, write and delete; ';

  raise exception 'RESULT %', r;
end
$do$;
