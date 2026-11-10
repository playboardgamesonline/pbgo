-- The rules of the tables (PLT-120): a member may sit at several lobbies, but a table does not start while one of its players is in a game, a member who is in a game is taken to it from every page of the hub, and the
-- home lists the member's own tables. Two functions read what those rules need; nothing is written, and there is no new column: a player who left a game in progress stays in the table's `players` with `"left": true`
-- (the engine's state has their seat, so it cannot go), and both functions leave them out.
--
-- A table counts for a player while it is `lobby`, `starting` or `playing` and was written within `p_idle` (six hours: the same time after which the game's page lets go of a table, `TABLE_IDLE_MS` in `core/server/games.ts`).
-- Presence does not count, a move or a join does. A table that is `over` holds nobody.
-- Both are called by the server only (service role), like the tables themselves: they read the account of each seat (`games.member_ids`, migration 0005), which never reaches the browser.

-- The tables the account sits at, not over, the one written last first: the home lists them, and the one that is `starting` or `playing` is where the member is taken. A seat that left is not a seat: the table is not theirs.
-- `players` is what the table shows (the seats in the order they sat down, with their names and pictures), `options` what it is played with, and `seat` the seat the account holds there (to tell their own among the people).
create or replace function public.member_tables(p_user uuid, p_idle interval default interval '6 hours')
returns table (game text, code text, status text, host_id text, players jsonb, options jsonb, created_at timestamptz, updated_at timestamptz, seat text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.game, g.code, g.status, g.host_id, g.players, g.options, g.created_at, g.updated_at, mine.seat
  from public.games g
  cross join lateral (
    select p ->> 'id' as seat
    from jsonb_each_text(g.member_ids) m
    join lateral jsonb_array_elements(g.players) p on p ->> 'id' = m.key
    where m.value = p_user::text and not (p @> '{"left": true}'::jsonb)
    limit 1
  ) mine
  where g.status in ('lobby', 'starting', 'playing')
    and g.updated_at > now() - p_idle
  order by g.updated_at desc
  limit 20;
$$;

-- The seats of a table who are in a game somewhere else: the table starts (or begins a rematch) only when this answers nothing. A seat is busy when it also sits at another table of the same game that is `starting` or `playing`
-- (a guest's seat is the id of their cookie in that game, so that is all a guest can be known by), or, for a seat that belongs to an account, when that account holds a seat at such a table of any game. A seat that left a table is not at it.
create or replace function public.busy_seats(p_game text, p_code text, p_idle interval default interval '6 hours')
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  with seats as (
    select p ->> 'id' as seat, g.member_ids ->> (p ->> 'id') as account
    from public.games g, jsonb_array_elements(g.players) p
    where g.game = p_game and g.code = p_code and not (p @> '{"left": true}'::jsonb)
  )
  select s.seat
  from seats s
  where exists (
    select 1
    from public.games o, jsonb_array_elements(o.players) op
    where not (o.game = p_game and o.code = p_code)
      and o.status in ('starting', 'playing')
      and o.updated_at > now() - p_idle
      and not (op @> '{"left": true}'::jsonb)
      and (
        (o.game = p_game and op ->> 'id' = s.seat)
        or (s.account is not null and o.member_ids ->> (op ->> 'id') = s.account)
      )
  );
$$;

-- Server only (service role): the functions are not callable by the public roles
revoke all on function public.member_tables(uuid, interval) from public, anon, authenticated;
grant execute on function public.member_tables(uuid, interval) to service_role;
revoke all on function public.busy_seats(text, text, interval) from public, anon, authenticated;
grant execute on function public.busy_seats(text, text, interval) to service_role;
