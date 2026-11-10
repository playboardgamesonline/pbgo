-- The settings of a table (PLT-21, phase B): who may join it, how fast it is played and how many seats it has. A table is a row of `games`, whose columns are the engine's (its options, its state, its people): what the host sets at the top of
-- the panel had no place in it, so the button that makes a table public only changed the page, and the list of the public tables of a game was empty by construction.
--
-- `settings` is one object, kept sparse: a key is there only when the host (or the table's creation) set it, and a table that has none is a private table of the game's own speed and seats, as every table was until now. The keys, which the server
-- writes and checks (`packages/core/lib/table-settings.ts`) and no one else:
--   visibility  'public' | 'private'   a public table is listed with the open tables of its game, on the Tables tab and on the home; a private one is reached by its link alone
--   minRank     a tier                 the least rank a player must have in the game to sit at a PUBLIC table (a guest and a player who never played it ranked are the lowest tier)
--   language    a language code        the language a PUBLIC table's players are asked to speak
--   pace        'none' | 'slow' | 'normal' | 'fast' | 'async'   the speed the table was set to
--   seats       a number               how many players the table was set for, between the game's least and most
-- Server only (service role), like the rest of the table: row level security is on for `games` without a policy.
alter table public.games add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.games drop constraint if exists games_settings_is_object;
alter table public.games add constraint games_settings_is_object check (jsonb_typeof(settings) = 'object');

-- The public lobbies of a game, newest first: the one list the platform reads by a setting. Partial, so that the tables nobody lists cost it nothing.
create index if not exists games_public_lobbies_idx on public.games (game, created_at desc) where status = 'lobby' and settings ->> 'visibility' = 'public';

-- The tables to list: the public lobbies (of one game, or of every game when `p_game` is null), newest first. A lobby is listed while somebody who sits at it was seen in the last `p_alive` (`games.seen`, written by whoever reads the table: the page
-- of a lobby asks again every few seconds, and a tab in the background at least once a minute), so that a lobby its people walked away from stops being offered; a seat that left does not count, and a table nobody wrote to for `p_idle` is gone
-- like the rest (`member_tables`, the nightly clean-up). A table that is full is listed all the same: its row says "Full".
create or replace function public.public_tables(p_game text default null, p_alive interval default interval '3 minutes', p_idle interval default interval '6 hours', p_limit integer default 50)
returns table (game text, code text, host_id text, players jsonb, options jsonb, settings jsonb, created_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select g.game, g.code, g.host_id, g.players, g.options, g.settings, g.created_at, g.updated_at
  from public.games g
  where g.status = 'lobby'
    and g.settings ->> 'visibility' = 'public'
    and (p_game is null or g.game = p_game)
    and g.updated_at > now() - p_idle
    and exists (
      select 1
      from jsonb_array_elements(g.players) p
      join jsonb_each_text(g.seen) s on s.key = p ->> 'id'
      where not (p @> '{"left": true}'::jsonb) and s.value::timestamptz > now() - p_alive
    )
  order by g.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- Server only (service role): the function is not callable by the public roles
revoke all on function public.public_tables(text, interval, interval, integer) from public, anon, authenticated;
grant execute on function public.public_tables(text, interval, interval, integer) to service_role;
