-- The average place of the friends of a member, for the list of friends on their own profile (`/me/profile`): where each friend came on average in the games they played, which the list says beside their games and their win rate. The two others are read from the totals
-- (`player_stats`) with the server's key, like the rest of the profile (`@pbgo/core/server/friend-roster`); this one is an average over the seats of every game of every friend, which is the database's to do and not the server's to page through.
--
-- `friend_places(p_user)` answers one row for each friend of `p_user` who has a place in at least one game: the friend's account id (which stays on the server: no page sends it to a browser) and the average of `game_participants.rank` to one decimal (1 is first, ties share a place; a game where the
-- engine ranked nobody, as a game played together, has none and is not counted). It reads the seats that are kept: the seats of a ranked game stay, and the seats of an unranked game are folded into the totals and deleted after a year (`fold_old_results`, migration 0008), so it is the average
-- of the ranked games and of the games of the last year. A friend who keeps their games private is for the server to leave out (`hide_history` of their profile), and so is a closed account: the function names friends and does not look at either.
-- Server only (service role), like the tables it reads. Every statement can run again.

create or replace function public.friend_places(p_user uuid)
returns table (friend_id uuid, avg_place numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, round(avg(p.rank)::numeric, 1)
  from public.game_participants p
  where p.rank is not null
    and p.user_id in (
      select case when f.user_a = p_user then f.user_b else f.user_a end
      from public.friendships f
      where f.user_a = p_user or f.user_b = p_user
    )
  group by p.user_id
$$;

revoke all on function public.friend_places(uuid) from public, anon, authenticated;
grant execute on function public.friend_places(uuid) to service_role;
