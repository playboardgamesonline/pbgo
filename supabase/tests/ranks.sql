-- The ladder, the board of a game, where a player stands and the history of their games (migration 0009), on the tables of 0006 to 0008.
--
-- Run it on `pbgo-preview` once the migrations are applied (the Supabase MCP's `execute_sql`, or the SQL editor). It is one `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled back, and the
-- message is the answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production.

DO $do$
declare
  u uuid := '00000000-0000-4000-8000-0000000000a1';
  o1 uuid := '00000000-0000-4000-8000-0000000000b2';
  prov uuid := '00000000-0000-4000-8000-0000000000c3';
  stranger uuid := '00000000-0000-4000-8000-0000000000d4';
  g1 uuid := gen_random_uuid();
  g2 uuid := gen_random_uuid();
  g3 uuid := gen_random_uuid();
  r text := '';
begin
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;

  -- 1. The ladder by place and pool: 100 points a step, nine tiers, Legend for the three best of a pool of a hundred
  r := r || pg_temp.check_that('Legend: the three best of a pool of 120', public.ladder_score_of(1, 120) = 2400 and public.ladder_score_of(3, 120) = 2400 and public.ladder_score_of(4, 120) <> 2400, public.ladder_score_of(4, 120)::text);
  r := r || pg_temp.check_that('Master III from the fourth place of 120, Master I at the tenth', public.ladder_score_of(4, 120) = 2083 and public.ladder_score_of(10, 120) = 1833, public.ladder_score_of(4, 120)::text || '/' || public.ladder_score_of(10, 120)::text);
  r := r || pg_temp.check_that('Diamond at the twentieth, Platinum at the thirtieth and the sixtieth', public.ladder_score_of(20, 120) = 1590 and public.ladder_score_of(30, 120) = 1450 and public.ladder_score_of(60, 120) = 1200, null);
  r := r || pg_temp.check_that('Gold then Silver, then Apprentice for the last', public.ladder_score_of(61, 120) = 1187 and public.ladder_score_of(96, 120) = 600 and public.ladder_score_of(120, 120) = 0, null);
  r := r || pg_temp.check_that('nobody is above Platinum in a pool under a hundred', public.ladder_score_of(1, 30) < 1500 and public.ladder_score_of(1, 30) >= 1200 and public.ladder_score_of(16, 30) = 1150 and public.ladder_score_of(27, 30) = 300 and public.ladder_score_of(30, 30) = 0, public.ladder_score_of(1, 30)::text);
  r := r || pg_temp.check_that('a pool of one is Apprentice I', public.ladder_score_of(1, 1) = 0, null);

  -- The pools: 30 players of the game zz-a rated 1410 to 1700 with 6 games each, Uma among them (1550), a player of three games, and 120 players of zz-b
  create temp table pool_a on commit drop as select gen_random_uuid() as id, i from generate_series(1, 30) i;
  create temp table pool_b on commit drop as select gen_random_uuid() as id, i from generate_series(1, 120) i;
  insert into auth.users (id) select id from pool_a union all select id from pool_b union all select unnest(array[u, o1, prov]);
  insert into public.ratings (user_id, game, rating, games_played, wins, peak, display_name) select id, 'zz-a', 1400 + i * 10, 6, i % 5, 1400 + i * 10, 'P' || lpad(i::text, 2, '0') from pool_a;
  insert into public.ratings (user_id, game, rating, games_played, wins, peak, display_name) select id, 'zz-b', 1000 + i, 5, 1, 1000 + i, 'Q' || lpad(i::text, 3, '0') from pool_b;
  insert into public.ratings (user_id, game, rating, games_played, wins, peak, display_name) values (u, 'zz-a', 1550, 6, 3, 1560, 'Uma'), (prov, 'zz-a', 1900, 3, 1, 1900, 'Prov');
  insert into public.player_stats (user_id, game, games_played, wins, coop_wins, seconds_played) values (u, 'zz-a', 9, 4, 1, 5400), (prov, 'zz-a', 3, 1, 0, 600);

  -- 2. The board: the best first, with their place and their score on the ladder, and never a rating
  r := r || pg_temp.check_that('the best three of zz-a, by place',
    (select string_agg(display_name || '#' || place, ' ' order by place) from public.game_standings('zz-a', 3)) = 'P30#1 P29#2 P28#3',
    (select string_agg(display_name || '#' || place, ' ' order by place) from public.game_standings('zz-a', 3)));
  r := r || pg_temp.check_that('the board holds the players who rated five games, not the one with three', (select count(*) from public.game_standings('zz-a')) = 31 and not exists (select 1 from public.game_standings('zz-a') where display_name = 'Prov'), (select count(*) from public.game_standings('zz-a'))::text);
  r := r || pg_temp.check_that('the board is cut at the limit', (select count(*) from public.game_standings('zz-b', 10)) = 10, null);
  r := r || pg_temp.check_that('three Legends of a hundred and twenty', (select count(*) from public.game_standings('zz-b', 1000) where score = 2400) = 3 and (select score from public.game_standings('zz-b', 1000) order by place desc limit 1) = 0, null);
  r := r || pg_temp.check_that('the board returns no rating', not exists (select 1 from information_schema.routines r join information_schema.parameters p on p.specific_name = r.specific_name where r.routine_schema = 'public' and r.routine_name in ('game_standings', 'player_standing', 'player_history') and p.parameter_mode in ('OUT', 'INOUT') and p.parameter_name ilike '%rating%'), null);

  -- 3. Where players stand
  r := r || pg_temp.check_that('a player of the board: totals, place, rank and pool',
    (select games_played = 9 and wins = 5 and seconds_played = 5400 and rated_games = 6 and rated_wins = 3 and display_name = 'Uma' and place = 16 and score = public.ladder_score('zz-a', u, 1550) and pool_size = 31 from public.player_standing(u, 'zz-a')),
    (select format('%s', row(p.*)) from public.player_standing(u, 'zz-a') p));
  r := r || pg_temp.check_that('a player of three rated games has no place and is Apprentice I', (select place is null and score = 0 and rated_games = 3 from public.player_standing(prov, 'zz-a')), null);
  r := r || pg_temp.check_that('a player who rated nothing has no rank, whatever the pool', (select place is null and score is null and rated_games = 0 and games_played = 0 and pool_size = 31 from public.player_standing(stranger, 'zz-a')), null);

  -- 4. The history: a game rated and a game played together, the latest first, with the others at the table and the rank points
  insert into public.game_results (id, game, table_created_at, finished_at, ranked, rating_kind, player_count, duration_s, options, engine_version, coop_outcome) values
    (g1, 'zz-a', '2026-11-08 09:00:00+00', '2026-11-08 10:00:00+00', true, 'elo', 3, 900, '{"rounds": 3}', 't', null),
    (g2, 'zz-a', '2026-11-08 09:00:00+00', '2026-11-08 12:00:00+00', true, 'coop', 2, null, '{}', 't', 'won'),
    (g3, 'zz-b', '2026-11-08 09:00:00+00', '2026-11-08 13:00:00+00', false, 'elo', 2, 60, '{}', 't', null);
  insert into public.game_participants (game_result_id, seat, user_id, display_name, avatar_url, rank, score, outcome, finished_at) values
    (g1, 0, o1, 'Ola', 'https://example.com/o.png', 2, 7, 'loss', '2026-11-08 10:00:00+00'), (g1, 1, u, 'Uma', null, 1, 12, 'win', '2026-11-08 10:00:00+00'), (g1, 2, null, 'Guest', null, 3, 4, 'loss', '2026-11-08 10:00:00+00'),
    (g2, 0, u, 'Uma', null, 1, 5, 'coop_win', '2026-11-08 12:00:00+00'), (g2, 1, o1, 'Ola', null, 1, 5, 'coop_win', '2026-11-08 12:00:00+00'),
    (g3, 0, u, 'Uma', null, 1, 1, 'win', '2026-11-08 13:00:00+00');
  insert into public.rating_changes (game_result_id, user_id, game, rating_before, rating_after) values (g1, u, 'zz-a', 1540, 1556);
  r := r || pg_temp.check_that('the history of a game, the latest first, and only that game', (select string_agg(outcome, ',' order by finished_at desc) from public.player_history(u, 'zz-a')) = 'coop_win,win', (select string_agg(outcome, ',' order by finished_at desc) from public.player_history(u, 'zz-a')));
  r := r || pg_temp.check_that('a game: place, score, players, duration, options and the others at the table by seat',
    (select place = 1 and score = 12 and player_count = 3 and duration_s = 900 and options = '{"rounds": 3}' and opponents = '[{"name": "Ola", "avatarUrl": "https://example.com/o.png"}, {"name": "Guest", "avatarUrl": null}]'::jsonb from public.player_history(u, 'zz-a') where id = g1), null);
  r := r || pg_temp.check_that('the rank points of a rated game are the difference of the two scores, none for a game played together',
    (select points = public.ladder_score('zz-a', u, 1556) - public.ladder_score('zz-a', u, 1540) and points > 0 from public.player_history(u, 'zz-a') where id = g1) and (select points is null from public.player_history(u, 'zz-a') where id = g2),
    (select points::text from public.player_history(u, 'zz-a') where id = g1));
  r := r || pg_temp.check_that('the limit and a player with no game', (select count(*) from public.player_history(u, 'zz-a', 1)) = 1 and (select count(*) from public.player_history(stranger, 'zz-a')) = 0, null);

  -- 5. Who may call what
  r := r || pg_temp.check_that('only the service role calls them',
    not has_function_privilege('anon', 'public.game_standings(text,integer)', 'execute') and not has_function_privilege('authenticated', 'public.player_history(uuid,text,integer)', 'execute')
    and not has_function_privilege('anon', 'public.ladder_score_of(integer,integer)', 'execute') and has_function_privilege('service_role', 'public.player_standing(uuid,text)', 'execute'), null);

  raise exception 'RESULT %', r;
end
$do$;
