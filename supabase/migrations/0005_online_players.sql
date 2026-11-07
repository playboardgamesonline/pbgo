-- The players online, as the owner defines them: a member who is connected, or a guest who is at a table. Read by the server only (service role); the home keeps the figure for half a minute.

-- The members who are connected: the last time the server saw each signed-in member with the site open. `POST /api/hub/presence` writes it (`touch_member`) about every 45 seconds from a tab that is in view.
-- One row per member, overwritten at each beat, deleted with the account and by the nightly clean-up a day after the last beat. Server only (service role), like the tables of the games:
-- row level security is on without policy.
create table if not exists public.member_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seen_at timestamptz not null default now()
);

create index if not exists member_presence_seen_at_idx on public.member_presence (seen_at);

alter table public.member_presence enable row level security;

revoke all on table public.member_presence from anon, authenticated;
grant select, insert, update, delete on table public.member_presence to service_role;

create or replace function public.touch_member(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.member_presence (user_id, seen_at) values (p_user, now())
  on conflict (user_id) do update set seen_at = now();
$$;

-- Server only (service role), like the tables: the function is not callable by the public roles
revoke all on function public.touch_member(uuid) from public, anon, authenticated;
grant execute on function public.touch_member(uuid) to service_role;

-- Which seat of a table a signed-in member holds: seat (player id) -> account id, written when a member opens or joins a table and never sent to the browser. A seat has no account of its own
-- (the player id is a hash of a cookie), so this is what lets the count below tell a member from a guest, and count a member once whether they are at a table, on the site or both.
alter table public.games add column if not exists member_ids jsonb not null default '{}'::jsonb;

-- Written by `seat_member` only, which the server calls (after the response) when a signed-in member opens or joins a table. Like `touch_game_player` it changes neither `version` nor `updated_at`: a seat's owner is
-- not a move, it must not wake the clients up nor restart the clock of the table's retention.
create or replace function public.seat_member(p_game text, p_code text, p_seat text, p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.games
  set member_ids = member_ids || jsonb_build_object(p_seat, p_user::text)
  where game = p_game and code = p_code;
$$;

revoke all on function public.seat_member(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.seat_member(text, text, text, uuid) to service_role;

-- Players online: the members seen on the site in the last two minutes or seated at a table that is not over (`games.seen`, which `touch_game_player` writes at most every 15 s per player: migration 0002), each
-- counted once, plus the guests seated at a table in the last two minutes, counted once per game, since a browser that plays two games has two ids that nothing links. A guest who only looks at the site is not counted.
create or replace function public.online_player_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  with seen_now as (
    select g.game, s.key as seat, g.member_ids ->> s.key as account
    from public.games g, jsonb_each_text(g.seen) s
    where g.status <> 'over' and s.value::timestamptz > now() - interval '2 minutes'
  ),
  members as (
    select account from seen_now where account is not null
    union
    select user_id::text from public.member_presence where seen_at > now() - interval '2 minutes'
  )
  select (select count(*) from members) + (select count(*) from (select distinct game, seat from seen_now where account is null) guests);
$$;

revoke all on function public.online_player_count() from public, anon, authenticated;
grant execute on function public.online_player_count() to service_role;
