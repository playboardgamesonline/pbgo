-- A player is on the board of a game from their first rated game: it was their fifth (migrations 0007 and 0009). While few people play a game its board stayed empty, and a ranked game that had been played showed nowhere on its page. The number is in one place,
-- `board_min_games()`: the board, the place of a player and the size of the board read it, and changing it later is redefining that function (the hub says it nowhere).
--
-- The index of the board had the number in its predicate (`games_played >= 5`), which could not follow it: it is a plain index now. A rating exists only after a first rated game.

create or replace function public.board_min_games()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 1;
$$;

drop index if exists public.ratings_board_idx;
create index ratings_board_idx on public.ratings (game, points desc, rating desc);

-- The best players of a game, at most `p_limit`: their place, their points and what the board shows of them (as in 0009, with the number read from `board_min_games()`)
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
    where rt.game = p_game and rt.games_played >= public.board_min_games()
  )
  select p.user_id, p.display_name, p.avatar_url, p.place, p.points, p.wins, p.games_played
  from pool p
  order by p.place, p.peak desc, p.user_id
  limit p_limit;
$$;

-- Where a player stands in a game (as in 0009, with the number read from `board_min_games()`): their totals, the games they rated and won, the name and picture the board has of them, their place on the board (null while they have rated fewer games than the board asks),
-- their rank points (null before their first rated game) and how many players the board has
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
    case when v_rated >= public.board_min_games() then (select 1 + (count(*) filter (where rt.points > v_points or (rt.points = v_points and rt.rating > v_rating)))::integer from public.ratings rt where rt.game = p_game and rt.games_played >= public.board_min_games() and rt.user_id <> p_user) end,
    v_points,
    (select count(*)::integer from public.ratings rt where rt.game = p_game and rt.games_played >= public.board_min_games());
end;
$$;

revoke all on function public.board_min_games() from public, anon, authenticated;
revoke all on function public.game_standings(text, integer) from public, anon, authenticated;
revoke all on function public.player_standing(uuid, text) from public, anon, authenticated;
grant execute on function public.game_standings(text, integer) to service_role;
grant execute on function public.player_standing(uuid, text) to service_role;
