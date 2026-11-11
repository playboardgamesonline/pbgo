-- The speed a game was played at, kept with its result: the profile and the page of a game say it in the rows of the recent games (a table has none to read once it is gone, 30 days after its last move; its result stays).
--
-- A table keeps its speed in `games.settings` (`pace`, migration 0014): `record_game_result` reads it there, with the rest of what the table kept, and writes it in `game_results.pace`. A table that was given no speed was played at the game's own, the normal
-- one, and so was every game recorded before this migration: that is what they read (the games that were played at another speed in the days between 0014 and this one are read as normal too; there are no more than a few, played by the team).
-- `player_history` answers it with the rest of a game, so it is dropped and made again: a function cannot change what it returns in place. Server only (service role), like the others.

alter table public.game_results add column if not exists pace text not null default 'normal';
alter table public.game_results drop constraint if exists game_results_pace_check;
alter table public.game_results add constraint game_results_pace_check check (pace in ('none', 'slow', 'normal', 'fast', 'async'));

-- Records a game that has just ended, as in 0006, with the speed of the table written as well
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
  v_kind text := p_result ->> 'rating_kind';
  v_all_accounts boolean;
  v_ranked boolean;
  v_id uuid;
begin
  select coalesce(g.member_ids, '{}'::jsonb), g.started_at, g.ranked, coalesce(g.taken_over, '[]'::jsonb) || v_taken_over, g.settings ->> 'pace'
  into v_members, v_started_at, v_table_ranked, v_taken_over, v_pace
  from public.games g
  where g.game = p_game and g.code = p_code;

  -- The table may be gone already (deleted): the game is recorded all the same, with a guest in every seat. A select that finds nothing leaves its targets null, so they are set again
  if not found then
    v_members := '{}'::jsonb;
    v_started_at := null;
    v_table_ranked := false;
    v_taken_over := coalesce(p_result -> 'taken_over', '[]'::jsonb);
    v_pace := null;
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

  insert into public.game_participants (game_result_id, seat, user_id, display_name, avatar_url, rank, score, outcome, counted_ranked, finished_at)
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
    p_finished_at
  from jsonb_to_recordset(p_result -> 'participants') as x (seat int, player text, name text, avatar_url text, rank int, score int, outcome text)
  left join auth.users u on u.id = public.uuid_or_null(v_members ->> x.player);

  update public.games set started_at = null, taken_over = '[]'::jsonb where game = p_game and code = p_code;

  perform public.after_game_result(v_id);
  return v_id;
end;
$$;

-- The games a player finished in a game, as in 0015, with the speed they were played at
drop function if exists public.player_history(uuid, text, integer);

create function public.player_history(p_user uuid, p_game text, p_limit integer default 10)
returns table (id uuid, finished_at timestamptz, outcome text, place integer, score integer, player_count integer, duration_s integer, options jsonb, points integer, opponents jsonb, pace text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    gr.id,
    gr.finished_at,
    gp.outcome,
    gp.rank::integer,
    gp.score,
    gr.player_count::integer,
    gr.duration_s,
    gr.options,
    rc.points_after - rc.points_before,
    coalesce((select jsonb_agg(jsonb_build_object('name', o.display_name, 'avatarUrl', o.avatar_url, 'userId', o.user_id) order by o.seat) from public.game_participants o where o.game_result_id = gr.id and o.seat <> gp.seat), '[]'::jsonb),
    gr.pace
  from public.game_participants gp
  join public.game_results gr on gr.id = gp.game_result_id
  left join public.rating_changes rc on rc.game_result_id = gr.id and rc.user_id = p_user
  where gp.user_id = p_user and gr.game = p_game
  order by gr.finished_at desc
  limit p_limit;
$$;

revoke all on function public.record_game_result(text, text, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.player_history(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.record_game_result(text, text, timestamptz, timestamptz, jsonb) to service_role;
grant execute on function public.player_history(uuid, text, integer) to service_role;
