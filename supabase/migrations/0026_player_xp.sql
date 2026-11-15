-- What gives experience: every game a member plays gives them one point (XP) for each action they played, whatever the game and whether it was ranked, normal or private. The points are added to `profiles.xp` (migration 0023), the only thing the platform stores of a level.
--
-- A table counts the actions of its players while the game is in play (`games.actions`: player id → how many), one at a time, with `count_action`, called after each move a player played themselves (never for a move the server played for somebody: the clock, a player who
-- left). Like `seat_member`, it changes neither `version` nor `updated_at`: it is not a move. `record_game_result` reads the counters with the rest of what the table kept, writes them with the seats of the game (`game_participants.actions`, which the end screen reads for its
-- "+N XP") and clears them; `count_game` adds them to the profiles of the accounts that held the seats (a guest has no profile, so no experience). A game ended by the debug tools gives none, as it counts for no rating. A rematch starts again from nothing
-- (`mark_game_started`). The games recorded before this migration gave none.

alter table public.games add column if not exists actions jsonb not null default '{}'::jsonb;
alter table public.game_participants add column if not exists actions integer not null default 0 check (actions >= 0);

-- One more action played by a player, on a table in play (or the one that has just been won: the move that ends a game is counted before the game is written down)
create or replace function public.count_action(p_game text, p_code text, p_player text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.games
  set actions = jsonb_set(actions, array[p_player], to_jsonb(coalesce((actions ->> p_player)::integer, 0) + 1))
  where game = p_game and code = p_code and status in ('playing', 'over');
$$;

-- Play began on a table, as in 0006, from no action: a rematch starts again from nothing
create or replace function public.mark_game_started(p_game text, p_code text, p_at timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.games set started_at = p_at, taken_over = '[]'::jsonb, actions = '{}'::jsonb
  where game = p_game and code = p_code and status = 'playing';
$$;

-- A recorded game is counted in the totals of the accounts that held its seats (a guest has none), as in 0008, and the actions each of them played are added to their experience
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

  -- The experience: one point for each action, added to the profile of each account at the table. A game that gave no action (a debug game) changes nothing.
  update public.profiles p
  set xp = p.xp + x.points
  from (
    select gp.user_id, sum(gp.actions)::integer as points
    from public.game_participants gp
    where gp.game_result_id = p_id and gp.user_id is not null
    group by gp.user_id
  ) x
  where p.user_id = x.user_id and x.points > 0;
end;
$$;

-- Records a game that has just ended, as in 0022, with the actions each seat played written as well and the counters of the table cleared
create or replace function public.record_game_result(p_game text, p_code text, p_table_created_at timestamptz, p_finished_at timestamptz, p_result jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_members jsonb := '{}'::jsonb;
  v_started_at timestamptz;
  v_table_ranked boolean := false;
  v_taken_over jsonb := coalesce(p_result -> 'taken_over', '[]'::jsonb);
  v_pace text;
  v_actions jsonb := '{}'::jsonb;
  v_kind text := p_result ->> 'rating_kind';
  v_all_accounts boolean;
  v_ranked boolean;
  v_id uuid;
begin
  select coalesce(g.member_ids, '{}'::jsonb), g.started_at, g.ranked, coalesce(g.taken_over, '[]'::jsonb) || v_taken_over, g.settings ->> 'pace', coalesce(g.actions, '{}'::jsonb)
  into v_members, v_started_at, v_table_ranked, v_taken_over, v_pace, v_actions
  from public.games g
  where g.game = p_game and g.code = p_code;

  -- The table may be gone already (deleted): the game is recorded all the same, with a guest in every seat. A select that finds nothing leaves its targets null, so they are set again
  if not found then
    v_members := '{}'::jsonb;
    v_started_at := null;
    v_table_ranked := false;
    v_taken_over := coalesce(p_result -> 'taken_over', '[]'::jsonb);
    v_pace := null;
    v_actions := '{}'::jsonb;
  end if;

  -- A ranked game is one where every seat is a different account
  select coalesce(bool_and(u.id is not null), false) and count(distinct u.id) = count(*)
  into v_all_accounts
  from jsonb_to_recordset(p_result -> 'participants') as x (player text)
  left join auth.users u on u.id = public.uuid_or_null(v_members ->> x.player);

  v_ranked := v_table_ranked and v_all_accounts and v_kind in ('elo', 'coop') and not coalesce((p_result ->> 'debug')::boolean, false);

  insert into public.game_results (game, table_created_at, finished_at, ranked, rating_kind, end_reason, player_count, coop_outcome, coop_score, duration_s, options, engine_version, pace)
  values (
    p_game,
    p_table_created_at,
    p_finished_at,
    v_ranked,
    v_kind,
    coalesce(p_result ->> 'end_reason', 'finished'),
    jsonb_array_length(p_result -> 'participants'),
    p_result ->> 'coop_outcome',
    (p_result ->> 'coop_score')::integer,
    case when v_started_at is not null and v_started_at <= p_finished_at then round(extract(epoch from (p_finished_at - v_started_at)))::integer end,
    coalesce(p_result -> 'options', '{}'::jsonb),
    p_result ->> 'engine_version',
    -- A table that was never given a speed is played at the game's own, the normal one
    case when v_pace in ('none', 'slow', 'normal', 'fast', 'async') then v_pace else 'normal' end
  )
  on conflict (game, table_created_at, finished_at) do nothing
  returning id into v_id;

  -- Written already, by the request that was first
  if v_id is null then
    return null;
  end if;

  insert into public.game_participants (game_result_id, seat, user_id, display_name, avatar_url, rank, score, outcome, counted_ranked, finished_at, actions)
  select
    v_id,
    x.seat,
    u.id,
    left(x.name, 40),
    case when x.avatar_url ~ '^https://' then x.avatar_url end,
    x.rank,
    x.score,
    x.outcome,
    v_ranked and not (v_taken_over @> to_jsonb(x.player)),
    p_finished_at,
    -- The actions the seat played itself; none for a game that the debug tools ended
    case when coalesce((p_result ->> 'debug')::boolean, false) then 0 else greatest(coalesce((v_actions ->> x.player)::integer, 0), 0) end
  from jsonb_to_recordset(p_result -> 'participants') as x (seat int, player text, name text, avatar_url text, rank int, score int, outcome text)
  left join auth.users u on u.id = public.uuid_or_null(v_members ->> x.player);

  update public.games set started_at = null, taken_over = '[]'::jsonb, actions = '{}'::jsonb where game = p_game and code = p_code;

  perform public.after_game_result(v_id);
  return v_id;
end;
$$;

revoke all on function public.count_action(text, text, text) from public, anon, authenticated;
revoke all on function public.mark_game_started(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.count_game(uuid) from public, anon, authenticated;
revoke all on function public.record_game_result(text, text, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.count_action(text, text, text) to service_role;
grant execute on function public.mark_game_started(text, text, timestamptz) to service_role;
grant execute on function public.count_game(uuid) to service_role;
grant execute on function public.record_game_result(text, text, timestamptz, timestamptz, jsonb) to service_role;
