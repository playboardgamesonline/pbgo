-- The totals of the players, and the two things the owner decided about what a recorded game lets go of (PLT-13, the retention of 11 October 2026).
--
-- `player_stats`: for each player and game, how many games they played, how each ended and for how long, counted when the game is recorded. It is what the figures of a player read, so the detail of an old game is not needed for them:
-- the seats of an unranked game older than a year are folded into these totals and deleted (`fold_old_results`), and the game itself (`game_results`, which holds no one) stays. The seats of a ranked game stay. The totals go with
-- the account.
--
-- `drop_finished_states`: the state of a table that is over (hands, decks, the hidden information of the game) is deleted a day after the table was last written, once the game it played is recorded, as the owner decided.
--
-- Both are run by the nightly clean-up (`core/server/retention.ts`, `/api/cron/purge`) with the cutoffs of `core/lib/retention.ts`, in batches, and with `p_dry` they only count. Server only (service role), like the tables.

create table if not exists public.player_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9-]+$'),
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  coop_wins integer not null default 0,
  coop_losses integer not null default 0,
  abandoned integer not null default 0,
  seconds_played bigint not null default 0,
  primary key (user_id, game)
);

alter table public.player_stats enable row level security;
revoke all on table public.player_stats from anon, authenticated;
grant select, insert, update, delete on table public.player_stats to service_role;

-- The seats of the unranked games are folded by their age
create index if not exists game_participants_unranked_idx on public.game_participants (finished_at) where not counted_ranked;

-- A recorded game is counted in the totals of the accounts that held its seats (a guest has none)
create or replace function public.count_game(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game text;
  v_seconds integer;
begin
  select r.game, coalesce(r.duration_s, 0) into v_game, v_seconds
  from public.game_results r
  where r.id = p_id;
  if not found then
    return;
  end if;

  insert into public.player_stats as ps (user_id, game, games_played, wins, losses, draws, coop_wins, coop_losses, abandoned, seconds_played)
  select
    gp.user_id,
    v_game,
    count(*),
    count(*) filter (where gp.outcome = 'win'),
    count(*) filter (where gp.outcome = 'loss'),
    count(*) filter (where gp.outcome = 'draw'),
    count(*) filter (where gp.outcome = 'coop_win'),
    count(*) filter (where gp.outcome = 'coop_loss'),
    count(*) filter (where gp.outcome = 'abandoned'),
    count(*) * v_seconds
  from public.game_participants gp
  where gp.game_result_id = p_id and gp.user_id is not null
  group by gp.user_id
  on conflict (user_id, game) do update
  set games_played = ps.games_played + excluded.games_played,
      wins = ps.wins + excluded.wins,
      losses = ps.losses + excluded.losses,
      draws = ps.draws + excluded.draws,
      coop_wins = ps.coop_wins + excluded.coop_wins,
      coop_losses = ps.coop_losses + excluded.coop_losses,
      abandoned = ps.abandoned + excluded.abandoned,
      seconds_played = ps.seconds_played + excluded.seconds_played;
end;
$$;

-- The games recorded before this migration are counted too, so that the totals hold every seat that is still there
insert into public.player_stats (user_id, game, games_played, wins, losses, draws, coop_wins, coop_losses, abandoned, seconds_played)
select
  gp.user_id,
  gr.game,
  count(*),
  count(*) filter (where gp.outcome = 'win'),
  count(*) filter (where gp.outcome = 'loss'),
  count(*) filter (where gp.outcome = 'draw'),
  count(*) filter (where gp.outcome = 'coop_win'),
  count(*) filter (where gp.outcome = 'coop_loss'),
  count(*) filter (where gp.outcome = 'abandoned'),
  coalesce(sum(gr.duration_s), 0)
from public.game_participants gp
join public.game_results gr on gr.id = gp.game_result_id
where gp.user_id is not null
group by gp.user_id, gr.game
on conflict (user_id, game) do nothing;

-- A recorded game is rated and counted (see migrations 0006 and 0007: this replaces what follows a recorded game)
create or replace function public.after_game_result(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.rate_game(p_id);
  perform public.count_game(p_id);
end;
$$;

-- The seats of the unranked games that ended before `p_before` are deleted, `p_limit` of them at most (the oldest first), and counted. The totals of their players have counted them already; a ranked game keeps its seats.
-- With `p_dry` nothing is deleted: it answers how many would be.
create or replace function public.fold_old_results(p_before timestamptz, p_limit integer default 1000, p_dry boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_dry then
    select count(*) into v_count from public.game_participants gp where gp.finished_at < p_before and not gp.counted_ranked;
    return v_count;
  end if;

  with old as (
    select gp.game_result_id, gp.seat
    from public.game_participants gp
    where gp.finished_at < p_before and not gp.counted_ranked
    order by gp.finished_at
    limit p_limit
  )
  delete from public.game_participants gp using old where gp.game_result_id = old.game_result_id and gp.seat = old.seat;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- The state of the tables that are over and were last written before `p_before` is deleted, `p_limit` tables at most, for the tables whose game is recorded (a table with no result keeps its state until the table itself goes).
-- It changes neither `version` nor `updated_at`. With `p_dry` nothing is deleted: it answers how many would be.
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
  )
  update public.games g set state = null from done where g.game = done.game and g.code = done.code;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.count_game(uuid) from public, anon, authenticated;
revoke all on function public.after_game_result(uuid) from public, anon, authenticated;
revoke all on function public.fold_old_results(timestamptz, integer, boolean) from public, anon, authenticated;
revoke all on function public.drop_finished_states(timestamptz, integer, boolean) from public, anon, authenticated;
grant execute on function public.count_game(uuid) to service_role;
grant execute on function public.after_game_result(uuid) to service_role;
grant execute on function public.fold_old_results(timestamptz, integer, boolean) to service_role;
grant execute on function public.drop_finished_states(timestamptz, integer, boolean) to service_role;
