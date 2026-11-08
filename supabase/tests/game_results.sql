-- The recorder of the finished games, end to end (migrations 0006 to 0008): record_game_result, the ratings, the totals, the erasure with the account, the fold of the old seats and the drop of the old states.
--
-- Run it on `pbgo-preview` once the migrations are applied (the Supabase MCP's `execute_sql`, or the SQL editor). It is one `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled back, and the
-- message is the answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production.

DO $do$
declare
  ua uuid := '00000000-0000-4000-8000-0000000000a1';
  ub uuid := '00000000-0000-4000-8000-0000000000b2';
  uc uuid := '00000000-0000-4000-8000-0000000000c3';
  t0 timestamptz := '2026-11-08 09:00:00+00';
  r text := '';
  n integer;
  m integer;
  k integer;
  id1 uuid;
  id2 uuid;
  id3 uuid;
  duel jsonb;
  trio jsonb;
  together jsonb;
begin
  -- A check: the line tells what it was and what the database said
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;

  insert into auth.users (id) values (ua), (ub), (uc);

  duel := jsonb_build_object('rating_kind', 'elo', 'engine_version', 'test', 'options', jsonb_build_object('rounds', 3),
    'participants', jsonb_build_array(
      jsonb_build_object('seat', 0, 'player', 'pa', 'name', 'Ann', 'avatar_url', 'https://example.com/a.png', 'rank', 1, 'score', 12, 'outcome', 'win'),
      jsonb_build_object('seat', 1, 'player', 'pb', 'name', 'Bob', 'rank', 2, 'score', 7, 'outcome', 'loss')));
  trio := jsonb_build_object('rating_kind', 'elo', 'engine_version', 'test',
    'participants', jsonb_build_array(
      jsonb_build_object('seat', 0, 'player', 'pa', 'name', 'Ann', 'rank', 1, 'score', 9, 'outcome', 'win'),
      jsonb_build_object('seat', 1, 'player', 'pb', 'name', 'Bob', 'rank', 2, 'score', 5, 'outcome', 'loss'),
      jsonb_build_object('seat', 2, 'player', 'pc', 'name', 'Cy', 'rank', 3, 'score', 1, 'outcome', 'loss')));
  together := jsonb_build_object('rating_kind', 'coop', 'coop_outcome', 'won', 'coop_score', 24, 'engine_version', 'test',
    'participants', jsonb_build_array(
      jsonb_build_object('seat', 0, 'player', 'pa', 'name', 'Ann', 'rank', 1, 'score', 24, 'outcome', 'coop_win'),
      jsonb_build_object('seat', 1, 'player', 'pb', 'name', 'Bob', 'rank', 1, 'score', 24, 'outcome', 'coop_win')));

  -- 1. A table with an account and a guest: written once, however many times it is asked, with the account and not the guest
  insert into public.games (game, code, host_id, status, players, member_ids, started_at, created_at) values
    ('zz-test', 'T1AAAA', 'pa', 'playing', '[{"id":"pa","nickname":"Ann"},{"id":"pb","nickname":"Bob"}]', jsonb_build_object('pa', ua::text), '2026-11-08 09:10:00+00', t0);
  id1 := public.record_game_result('zz-test', 'T1AAAA', t0, '2026-11-08 09:20:00+00', duel);
  id2 := public.record_game_result('zz-test', 'T1AAAA', t0, '2026-11-08 09:20:00+00', duel);
  r := r || pg_temp.check_that('the second call writes nothing', id1 is not null and id2 is null, id1::text || '/' || coalesce(id2::text, 'null'));
  select count(*) into n from public.game_results where game = 'zz-test';
  r := r || pg_temp.check_that('one result', n = 1, n::text);
  r := r || pg_temp.check_that('one seat each', (select count(*) from public.game_participants where game_result_id = id1) = 2, null);
  r := r || pg_temp.check_that('the account holds seat 0, the guest seat 1 holds none', (select user_id from public.game_participants where game_result_id = id1 and seat = 0) = ua and (select user_id is null from public.game_participants where game_result_id = id1 and seat = 1), null);
  r := r || pg_temp.check_that('the duration is ten minutes', (select duration_s from public.game_results where id = id1) = 600, (select duration_s::text from public.game_results where id = id1));
  r := r || pg_temp.check_that('the game is not ranked and no seat counts', not (select ranked from public.game_results where id = id1) and not exists (select 1 from public.game_participants where game_result_id = id1 and counted_ranked), null);
  r := r || pg_temp.check_that('the table is told the game is over', (select started_at is null and taken_over = '[]'::jsonb from public.games where game = 'zz-test' and code = 'T1AAAA'), null);
  r := r || pg_temp.check_that('the account has its totals, the guest none', (select games_played = 1 and wins = 1 and seconds_played = 600 from public.player_stats where user_id = ua and game = 'zz-test') and (select count(*) from public.player_stats) >= 1, null);
  r := r || pg_temp.check_that('nobody is rated for an unranked game', not exists (select 1 from public.ratings where game = 'zz-test'), null);
  id3 := public.record_game_result('zz-test', 'T1AAAA', t0, '2026-11-08 09:50:00+00', duel);
  r := r || pg_temp.check_that('a rematch of the table is another game', id3 is not null and (select count(*) from public.game_results where game = 'zz-test') = 2, null);

  -- 2. A ranked table of two accounts: the game counts, and the Elo moves by the rules
  insert into public.games (game, code, host_id, status, players, member_ids, ranked, created_at) values
    ('zz-test', 'T2AAAA', 'pa', 'playing', '[{"id":"pa","nickname":"Ann"},{"id":"pb","nickname":"Bob"}]', jsonb_build_object('pa', ua::text, 'pb', ub::text), true, t0);
  id1 := public.record_game_result('zz-test', 'T2AAAA', t0, '2026-11-08 10:00:00+00', duel);
  r := r || pg_temp.check_that('the game is ranked and both seats count', (select ranked from public.game_results where id = id1) and (select bool_and(counted_ranked) from public.game_participants where game_result_id = id1), null);
  r := r || pg_temp.check_that('the winner gains 16 and the other loses 16', (select round(rating::numeric, 3) from public.ratings where user_id = ua and game = 'zz-test') = 1516 and (select round(rating::numeric, 3) from public.ratings where user_id = ub and game = 'zz-test') = 1484, (select string_agg(round(rating::numeric, 3)::text, ',') from public.ratings where game = 'zz-test'));
  r := r || pg_temp.check_that('what each game did is kept', (select count(*) from public.rating_changes where game_result_id = id1) = 2, null);
  r := r || pg_temp.check_that('the rated games and the wins are counted', (select games_played = 1 and wins = 1 and display_name = 'Ann' from public.ratings where user_id = ua and game = 'zz-test'), null);
  r := r || pg_temp.check_that('the totals count every game of the account, the time of the one whose start was told', (select games_played = 3 and wins = 3 and seconds_played = 600 from public.player_stats where user_id = ua and game = 'zz-test'), (select format('g%s w%s s%s', games_played, wins, seconds_played) from public.player_stats where user_id = ua and game = 'zz-test'));

  -- 3. Three accounts, one of them played for by the takeover: the seat that was played for counts for nothing, the two others are rated between them
  insert into public.games (game, code, host_id, status, players, member_ids, ranked, taken_over, created_at) values
    ('zz-test', 'T3AAAA', 'pa', 'playing', '[{"id":"pa","nickname":"Ann"},{"id":"pb","nickname":"Bob"},{"id":"pc","nickname":"Cy"}]', jsonb_build_object('pa', ua::text, 'pb', ub::text, 'pc', uc::text), true, '["pc"]', t0);
  id1 := public.record_game_result('zz-test', 'T3AAAA', t0, '2026-11-08 11:00:00+00', trio);
  r := r || pg_temp.check_that('the seat that was played for does not count', (select counted_ranked from public.game_participants where game_result_id = id1 and seat = 0) and not (select counted_ranked from public.game_participants where game_result_id = id1 and seat = 2), null);
  r := r || pg_temp.check_that('the one who was played for has no rating', not exists (select 1 from public.ratings where user_id = uc and game = 'zz-test'), null);
  r := r || pg_temp.check_that('the two others are rated between them again', (select round(rating::numeric, 3) from public.ratings where user_id = ua and game = 'zz-test') > 1516, (select round(rating::numeric, 3)::text from public.ratings where user_id = ua and game = 'zz-test'));

  -- 4. A table that plays together, ranked: it counts, with no Elo
  insert into public.games (game, code, host_id, status, players, member_ids, ranked, created_at) values
    ('zz-test', 'T4AAAA', 'pa', 'playing', '[{"id":"pa","nickname":"Ann"},{"id":"pb","nickname":"Bob"}]', jsonb_build_object('pa', ua::text, 'pb', ub::text), true, t0);
  select count(*) into n from public.rating_changes;
  id1 := public.record_game_result('zz-test', 'T4AAAA', t0, '2026-11-08 12:00:00+00', together);
  r := r || pg_temp.check_that('a game played together is ranked and rates nobody', (select ranked and coop_outcome = 'won' and coop_score = 24 from public.game_results where id = id1) and (select count(*) from public.rating_changes) = n, null);
  r := r || pg_temp.check_that('it is counted in the totals as won together', (select coop_wins = 1 from public.player_stats where user_id = ua and game = 'zz-test'), null);

  -- 5. A debug game and a table with a guest are never ranked, even when the table was opened so
  insert into public.games (game, code, host_id, status, players, member_ids, ranked, created_at) values
    ('zz-test', 'T5AAAA', 'pa', 'playing', '[{"id":"pa","nickname":"Ann"},{"id":"pb","nickname":"Bob"}]', jsonb_build_object('pa', ua::text, 'pb', ub::text), true, t0),
    ('zz-test', 'T5BBBB', 'pa', 'playing', '[{"id":"pa","nickname":"Ann"},{"id":"pb","nickname":"Bob"}]', jsonb_build_object('pa', ua::text), true, t0);
  id1 := public.record_game_result('zz-test', 'T5AAAA', t0, '2026-11-08 13:00:00+00', duel || '{"debug": true}'::jsonb);
  id2 := public.record_game_result('zz-test', 'T5BBBB', t0, '2026-11-08 13:30:00+00', duel);
  r := r || pg_temp.check_that('a debug game is not ranked', not (select ranked from public.game_results where id = id1), null);
  r := r || pg_temp.check_that('a game with a guest is not ranked', not (select ranked from public.game_results where id = id2), null);

  -- 6. The fold: the old seats of the unranked games go, the seats that counted stay, the totals do not move
  update public.game_participants set finished_at = '2024-01-01 10:00:00+00' where game_result_id in (select id from public.game_results where game = 'zz-test' and finished_at in ('2026-11-08 09:20:00+00', '2026-11-08 13:00:00+00', '2026-11-08 10:00:00+00'));
  select count(*) filter (where not counted_ranked), count(*) filter (where counted_ranked) into n, m from public.game_participants where finished_at = '2024-01-01 10:00:00+00';
  r := r || pg_temp.check_that('some old seats are unranked and some ranked', n > 0 and m > 0, n::text || '/' || m::text);
  r := r || pg_temp.check_that('a dry run counts what a run would fold', public.fold_old_results('2025-11-08 00:00:00+00', 1000, true) = n, public.fold_old_results('2025-11-08 00:00:00+00', 1000, true)::text);
  k := public.fold_old_results('2025-11-08 00:00:00+00', 1);
  r := r || pg_temp.check_that('a batch of one deletes one', k = 1, k::text);
  k := public.fold_old_results('2025-11-08 00:00:00+00');
  r := r || pg_temp.check_that('the rest goes', k = n - 1, k::text);
  r := r || pg_temp.check_that('nothing is left to fold', public.fold_old_results('2025-11-08 00:00:00+00', 1000, true) = 0, null);
  r := r || pg_temp.check_that('the seats that counted stay', exists (select 1 from public.game_participants where finished_at = '2024-01-01 10:00:00+00' and counted_ranked), null);
  r := r || pg_temp.check_that('the totals did not move', (select games_played from public.player_stats where user_id = ua and game = 'zz-test') >= 4, (select games_played::text from public.player_stats where user_id = ua and game = 'zz-test'));

  -- 7. The state of a finished table goes a day after its last write, when its game is recorded
  update public.games set status = 'over', state = '{"x":1}', updated_at = '2026-11-05 10:00:00+00' where game = 'zz-test' and code in ('T1AAAA', 'T2AAAA');
  insert into public.games (game, code, host_id, status, state, created_at, updated_at) values ('zz-test', 'T6AAAA', 'pa', 'over', '{"x":1}', '2026-11-01 00:00:00+00', '2026-11-05 10:00:00+00');
  r := r || pg_temp.check_that('a dry run counts the states a run would drop', public.drop_finished_states('2026-11-08 00:00:00+00', 500, true) >= 2, public.drop_finished_states('2026-11-08 00:00:00+00', 500, true)::text);
  perform public.drop_finished_states('2026-11-08 00:00:00+00');
  r := r || pg_temp.check_that('the states of the recorded games are gone, the other is kept', (select count(*) from public.games where game = 'zz-test' and code in ('T1AAAA', 'T2AAAA') and state is null) = 2 and (select state is not null from public.games where game = 'zz-test' and code = 'T6AAAA'), null);

  -- 8. The account goes: its rating, its totals and the link to its games go with it, and its seats lose their name; the other seats are as they were
  delete from auth.users where id = ub;
  r := r || pg_temp.check_that('no rating, no totals, no rating changes left for the account', not exists (select 1 from public.ratings where user_id = ub) and not exists (select 1 from public.player_stats where user_id = ub) and not exists (select 1 from public.rating_changes where user_id = ub), null);
  r := r || pg_temp.check_that('its seats are a deleted player: no account, no name, no picture', exists (select 1 from public.game_participants gp join public.game_results gr on gr.id = gp.game_result_id where gr.game = 'zz-test' and gr.finished_at = '2026-11-08 10:00:00+00' and gp.seat = 1 and gp.display_name is null and gp.avatar_url is null and gp.user_id is null) and not exists (select 1 from public.game_participants gp join public.game_results gr on gr.id = gp.game_result_id where gr.game = 'zz-test' and gr.finished_at in ('2026-11-08 10:00:00+00', '2026-11-08 12:00:00+00') and gp.seat = 1 and gp.display_name = 'Bob'), null);
  r := r || pg_temp.check_that('the others keep their name', exists (select 1 from public.game_participants gp join public.game_results gr on gr.id = gp.game_result_id where gr.game = 'zz-test' and gp.display_name = 'Ann' and gp.user_id = ua), null);

  -- 9. Who may call what
  r := r || pg_temp.check_that('the public roles can call nothing and read nothing',
    not has_function_privilege('anon', 'public.record_game_result(text,text,timestamptz,timestamptz,jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.rate_game(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.fold_old_results(timestamptz,integer,boolean)', 'execute')
    and not has_table_privilege('anon', 'public.game_results', 'select')
    and not has_table_privilege('authenticated', 'public.ratings', 'select')
    and not has_table_privilege('anon', 'public.player_stats', 'select')
    and has_function_privilege('service_role', 'public.record_game_result(text,text,timestamptz,timestamptz,jsonb)', 'execute')
    and (select bool_and(relrowsecurity) from pg_class where oid in ('public.game_results'::regclass, 'public.game_participants'::regclass, 'public.ratings'::regclass, 'public.rating_changes'::regclass, 'public.player_stats'::regclass)), null);

  raise exception 'RESULT %', r;
end
$do$;
