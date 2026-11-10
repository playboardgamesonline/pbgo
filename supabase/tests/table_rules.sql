-- The rules of the tables, end to end (migration 0013): which tables a member sits at, which seats of a table are in a game somewhere else, a seat that left, a table that is over or has been idle, the same seat in two games, an account
-- in two games, and who may call what.
--
-- Run it on `pbgo-preview` once the migration is applied (the Supabase MCP's `execute_sql`, or the SQL editor). It is one `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled back, and the message is the
-- answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production. It writes rows of `games` for two made-up game slugs and creates no account anywhere (a seat's account is only text in `member_ids`).
-- (To try the migration itself without applying it: put the statements of the migration right after the `begin` below, in this same block.)

DO $do$
declare
  ua text := '00000000-0000-4000-8000-0000000000e1';
  ub text := '00000000-0000-4000-8000-0000000000e2';
  uc text := '00000000-0000-4000-8000-0000000000e3';
  r text := '';
  s text;
  n integer;
begin
  -- A check: the line tells what it was and what the database said
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;

  -- Ann (ua), Bob (ub) and Cy (uc). AAA111: Ann and Bob play in rules-a. BBB222: Ann and Cy wait in a lobby of rules-b. CCC333: a lobby of rules-a where the cookie of Bob's seat in AAA111 sits again and no account is recorded (a guest's
  -- table). DDD444: a game of rules-a that is over. EEE555: Bob's other browser left a game. FFF666: a game nobody wrote to for seven hours. GGG777: Cy waits in another lobby of rules-b.
  insert into public.games (game, code, host_id, status, players, member_ids, updated_at) values
    ('rules-a', 'AAA111', 'a1', 'playing', '[{"id":"a1","nickname":"Ann"},{"id":"b1","nickname":"Bob"}]', jsonb_build_object('a1', ua, 'b1', ub), now() - interval '1 minute'),
    ('rules-b', 'BBB222', 'a2', 'lobby',   '[{"id":"a2","nickname":"Ann"},{"id":"c2","nickname":"Cy"}]',  jsonb_build_object('a2', ua, 'c2', uc), now()),
    ('rules-a', 'CCC333', 'b1', 'lobby',   '[{"id":"b1","nickname":"Bob"},{"id":"d1","nickname":"Dee"}]', '{}', now()),
    ('rules-a', 'DDD444', 'a1', 'over',    '[{"id":"a1","nickname":"Ann"},{"id":"c1","nickname":"Cy"}]',  jsonb_build_object('a1', ua, 'c1', uc), now()),
    ('rules-a', 'EEE555', 'e1', 'playing', '[{"id":"e1","nickname":"Bob","left":true},{"id":"f1","nickname":"Fay"}]', jsonb_build_object('e1', ub), now()),
    ('rules-b', 'FFF666', 'g2', 'playing', '[{"id":"g2","nickname":"Cy"},{"id":"h2","nickname":"Hal"}]', jsonb_build_object('g2', uc), now() - interval '7 hours'),
    ('rules-b', 'GGG777', 'c3', 'lobby',   '[{"id":"c3","nickname":"Cy"}]', jsonb_build_object('c3', uc), now() - interval '2 minutes');

  -- 1. The tables of a member: the lobby and the game they sit at, the one written last first; a table that is over is not theirs, nor one they left
  select string_agg(code || ':' || status, ',' order by updated_at desc) into s from public.member_tables(ua::uuid);
  r := r || pg_temp.check_that('a member sits at their lobby and their game, the latest first', s = 'BBB222:lobby,AAA111:playing', s);
  select string_agg(code, ',' order by code) into s from public.member_tables(ub::uuid);
  r := r || pg_temp.check_that('a game a member left is not theirs', s = 'AAA111', s);
  select string_agg(code || '=' || seat, ',' order by code) into s from public.member_tables(ua::uuid);
  r := r || pg_temp.check_that('each table says which seat is the member''s', s = 'AAA111=a1,BBB222=a2', s);

  -- 2. A table nobody wrote to for the idle time holds nobody, and the time can be given
  select string_agg(code, ',' order by code) into s from public.member_tables(uc::uuid);
  r := r || pg_temp.check_that('a game over and a table idle for seven hours are not listed', s = 'BBB222,GGG777', s);
  select count(*) into n from public.member_tables(uc::uuid, interval '8 hours') where code = 'FFF666';
  r := r || pg_temp.check_that('the idle time can be widened', n = 1, n::text);

  -- 3. The seats that are in a game somewhere else
  select string_agg(x, ',' order by x) into s from public.busy_seats('rules-b', 'BBB222') x;
  r := r || pg_temp.check_that('Ann is busy in rules-b because her account plays in rules-a', s = 'a2', s);
  select string_agg(x, ',' order by x) into s from public.busy_seats('rules-a', 'CCC333') x;
  r := r || pg_temp.check_that('a guest seat is busy because the same cookie plays in the same game', s = 'b1', s);
  select count(*) into n from public.busy_seats('rules-a', 'AAA111');
  r := r || pg_temp.check_that('a table is not busy with itself, and a game over or a seat that left holds nobody', n = 0, n::text);
  select count(*) into n from public.busy_seats('rules-b', 'GGG777');
  r := r || pg_temp.check_that('a seat whose other game is over or idle is free', n = 0, n::text);

  -- 4. A seat that left is free, whichever side it is on
  update public.games set players = '[{"id":"a1","nickname":"Ann","left":true},{"id":"b1","nickname":"Bob"}]' where game = 'rules-a' and code = 'AAA111';
  select count(*) into n from public.busy_seats('rules-b', 'BBB222');
  r := r || pg_temp.check_that('Ann left her game: she is not busy any more', n = 0, n::text);
  select string_agg(code, ',' order by code) into s from public.member_tables(ua::uuid);
  r := r || pg_temp.check_that('and the game is no longer hers', s = 'BBB222', s);
  update public.games set players = '[{"id":"a1","nickname":"Ann"},{"id":"b1","nickname":"Bob","left":true}]' where game = 'rules-a' and code = 'AAA111';
  select count(*) into n from public.busy_seats('rules-a', 'CCC333');
  r := r || pg_temp.check_that('Bob left the game: the lobby that holds his cookie can start', n = 0, n::text);

  -- 5. A game that has not begun holds nobody; one in its ready check holds its players
  update public.games set status = 'lobby' where game = 'rules-a' and code = 'AAA111';
  select count(*) into n from public.busy_seats('rules-b', 'BBB222');
  r := r || pg_temp.check_that('a lobby holds nobody', n = 0, n::text);
  update public.games set status = 'starting' where game = 'rules-a' and code = 'AAA111';
  select string_agg(x, ',' order by x) into s from public.busy_seats('rules-b', 'BBB222') x;
  r := r || pg_temp.check_that('a table in its ready check holds its players', s = 'a2', s);

  -- 6. Who may call what
  r := r || pg_temp.check_that('the service role may call both', has_function_privilege('service_role', 'public.member_tables(uuid, interval)', 'execute') and has_function_privilege('service_role', 'public.busy_seats(text, text, interval)', 'execute'), null);
  r := r || pg_temp.check_that('the public roles may call neither',
    not has_function_privilege('anon', 'public.member_tables(uuid, interval)', 'execute') and not has_function_privilege('authenticated', 'public.member_tables(uuid, interval)', 'execute')
    and not has_function_privilege('anon', 'public.busy_seats(text, text, interval)', 'execute') and not has_function_privilege('authenticated', 'public.busy_seats(text, text, interval)', 'execute'), null);

  raise exception 'RESULT %', r;
end
$do$;
