-- Presence of the players of a table: the last time the server saw each of them (player id -> ISO time).
-- The takeover (core `server/takeover.ts`) counts as present the members seen in the last 75 seconds: an absent player never
-- blocks the vote to play for another absent player.
--
-- Written by `touch_game_player` only, which the server calls (throttled) on reads and writes of a table. It touches neither
-- `version` nor `updated_at`: presence is not a move, it must not wake the clients up nor reset the turn's inactivity clock.

alter table public.games add column if not exists seen jsonb not null default '{}'::jsonb;

create or replace function public.touch_game_player(p_game text, p_code text, p_player text)
returns void
language sql
set search_path = ''
as $$
  update public.games
  set seen = seen || jsonb_build_object(p_player, now())
  where game = p_game and code = p_code;
$$;

-- Server only (service role), like the tables: RLS is on without policy and the function is not callable by the public roles
revoke all on function public.touch_game_player(text, text, text) from public, anon, authenticated;
grant execute on function public.touch_game_player(text, text, text) to service_role;
