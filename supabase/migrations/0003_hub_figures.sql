-- The figures of the home under its title: how many players are connected now, and how many accounts are registered. Read by the server only (service role); the home keeps
-- the first for a minute and the second for ten.

-- Players connected now: the ids that the server saw in the last two minutes at a table that is not over (`games.seen`, which `touch_game_player` writes at most every 15 s
-- per player: migration 0002), counted once per game, since a browser that plays two games has two ids that nothing links.
create or replace function public.online_player_count()
returns bigint
language sql
stable
set search_path = ''
as $$
  select count(*)
  from (
    select distinct g.game, s.key
    from public.games g, jsonb_each_text(g.seen) s
    where g.status <> 'over' and s.value::timestamptz > now() - interval '2 minutes'
  ) seen_now;
$$;

-- Accounts registered: the users of Supabase Auth that are neither deleted nor anonymous. `auth.users` is not readable by the public roles, so the function runs as its owner.
create or replace function public.member_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from auth.users where deleted_at is null and coalesce(is_anonymous, false) = false;
$$;

-- Server only (service role), like the tables: RLS is on without policy and the functions are not callable by the public roles
revoke all on function public.online_player_count() from public, anon, authenticated;
grant execute on function public.online_player_count() to service_role;
revoke all on function public.member_count() from public, anon, authenticated;
grant execute on function public.member_count() to service_role;
