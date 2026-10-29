-- How many players the platform has had, for the figure under the title of the home.
-- A player is an id in the `players` of a table (the cookie `<slug>_player`: one per game and per browser), counted once per game: a browser that has
-- played two games is two players, since nothing links the two ids. Read by the server only (service role), once in ten minutes: the home caches it.

create or replace function public.player_count()
returns bigint
language sql
stable
set search_path = ''
as $$
  select count(distinct (g.game, p ->> 'id'))
  from public.games g, jsonb_array_elements(g.players) p
  where p ->> 'id' is not null;
$$;

-- Server only (service role), like the tables: RLS is on without policy and the function is not callable by the public roles
revoke all on function public.player_count() from public, anon, authenticated;
grant execute on function public.player_count() to service_role;
