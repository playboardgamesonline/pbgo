-- Ranks, the leaderboard of a game and the history of a player (PLT-105, PLT-22, PLT-56): what the pages read of the games that were recorded. They never return a rating: a rating is hidden, and the pages get places, ranks and rank points.
--
-- The ladder is the owner's (PLT-105): nine tiers, Apprentice, Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster and Legend; each tier but Legend has three divisions, I the lowest. A player's rank follows their place among the players of the
-- game who have rated at least 5 games (the pool; `LEADERBOARD_MIN_GAMES` of the hub, and the 5 of `ratings_board_idx`), by the share of the pool above them: Bronze from the top 90%, Silver from 80%, Gold from 70%, Platinum from 50%, Diamond from 20%, Master from 9%, Grandmaster from 3%, and Legend for the
-- 3 best. A division is a third of the share its tier covers. A player who has rated fewer than 5 games is Apprentice I. Until a game has 100 players in its pool no one is above Platinum (the share of a small group is unstable), whatever their
-- place. These are the defaults PLT-105 puts forward; the numbers are in `ladder_score_of` below and nowhere else.
--
-- A rank is told by a score on the ladder: 100 for each of the 24 steps from Apprentice I to Grandmaster III, and the points inside the step (0 to 99, how far the player is through their division); Legend is 2400. The rank points that a
-- game gave or took are the difference between the scores of the rating after it and the rating before it, both placed in the pool as it is now.

-- The score on the ladder of the player who stands at `p_place` in a pool of `p_pool` players
create or replace function public.ladder_score_of(p_place integer, p_pool integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  c_deep_pool constant integer := 100;
  c_legend constant integer := 3;
  v_top double precision := p_place::double precision / greatest(p_pool, 1);
  v_tier integer;
  v_best double precision;
  v_worst double precision;
  v_through double precision;
begin
  if p_pool >= c_deep_pool and p_place <= c_legend then
    return 2400;
  end if;

  -- The tier by the share of the pool above the player, and the share its band covers: from `v_best` (excluded) to `v_worst` (included)
  if p_pool >= c_deep_pool and v_top <= 0.03 then
    v_tier := 7; v_best := 0; v_worst := 0.03;
  elsif p_pool >= c_deep_pool and v_top <= 0.09 then
    v_tier := 6; v_best := 0.03; v_worst := 0.09;
  elsif p_pool >= c_deep_pool and v_top <= 0.20 then
    v_tier := 5; v_best := 0.09; v_worst := 0.20;
  elsif v_top <= 0.50 then
    v_tier := 4; v_best := case when p_pool >= c_deep_pool then 0.20 else 0 end; v_worst := 0.50;
  elsif v_top <= 0.70 then
    v_tier := 3; v_best := 0.50; v_worst := 0.70;
  elsif v_top <= 0.80 then
    v_tier := 2; v_best := 0.70; v_worst := 0.80;
  elsif v_top <= 0.90 then
    v_tier := 1; v_best := 0.80; v_worst := 0.90;
  else
    v_tier := 0; v_best := 0.90; v_worst := 1.0;
  end if;

  -- How far through the band the player is, three divisions of it: 0 at its worst edge, just under 3 at its best
  v_through := least((v_worst - v_top) / (v_worst - v_best), 0.999999) * 3;
  return v_tier * 300 + floor(v_through)::integer * 100 + floor((v_through - floor(v_through)) * 100)::integer;
end;
$$;

-- The score on the ladder that `p_rating` would have for the game, among the players other than `p_user`
create or replace function public.ladder_score(p_game text, p_user uuid, p_rating double precision)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.ladder_score_of(1 + (count(*) filter (where rt.rating > p_rating))::integer, 1 + count(*)::integer)
  from public.ratings rt
  where rt.game = p_game and rt.games_played >= 5 and rt.user_id <> p_user;
$$;

-- The best players of a game, best first, at most `p_limit`: their place, their score on the ladder and what the board shows of them. Players tied for a place share it.
create or replace function public.game_standings(p_game text, p_limit integer default 100)
returns table (user_id uuid, display_name text, avatar_url text, place integer, score integer, wins integer, games_played integer)
language sql
stable
security definer
set search_path = ''
as $$
  with pool as (
    select rt.user_id, rt.display_name, rt.avatar_url, rt.wins, rt.games_played, rt.peak,
           (rank() over (order by rt.rating desc))::integer as place,
           (count(*) over ())::integer as size
    from public.ratings rt
    where rt.game = p_game and rt.games_played >= 5
  )
  select p.user_id, p.display_name, p.avatar_url, p.place, public.ladder_score_of(p.place, p.size), p.wins, p.games_played
  from pool p
  order by p.place, p.peak desc, p.user_id
  limit p_limit;
$$;

-- Where a player stands in a game: their totals, the games they rated and won, the name and picture the board has of them, their place in the pool (null while they have rated fewer than 5), their score on the ladder
-- (null before their first rated game, 0 while they are Apprentice I for want of games) and how many players the pool has
create or replace function public.player_standing(p_user uuid, p_game text)
returns table (games_played integer, wins integer, seconds_played bigint, rated_games integer, rated_wins integer, display_name text, avatar_url text, place integer, score integer, pool_size integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rating double precision;
  v_rated integer;
  v_rated_wins integer;
  v_name text;
  v_avatar text;
begin
  select rt.rating, rt.games_played, rt.wins, rt.display_name, rt.avatar_url into v_rating, v_rated, v_rated_wins, v_name, v_avatar
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
    case when v_rated >= 5 then (select 1 + (count(*) filter (where rt.rating > v_rating))::integer from public.ratings rt where rt.game = p_game and rt.games_played >= 5 and rt.user_id <> p_user) end,
    case when v_rated is null then null when v_rated >= 5 then public.ladder_score(p_game, p_user, v_rating) else 0 end,
    (select count(*)::integer from public.ratings rt where rt.game = p_game and rt.games_played >= 5);
end;
$$;

-- The games a player finished in a game, the latest first, at most `p_limit`: how each ended for them, where they came, how long it lasted, with which options, the rank points it gave or took (null for a game that was not rated)
-- and the others at the table
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
    case when rc.user_id is not null then public.ladder_score(p_game, p_user, rc.rating_after) - public.ladder_score(p_game, p_user, rc.rating_before) end,
    coalesce((select jsonb_agg(jsonb_build_object('name', o.display_name, 'avatarUrl', o.avatar_url) order by o.seat) from public.game_participants o where o.game_result_id = gr.id and o.seat <> gp.seat), '[]'::jsonb)
  from public.game_participants gp
  join public.game_results gr on gr.id = gp.game_result_id
  left join public.rating_changes rc on rc.game_result_id = gr.id and rc.user_id = p_user
  where gp.user_id = p_user and gr.game = p_game
  order by gr.finished_at desc
  limit p_limit;
$$;

revoke all on function public.ladder_score_of(integer, integer) from public, anon, authenticated;
revoke all on function public.ladder_score(text, uuid, double precision) from public, anon, authenticated;
revoke all on function public.game_standings(text, integer) from public, anon, authenticated;
revoke all on function public.player_standing(uuid, text) from public, anon, authenticated;
revoke all on function public.player_history(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.ladder_score_of(integer, integer) to service_role;
grant execute on function public.ladder_score(text, uuid, double precision) to service_role;
grant execute on function public.game_standings(text, integer) to service_role;
grant execute on function public.player_standing(uuid, text) to service_role;
grant execute on function public.player_history(uuid, text, integer) to service_role;
