-- The board of a game, where a player stands and the history of their games (migrations 0009 and 0019), on the tables of 0006 to 0008. The rank is read from the points by the code (`core/lib/ladder.ts`, tested there): here the database
-- answers the points, the places and what each game gave or took.
--
-- Run it on `pbgo-preview` once the migrations are applied (the Supabase MCP's `execute_sql`, or the SQL editor). It is one `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled back, and the
-- message is the answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production.

DO $do$
declare
  u uuid := '00000000-0000-4000-8000-0000000000a1';
  o1 uuid := '00000000-0000-4000-8000-0000000000b2';
  prov uuid := '00000000-0000-4000-8000-0000000000c3';
  stranger uuid := '00000000-0000-4000-8000-0000000000d4';
  rich uuid := '00000000-0000-4000-8000-0000000000e5';
  strong uuid := '00000000-0000-4000-8000-0000000000f6';
  fresh uuid := '00000000-0000-4000-8000-0000000000a7';
  g1 uuid := gen_random_uuid();
  g2 uuid := gen_random_uuid();
  g3 uuid := gen_random_uuid();
  r text := '';
begin
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;

  -- The players of the game zz-a: 30 with 10 to 300 points (and a rating that rises with them, P16 has 160 points and 1560), Uma with 160 and Rich with 160 too but a better rating, a very strong player with few points, a player of three rated games and a player of one
  create temp table pool_a on commit drop as select gen_random_uuid() as id, i from generate_series(1, 30) i;
  insert into auth.users (id) select id from pool_a union all select unnest(array[u, o1, prov, rich, strong, fresh]);
  insert into public.ratings (user_id, game, rating, points, games_played, wins, peak, display_name) select id, 'zz-a', 1400 + i * 10, i * 10, 6, i % 5, 1400 + i * 10, 'P' || lpad(i::text, 2, '0') from pool_a;
  insert into public.ratings (user_id, game, rating, points, games_played, wins, peak, display_name) values
    (u, 'zz-a', 1550, 160, 6, 3, 1560, 'Uma'), (rich, 'zz-a', 1565, 160, 6, 3, 1565, 'Rich'), (strong, 'zz-a', 2000, 55, 6, 5, 2000, 'Strong'), (prov, 'zz-a', 1900, 140, 3, 1, 1900, 'Prov'), (fresh, 'zz-a', 1500, 0, 1, 0, 1500, 'Fresh');
  insert into public.player_stats (user_id, game, games_played, wins, coop_wins, seconds_played) values (u, 'zz-a', 9, 4, 1, 5400), (prov, 'zz-a', 3, 1, 0, 600);

  -- 1. The board: the most points first, with their place and their points, and never a rating
  r := r || pg_temp.check_that('the best three of zz-a, by points', (select string_agg(display_name || '#' || place || '/' || points, ' ' order by place) from public.game_standings('zz-a', 3)) = 'P30#1/300 P29#2/290 P28#3/280',
    (select string_agg(display_name || '#' || place || '/' || points, ' ' order by place) from public.game_standings('zz-a', 3)));
  r := r || pg_temp.check_that('the board asks one rated game', public.board_min_games() = 1, public.board_min_games()::text);
  r := r || pg_temp.check_that('the board holds every player who rated a game, the ones with three and with one included', (select count(*) from public.game_standings('zz-a')) = 35 and exists (select 1 from public.game_standings('zz-a') where display_name = 'Prov') and exists (select 1 from public.game_standings('zz-a') where display_name = 'Fresh'), (select count(*) from public.game_standings('zz-a'))::text);
  r := r || pg_temp.check_that('the board is cut at the limit', (select count(*) from public.game_standings('zz-a', 10)) = 10, null);
  r := r || pg_temp.check_that('the rating does not make the place: a strong player with few points is below the ones with more',
    (select place from public.game_standings('zz-a', 100) where display_name = 'Strong') = 1 + (select count(*) from public.ratings where game = 'zz-a' and points > 55),
    (select place::text from public.game_standings('zz-a', 100) where display_name = 'Strong'));
  r := r || pg_temp.check_that('as many points are told apart by the rating, which is not returned: Rich, then P16, then Uma, each with 160',
    (select place from public.game_standings('zz-a', 100) where display_name = 'Rich') + 1 = (select place from public.game_standings('zz-a', 100) where display_name = 'P16') and (select place from public.game_standings('zz-a', 100) where display_name = 'P16') + 1 = (select place from public.game_standings('zz-a', 100) where display_name = 'Uma'),
    (select string_agg(display_name || '#' || place, ' ' order by place) from public.game_standings('zz-a', 100) where points = 160));
  r := r || pg_temp.check_that('the board returns no rating', not exists (select 1 from information_schema.routines r join information_schema.parameters p on p.specific_name = r.specific_name where r.routine_schema = 'public' and r.routine_name in ('game_standings', 'player_standing', 'player_history') and p.parameter_mode in ('OUT', 'INOUT') and p.parameter_name ilike '%rating%'), null);

  -- 2. Where players stand
  r := r || pg_temp.check_that('a player of the board: totals, rated games, name, the place the board gives them, points and pool',
    (select games_played = 9 and wins = 5 and seconds_played = 5400 and rated_games = 6 and rated_wins = 3 and display_name = 'Uma' and place = (select b.place from public.game_standings('zz-a', 100) b where b.display_name = 'Uma') and points = 160 and pool_size = 35 from public.player_standing(u, 'zz-a')),
    (select format('%s', row(p.*)) from public.player_standing(u, 'zz-a') p));
  r := r || pg_temp.check_that('a player of three rated games is on the board, with the place the board gives them', (select place = (select b.place from public.game_standings('zz-a', 100) b where b.display_name = 'Prov') and points = 140 and rated_games = 3 from public.player_standing(prov, 'zz-a')), (select format('%s', row(p.*)) from public.player_standing(prov, 'zz-a') p));
  r := r || pg_temp.check_that('a player of one rated game is on the board, last, with no points', (select place = 35 and points = 0 and rated_games = 1 from public.player_standing(fresh, 'zz-a')), (select format('%s', row(p.*)) from public.player_standing(fresh, 'zz-a') p));
  r := r || pg_temp.check_that('a player who rated nothing has no points, whatever the board', (select place is null and points is null and rated_games = 0 and games_played = 0 and pool_size = 35 from public.player_standing(stranger, 'zz-a')), null);

  -- 3. The history: a game rated and a game played together, the latest first, with the others at the table and the points
  insert into public.game_results (id, game, table_created_at, finished_at, ranked, rating_kind, player_count, duration_s, options, engine_version, coop_outcome) values
    (g1, 'zz-a', '2026-11-08 09:00:00+00', '2026-11-08 10:00:00+00', true, 'elo', 3, 900, '{"rounds": 3}', 't', null),
    (g2, 'zz-a', '2026-11-08 09:00:00+00', '2026-11-08 12:00:00+00', true, 'coop', 2, null, '{}', 't', 'won'),
    (g3, 'zz-b', '2026-11-08 09:00:00+00', '2026-11-08 13:00:00+00', false, 'elo', 2, 60, '{}', 't', null);
  insert into public.game_participants (game_result_id, seat, user_id, display_name, avatar_url, rank, score, outcome, finished_at) values
    (g1, 0, o1, 'Ola', 'https://example.com/o.png', 2, 7, 'loss', '2026-11-08 10:00:00+00'), (g1, 1, u, 'Uma', null, 1, 12, 'win', '2026-11-08 10:00:00+00'), (g1, 2, null, 'Guest', null, 3, 4, 'loss', '2026-11-08 10:00:00+00'),
    (g2, 0, u, 'Uma', null, 1, 5, 'coop_win', '2026-11-08 12:00:00+00'), (g2, 1, o1, 'Ola', null, 1, 5, 'coop_win', '2026-11-08 12:00:00+00'),
    (g3, 0, u, 'Uma', null, 1, 1, 'win', '2026-11-08 13:00:00+00');
  insert into public.rating_changes (game_result_id, user_id, game, rating_before, rating_after, points_before, points_after) values (g1, u, 'zz-a', 1540, 1556, 144, 160);
  r := r || pg_temp.check_that('the history of a game, the latest first, and only that game', (select string_agg(outcome, ',' order by finished_at desc) from public.player_history(u, 'zz-a')) = 'coop_win,win', (select string_agg(outcome, ',' order by finished_at desc) from public.player_history(u, 'zz-a')));
  r := r || pg_temp.check_that('a game: place, score, players, duration, options, the speed and the others at the table by seat',
    (select place = 1 and score = 12 and player_count = 3 and duration_s = 900 and options = '{"rounds": 3}' and pace = 'normal' and (select jsonb_agg(o - 'userId') from jsonb_array_elements(opponents) o) = '[{"name": "Ola", "avatarUrl": "https://example.com/o.png"}, {"name": "Guest", "avatarUrl": null}]'::jsonb from public.player_history(u, 'zz-a') where id = g1), (select format('%s', row(h.*)) from public.player_history(u, 'zz-a') h where id = g1));
  r := r || pg_temp.check_that('the points a rated game gave are what it added to the total, none for a game played together', (select points = 16 from public.player_history(u, 'zz-a') where id = g1) and (select points is null from public.player_history(u, 'zz-a') where id = g2), (select points::text from public.player_history(u, 'zz-a') where id = g1));
  r := r || pg_temp.check_that('the limit and a player with no game', (select count(*) from public.player_history(u, 'zz-a', 1)) = 1 and (select count(*) from public.player_history(stranger, 'zz-a')) = 0, null);

  -- 4. Who may call what
  r := r || pg_temp.check_that('only the service role calls them',
    not has_function_privilege('anon', 'public.game_standings(text,integer)', 'execute') and not has_function_privilege('authenticated', 'public.player_history(uuid,text,integer)', 'execute')
    and not has_function_privilege('anon', 'public.player_standing(uuid,text)', 'execute') and has_function_privilege('service_role', 'public.player_standing(uuid,text)', 'execute'), null);

  raise exception 'RESULT %', r;
end
$do$;
