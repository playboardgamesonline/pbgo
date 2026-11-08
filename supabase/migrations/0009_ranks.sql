-- The board of a game, where a player stands and the history of their games (PLT-105, PLT-22, PLT-56): what the pages read of the games that were recorded. They never return a rating: a rating is hidden, and the pages get places,
-- rank points and what each game gave or took.
--
-- A rank is reached by reaching a number of points: the rank points of a player (`ratings.points`, migration 0007) are earned by playing, more for a win over a stronger player and less for a win over a weaker one, and lost by losing,
-- more to a weaker player than to a stronger one. The rank is read from the points by the same steps for every player of every game (100 points a division, three divisions a tier, Apprentice, Bronze, Silver, Gold, Platinum, Diamond,
-- Master, Grandmaster, then Legend: `core/lib/ladder.ts`), so it does not depend on how many players a game has, nor on where they stand. These functions answer the points; the code reads the rank from them.
--
-- The board holds the players who have rated at least 5 games (`LEADERBOARD_MIN_GAMES` of the hub, and the 5 of `ratings_board_idx`), the most points first; players with as many points are ordered by their rating, which is not returned,
-- and share a place only if they have both.

-- The best players of a game, at most `p_limit`: their place, their points and what the board shows of them
create or replace function public.game_standings(p_game text, p_limit integer default 100)
returns table (user_id uuid, display_name text, avatar_url text, place integer, points integer, wins integer, games_played integer)
language sql
stable
security definer
set search_path = ''
as $$
  with pool as (
    select rt.user_id, rt.display_name, rt.avatar_url, rt.points, rt.wins, rt.games_played, rt.peak,
           (rank() over (order by rt.points desc, rt.rating desc))::integer as place
    from public.ratings rt
    where rt.game = p_game and rt.games_played >= 5
  )
  select p.user_id, p.display_name, p.avatar_url, p.place, p.points, p.wins, p.games_played
  from pool p
  order by p.place, p.peak desc, p.user_id
  limit p_limit;
$$;

-- Where a player stands in a game: their totals, the games they rated and won, the name and picture the board has of them, their place on the board (null while they have rated fewer than 5 games), their rank points (null before
-- their first rated game) and how many players the board has
create or replace function public.player_standing(p_user uuid, p_game text)
returns table (games_played integer, wins integer, seconds_played bigint, rated_games integer, rated_wins integer, display_name text, avatar_url text, place integer, points integer, pool_size integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rating double precision;
  v_points integer;
  v_rated integer;
  v_rated_wins integer;
  v_name text;
  v_avatar text;
begin
  select rt.rating, rt.points, rt.games_played, rt.wins, rt.display_name, rt.avatar_url into v_rating, v_points, v_rated, v_rated_wins, v_name, v_avatar
  from public.ratings rt
  where rt.user_id = p_user and rt.game = p_game;

  return query
  select
    coalesce((select ps.games_played from public.player_stats ps where ps.user_id = p_user and ps.game = p_game), 0),
    coalesce((select ps.wins + ps.coop_wins from public.player_stats ps where ps.user_id = p_user and ps.game = p_game), 0),
    coalesce((select ps.seconds_played from public.player_stats ps where ps.user_id = p_user and ps.game = p_game), 0::bigint),
    coalesce(v_rated, 0),
    coalesce(v_rated_wins, 0),
    v_name,
    v_avatar,
    case when v_rated >= 5 then (select 1 + (count(*) filter (where rt.points > v_points or (rt.points = v_points and rt.rating > v_rating)))::integer from public.ratings rt where rt.game = p_game and rt.games_played >= 5 and rt.user_id <> p_user) end,
    v_points,
    (select count(*)::integer from public.ratings rt where rt.game = p_game and rt.games_played >= 5);
end;
$$;

-- The games a player finished in a game, the latest first, at most `p_limit`: how each ended for them, where they came, how long it lasted, with which options, the rank points it gave (+) or took (-) (null for a game that was not
-- rated) and the others at the table
create or replace function public.player_history(p_user uuid, p_game text, p_limit integer default 10)
returns table (id uuid, finished_at timestamptz, outcome text, place integer, score integer, player_count integer, duration_s integer, options jsonb, points integer, opponents jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select
    gr.id,
    gr.finished_at,
    gp.outcome,
    gp.rank::integer,
    gp.score,
    gr.player_count::integer,
    gr.duration_s,
    gr.options,
    rc.points_after - rc.points_before,
    coalesce((select jsonb_agg(jsonb_build_object('name', o.display_name, 'avatarUrl', o.avatar_url) order by o.seat) from public.game_participants o where o.game_result_id = gr.id and o.seat <> gp.seat), '[]'::jsonb)
  from public.game_participants gp
  join public.game_results gr on gr.id = gp.game_result_id
  left join public.rating_changes rc on rc.game_result_id = gr.id and rc.user_id = p_user
  where gp.user_id = p_user and gr.game = p_game
  order by gr.finished_at desc
  limit p_limit;
$$;

revoke all on function public.game_standings(text, integer) from public, anon, authenticated;
revoke all on function public.player_standing(uuid, text) from public, anon, authenticated;
revoke all on function public.player_history(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.game_standings(text, integer) to service_role;
grant execute on function public.player_standing(uuid, text) to service_role;
grant execute on function public.player_history(uuid, text, integer) to service_role;
