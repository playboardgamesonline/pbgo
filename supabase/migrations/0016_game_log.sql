-- The log of a game (PLT-45): what happened in it, kept apart from the state. The engine says what each move did (`step`, the `Step` of @pbgo/engine-kit), the server writes it down with the move (`updateGame`, `core/server/game-log.ts`), and each
-- player reads their own view of it (`viewLog`): the history of the game and what a board animates. A game that says nothing writes nothing here.
--
-- One row for each move that said something. `version` is the version of the table that the move produced (`games.version`): it orders the log and says which move said what. `entries` are the move's `LogEntry` (an event in full, `to` the
-- players who read it in full, `masked` what the others read instead), plain data, ids and numbers. They can hold what only some players may know (a card looked at in secret), so they never leave the server as they are: row level security is on
-- without policy, like `games`, and the server sends each player the entries that `viewLog` gives them.
--
-- A log goes with its table (`on delete cascade`: the nightly job deletes a table 30 days after its last write) and with the state of a finished table (`drop_finished_states`, replaced below): a day after the game it played is recorded, when the
-- end screen and the rematch no longer need it. A new game on the same table empties it first: the server does it when the game starts.

create table if not exists public.game_log (
  game text not null,
  code text not null,
  version integer not null check (version > 0),
  entries jsonb not null check (jsonb_typeof(entries) = 'array' and jsonb_array_length(entries) > 0),
  primary key (game, code, version),
  foreign key (game, code) references public.games (game, code) on delete cascade
);

alter table public.game_log enable row level security;

revoke all on table public.game_log from anon, authenticated;
grant select, insert, delete on table public.game_log to service_role;

-- The state of the tables that are over and were last written before `p_before` is deleted, `p_limit` tables at most, for the tables whose game is recorded (a table with no result keeps its state until the table itself goes), and the log of each
-- table goes with its state. It changes neither `version` nor `updated_at`. With `p_dry` nothing is deleted: it answers how many would be. Replaces the function of migration 0008, which did the same without the log.
create or replace function public.drop_finished_states(p_before timestamptz, p_limit integer default 500, p_dry boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_dry then
    select count(*) into v_count
    from public.games g
    where g.status = 'over' and g.state is not null and g.updated_at < p_before
      and exists (select 1 from public.game_results r where r.game = g.game and r.table_created_at = g.created_at);
    return v_count;
  end if;

  with done as (
    select g.game, g.code
    from public.games g
    where g.status = 'over' and g.state is not null and g.updated_at < p_before
      and exists (select 1 from public.game_results r where r.game = g.game and r.table_created_at = g.created_at)
    order by g.updated_at
    limit p_limit
  ),
  dropped as (
    update public.games g set state = null from done where g.game = done.game and g.code = done.code
    returning g.game, g.code
  ),
  logs as (
    delete from public.game_log l using dropped where l.game = dropped.game and l.code = dropped.code
  )
  select count(*) into v_count from dropped;
  return v_count;
end;
$$;
