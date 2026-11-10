-- The settings of a table and the list of the public tables, end to end (migration 0014): which lobbies are listed, which are not (private, started, nobody seen lately, only a seat that left, idle), the order, the limit, the game filter, what
-- the settings column accepts and who may call what.
--
-- Run it on `pbgo-preview` once the migration is applied (the Supabase MCP's `execute_sql`, or the SQL editor). It is one `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled back, and the message is the
-- answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production. It writes rows of `games` for two made-up game slugs and creates no account anywhere.
-- (To try the migration itself without applying it: put the statements of the migration right after the `begin` below, in this same block.)

DO $do$
declare
  r text := '';
  s text;
  n integer;
begin
  -- A check: the line tells what it was and what the database said
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;

  -- PUB111: a public lobby of pub-a, Ann seen now, opened 5 minutes ago. PUB222: a public lobby of pub-a with a minimum rank, Bob seen a minute ago and Cy never, opened 2 minutes ago. PUB333: a private lobby. PUB444: a lobby that
  -- never had settings. PUB555: a public table that is being played. PUB666: a public lobby nobody was seen at for 10 minutes. PUB777: a public lobby where the one seat that was seen left, and the other was seen 20 minutes ago.
  -- PUB888: a public lobby of pub-b, opened a minute ago. PUB999: a public lobby that is seen now but nobody wrote to for 7 hours.
  insert into public.games (game, code, host_id, status, players, settings, seen, created_at, updated_at) values
    ('pub-a', 'PUB111', 'h1', 'lobby',   '[{"id":"h1","nickname":"Ann"}]', '{"visibility":"public"}', jsonb_build_object('h1', now()::text), now() - interval '5 minutes', now()),
    ('pub-a', 'PUB222', 'h2', 'lobby',   '[{"id":"h2","nickname":"Bob"},{"id":"i2","nickname":"Cy"}]', '{"visibility":"public","minRank":"Silver","language":"en","pace":"fast","seats":3}', jsonb_build_object('h2', (now() - interval '1 minute')::text), now() - interval '2 minutes', now()),
    ('pub-a', 'PUB333', 'h3', 'lobby',   '[{"id":"h3","nickname":"Dee"}]', '{"visibility":"private"}', jsonb_build_object('h3', now()::text), now(), now()),
    ('pub-a', 'PUB444', 'h4', 'lobby',   '[{"id":"h4","nickname":"Eve"}]', '{}', jsonb_build_object('h4', now()::text), now(), now()),
    ('pub-a', 'PUB555', 'h5', 'playing', '[{"id":"h5","nickname":"Fay"},{"id":"i5","nickname":"Gil"}]', '{"visibility":"public"}', jsonb_build_object('h5', now()::text), now(), now()),
    ('pub-a', 'PUB666', 'h6', 'lobby',   '[{"id":"h6","nickname":"Hal"}]', '{"visibility":"public"}', jsonb_build_object('h6', (now() - interval '10 minutes')::text), now() - interval '8 minutes', now()),
    ('pub-a', 'PUB777', 'h7', 'lobby',   '[{"id":"h7","nickname":"Ida","left":true},{"id":"i7","nickname":"Jon"}]', '{"visibility":"public"}', jsonb_build_object('h7', now()::text, 'i7', (now() - interval '20 minutes')::text), now() - interval '9 minutes', now()),
    ('pub-b', 'PUB888', 'h8', 'lobby',   '[{"id":"h8","nickname":"Kay"}]', '{"visibility":"public"}', jsonb_build_object('h8', now()::text), now() - interval '1 minute', now()),
    ('pub-a', 'PUB999', 'h9', 'lobby',   '[{"id":"h9","nickname":"Lou"}]', '{"visibility":"public"}', jsonb_build_object('h9', now()::text), now() - interval '7 hours', now() - interval '7 hours');

  -- 1. The public lobbies of a game that somebody sits at lately, newest first; nothing private, started, deserted, left or idle
  select string_agg(code, ',' order by created_at desc) into s from public.public_tables('pub-a');
  r := r || pg_temp.check_that('the public lobbies of a game with somebody seen lately, the newest first', s = 'PUB222,PUB111', s);

  -- 2. Every game when none is asked for
  select string_agg(code, ',' order by created_at desc) into s from public.public_tables();
  r := r || pg_temp.check_that('every game when none is asked for', s = 'PUB888,PUB222,PUB111', s);

  -- 3. How lately somebody must have been seen can be widened: a seat that left never counts
  select string_agg(code, ',' order by created_at desc) into s from public.public_tables('pub-a', interval '30 minutes');
  r := r || pg_temp.check_that('a longer look lists the lobby seen 10 minutes ago and the one whose other seat was seen 20', s = 'PUB222,PUB111,PUB666,PUB777', s);
  select count(*) into n from public.public_tables('pub-a', interval '3 hours') where code = 'PUB777';
  r := r || pg_temp.check_that('a seat that left is not what keeps a lobby listed', n = 1, n::text);
  update public.games set players = '[{"id":"h7","nickname":"Ida","left":true},{"id":"i7","nickname":"Jon","left":true}]' where game = 'pub-a' and code = 'PUB777';
  select count(*) into n from public.public_tables('pub-a', interval '3 hours') where code = 'PUB777';
  r := r || pg_temp.check_that('a lobby where everybody left is not listed', n = 0, n::text);

  -- 4. A table nobody wrote to for the idle time is gone, and the time can be widened
  select count(*) into n from public.public_tables('pub-a') where code = 'PUB999';
  r := r || pg_temp.check_that('a lobby idle for seven hours is not listed', n = 0, n::text);
  select count(*) into n from public.public_tables('pub-a', interval '3 minutes', interval '8 hours') where code = 'PUB999';
  r := r || pg_temp.check_that('the idle time can be widened', n = 1, n::text);

  -- 5. The limit, and what a row carries
  select string_agg(code, ',') into s from public.public_tables('pub-a', interval '30 minutes', interval '6 hours', 1);
  r := r || pg_temp.check_that('the limit is kept', s = 'PUB222', s);
  select settings ->> 'minRank' || '/' || (settings ->> 'language') || '/' || (settings ->> 'pace') || '/' || (settings ->> 'seats') into s from public.public_tables('pub-a') where code = 'PUB222';
  r := r || pg_temp.check_that('a row carries its settings', s = 'Silver/en/fast/3', s);

  -- 6. Making a table private takes it off the list, making it public puts it back
  update public.games set settings = '{"visibility":"private"}' where game = 'pub-a' and code = 'PUB111';
  select count(*) into n from public.public_tables('pub-a') where code = 'PUB111';
  r := r || pg_temp.check_that('a lobby made private is not listed', n = 0, n::text);
  update public.games set settings = settings || '{"visibility":"public"}' where game = 'pub-a' and code = 'PUB111';
  select count(*) into n from public.public_tables('pub-a') where code = 'PUB111';
  r := r || pg_temp.check_that('and listed again when it is made public', n = 1, n::text);
  update public.games set status = 'starting' where game = 'pub-a' and code = 'PUB111';
  select count(*) into n from public.public_tables('pub-a') where code = 'PUB111';
  r := r || pg_temp.check_that('a lobby that is started is not listed', n = 0, n::text);

  -- 7. The settings are an object, and a table that has none has an empty one
  select settings::text into s from public.games where game = 'pub-a' and code = 'PUB444';
  r := r || pg_temp.check_that('a table with no settings has an empty object', s = '{}', s);
  begin
    insert into public.games (game, code, host_id, status, players, settings) values ('pub-a', 'BAD001', 'x', 'lobby', '[]', '["public"]');
    r := r || pg_temp.check_that('settings that are not an object are refused', false, 'inserted');
  exception when check_violation then
    r := r || pg_temp.check_that('settings that are not an object are refused', true, null);
  end;

  -- 8. The index of the public lobbies is there
  select count(*) into n from pg_indexes where schemaname = 'public' and tablename = 'games' and indexname = 'games_public_lobbies_idx';
  r := r || pg_temp.check_that('the index of the public lobbies exists', n = 1, n::text);

  -- 9. Who may call what
  r := r || pg_temp.check_that('the service role may call it', has_function_privilege('service_role', 'public.public_tables(text, interval, interval, integer)', 'execute'), null);
  r := r || pg_temp.check_that('the public roles may not',
    not has_function_privilege('anon', 'public.public_tables(text, interval, interval, integer)', 'execute') and not has_function_privilege('authenticated', 'public.public_tables(text, interval, interval, integer)', 'execute'), null);

  raise exception 'RESULT %', r;
end
$do$;
