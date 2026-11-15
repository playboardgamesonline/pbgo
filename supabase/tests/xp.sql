-- What gives experience (migration 0026, onto `profiles.xp` of 0023): the actions a table counts for each player, what a recorded game gives to the profiles of the accounts that held its seats, what is cleared, that the totals of the games are counted as before, and that a game ended by the debug tools gives nothing.
--
-- Run it on `pbgo-preview` once the migrations are applied (the Supabase MCP's `execute_sql`, or the SQL editor). It is one `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled back, and the
-- message is the answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production.

DO $do$
declare
  ua uuid := '00000000-0000-4000-8000-0000000000a1';
  ub uuid := '00000000-0000-4000-8000-0000000000b2';
  t0 timestamptz := '2026-11-08 09:00:00+00';
  duel jsonb;
  v_actions jsonb;
  v_id uuid;
  n bigint;
  r text := '';
begin
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;

  insert into auth.users (id) values (ua), (ub);
  duel := jsonb_build_object('rating_kind', 'elo', 'engine_version', 'test',
    'participants', jsonb_build_array(
      jsonb_build_object('seat', 0, 'player', 'pa', 'name', 'Ann', 'rank', 1, 'score', 12, 'outcome', 'win'),
      jsonb_build_object('seat', 1, 'player', 'pb', 'name', 'Bob', 'rank', 2, 'score', 7, 'outcome', 'loss'),
      jsonb_build_object('seat', 2, 'player', 'pg', 'name', 'Guest', 'rank', 3, 'score', 1, 'outcome', 'loss')));

  -- 1. A table in play counts the actions of each player, one at a time; a table that is not in play counts none
  insert into public.games (game, code, host_id, status, member_ids, started_at, created_at) values
    ('zz-x', 'XP1AAA', 'pa', 'playing', jsonb_build_object('pa', ua::text, 'pb', ub::text), '2026-11-08 09:10:00+00', t0),
    ('zz-x', 'XP2AAA', 'pa', 'lobby', jsonb_build_object('pa', ua::text), null, t0);
  perform public.count_action('zz-x', 'XP1AAA', 'pa');
  perform public.count_action('zz-x', 'XP1AAA', 'pa');
  perform public.count_action('zz-x', 'XP1AAA', 'pa');
  perform public.count_action('zz-x', 'XP1AAA', 'pb');
  perform public.count_action('zz-x', 'XP1AAA', 'pg');
  perform public.count_action('zz-x', 'XP1AAA', 'pg');
  perform public.count_action('zz-x', 'XP2AAA', 'pa');
  select actions into v_actions from public.games where game = 'zz-x' and code = 'XP1AAA';
  r := r || pg_temp.check_that('the table counts the actions of each player', v_actions = '{"pa": 3, "pb": 1, "pg": 2}'::jsonb, v_actions::text);
  select actions into v_actions from public.games where game = 'zz-x' and code = 'XP2AAA';
  r := r || pg_temp.check_that('a table in the lobby counts nothing', v_actions = '{}'::jsonb, v_actions::text);

  -- 2. The game recorded: each seat holds its actions, the accounts get them as experience, a guest has no totals, and the counters of the table are cleared
  v_id := public.record_game_result('zz-x', 'XP1AAA', t0, '2026-11-08 09:20:00+00', duel);
  r := r || pg_temp.check_that('the seats hold their actions', (select string_agg(gp.actions::text, ',' order by gp.seat) from public.game_participants gp where gp.game_result_id = v_id) = '3,1,2',
    (select string_agg(gp.actions::text, ',' order by gp.seat) from public.game_participants gp where gp.game_result_id = v_id));
  r := r || pg_temp.check_that('the accounts get them as experience on their profile, a guest nothing',
    (select xp from public.profiles where user_id = ua) = 3 and (select xp from public.profiles where user_id = ub) = 1 and (select count(*) from public.profiles where user_id in (ua, ub)) = 2,
    (select string_agg(xp::text, ',' order by user_id) from public.profiles where user_id in (ua, ub)));
  select actions into v_actions from public.games where game = 'zz-x' and code = 'XP1AAA';
  r := r || pg_temp.check_that('the counters of the table are cleared', v_actions = '{}'::jsonb, v_actions::text);

  -- 3. Another game adds up, in the same game and in another one: the experience is across games
  insert into public.games (game, code, host_id, status, member_ids, started_at, created_at) values
    ('zz-x', 'XP3AAA', 'pa', 'playing', jsonb_build_object('pa', ua::text, 'pb', ub::text), '2026-11-08 10:10:00+00', t0),
    ('zz-y', 'XP4AAA', 'pa', 'over', jsonb_build_object('pa', ua::text, 'pb', ub::text), '2026-11-08 11:10:00+00', t0);
  perform public.count_action('zz-x', 'XP3AAA', 'pa');
  perform public.count_action('zz-x', 'XP3AAA', 'pa');
  for n in 1..4 loop
    perform public.count_action('zz-y', 'XP4AAA', 'pa');
  end loop;
  perform public.record_game_result('zz-x', 'XP3AAA', t0, '2026-11-08 10:20:00+00', duel);
  perform public.record_game_result('zz-y', 'XP4AAA', t0, '2026-11-08 11:20:00+00', duel);
  select xp into n from public.profiles where user_id = ua;
  r := r || pg_temp.check_that('the experience adds up across games: 3 and 2 in one, 4 in the other', n = 9, n::text);

  -- 4. A game that the debug tools ended gives nothing
  insert into public.games (game, code, host_id, status, member_ids, started_at, created_at) values
    ('zz-x', 'XP5AAA', 'pa', 'playing', jsonb_build_object('pa', ua::text, 'pb', ub::text), '2026-11-08 12:10:00+00', t0);
  for n in 1..7 loop
    perform public.count_action('zz-x', 'XP5AAA', 'pa');
  end loop;
  perform public.record_game_result('zz-x', 'XP5AAA', t0, '2026-11-08 12:20:00+00', duel || '{"debug": true}'::jsonb);
  select xp into n from public.profiles where user_id = ua;
  r := r || pg_temp.check_that('a game ended by the debug tools gives none', n = 9, n::text);
  -- The totals of the games are counted as they were before the migration: the three games of one game and the one of the other, the first player winning each
  r := r || pg_temp.check_that('the totals of the games are counted as before',
    (select games_played from public.player_stats where user_id = ua and game = 'zz-x') = 3 and (select wins from public.player_stats where user_id = ua and game = 'zz-x') = 3
    and (select games_played from public.player_stats where user_id = ua and game = 'zz-y') = 1,
    (select string_agg(game || ':' || games_played || '/' || wins, ',' order by game) from public.player_stats where user_id = ua));

  -- 5. A rematch starts again from nothing
  insert into public.games (game, code, host_id, status, member_ids, actions, created_at) values ('zz-x', 'XP6AAA', 'pa', 'playing', jsonb_build_object('pa', ua::text), '{"pa": 2}'::jsonb, t0);
  perform public.mark_game_started('zz-x', 'XP6AAA', '2026-11-08 13:00:00+00');
  select actions into v_actions from public.games where game = 'zz-x' and code = 'XP6AAA';
  r := r || pg_temp.check_that('a game that begins again has no action', v_actions = '{}'::jsonb, v_actions::text);

  -- 6. Who may call what
  r := r || pg_temp.check_that('only the service role counts an action',
    not has_function_privilege('anon', 'public.count_action(text,text,text)', 'execute') and not has_function_privilege('authenticated', 'public.count_action(text,text,text)', 'execute')
    and has_function_privilege('service_role', 'public.count_action(text,text,text)', 'execute'), null);

  raise exception 'RESULT %', r;
end
$do$;
