-- How each finished game ended (PLT-13): what the history, the stats and the ranks of the platform read.
--
-- `game_results` has a row for each game played to its end, `game_participants` one for each seat of it. A table plays several games (a rematch starts the next one on the same table), so a game is told by its table (`game`
-- and the instant the table was created) and by the instant it ended: together they are unique, and a game written twice is written once. There is no key to `games` on purpose: the table goes 30 days after its last move
-- (`core/lib/retention.ts`), the result stays.
--
-- `game_participants.user_id` is the account that held the seat (`games.member_ids`, migration 0005): null for a guest, and null again once the account is deleted. `display_name` and `avatar_url` are what the table showed
-- for the seat; the trigger at the end erases them with the account, and they go with the row.
--
-- Written by `record_game_result` only, which the server calls once the write that ended the game has gone through: one transaction, and a second call for the same game changes nothing. Read by the server only (service role):
-- row level security is on without policy, like the tables of the games.

create table if not exists public.game_results (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game ~ '^[a-z0-9-]+$'),
  -- With `finished_at`, which game of which table this is
  table_created_at timestamptz not null,
  finished_at timestamptz not null,
  -- The table was ranked, every seat was a different account and no debug command ended it: the game counts for the ratings. Any other game counts for nobody's
  ranked boolean not null default false,
  -- How the game is rated: `elo` when the players play against each other, `coop` when the table wins or loses together, `none` for a game with no rating
  rating_kind text not null check (rating_kind in ('elo', 'coop', 'none')),
  end_reason text not null default 'finished' check (end_reason in ('finished', 'abandoned', 'timeout', 'cancelled')),
  player_count smallint not null check (player_count > 0),
  coop_outcome text check (coop_outcome in ('won', 'lost')),
  coop_score integer,
  -- From the moment play began (`games.started_at`) to the moment it ended; null when the start was not told
  duration_s integer check (duration_s >= 0),
  -- The options the game was played with, expansions included (the engine's `OptionValues`)
  options jsonb not null default '{}'::jsonb,
  -- The commit of the deployment that ran the game, until an engine carries a version of its own
  engine_version text not null,
  unique (game, table_created_at, finished_at),
  check (rating_kind = 'coop' or (coop_outcome is null and coop_score is null)),
  check (rating_kind <> 'coop' or coop_outcome is not null)
);

create index if not exists game_results_game_finished_at_idx on public.game_results (game, finished_at desc);

create table if not exists public.game_participants (
  game_result_id uuid not null references public.game_results (id) on delete cascade,
  seat smallint not null check (seat >= 0),
  -- The account that held the seat: null for a guest, and for a player whose account is gone ("Deleted player")
  user_id uuid references auth.users (id) on delete set null,
  display_name text,
  avatar_url text check (avatar_url ~ '^https://'),
  -- Where the player came: 1 is first, ties share a place
  rank smallint check (rank >= 1),
  score integer,
  outcome text not null check (outcome in ('win', 'loss', 'draw', 'coop_win', 'coop_loss', 'abandoned')),
  -- The seat counts for a rating: the game is ranked and nobody played this seat for its player
  counted_ranked boolean not null default false,
  -- The instant the game ended, again here for the history of a player to be read in order without the results
  finished_at timestamptz not null,
  primary key (game_result_id, seat)
);

create index if not exists game_participants_history_idx on public.game_participants (user_id, finished_at desc) where user_id is not null;

alter table public.game_results enable row level security;
alter table public.game_participants enable row level security;

revoke all on table public.game_results from anon, authenticated;
revoke all on table public.game_participants from anon, authenticated;
grant select, insert, update, delete on table public.game_results to service_role;
grant select, insert, update, delete on table public.game_participants to service_role;

-- What a table must tell for its game to be recorded as it was played. All three are written by functions that the server calls after the response (like `seat_member`), never by the write that moves the game on, so that a
-- project where this migration is not applied yet keeps playing:
-- `started_at`: when play began (the last board was ready, or the rematch was agreed), for the duration of the game;
-- `ranked`: the table was opened to count for the ratings, set when it is created (nothing opens one yet: the matchmaking of PLT-21 will);
-- `taken_over`: the player ids whose moves the others played for them (the takeover), who do not count for a rating.
alter table public.games add column if not exists started_at timestamptz;
alter table public.games add column if not exists ranked boolean not null default false;
alter table public.games add column if not exists taken_over jsonb not null default '[]'::jsonb;

-- A uuid written in a text, null when the text is not one: the accounts of `games.member_ids` are read through it, so that a value that is not an account never stops a game from being recorded
create or replace function public.uuid_or_null(p text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid end;
$$;

-- Play began on a table. Like `seat_member` it changes neither `version` nor `updated_at`: it is not a move. A rematch starts again from nothing.
create or replace function public.mark_game_started(p_game text, p_code text, p_at timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.games set started_at = p_at, taken_over = '[]'::jsonb
  where game = p_game and code = p_code and status = 'playing';
$$;

-- The players the others played for, on a table in play (added to the ones already told)
create or replace function public.mark_taken_over(p_game text, p_code text, p_players text[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.games g
  set taken_over = (select coalesce(jsonb_agg(distinct e.value), '[]'::jsonb) from jsonb_array_elements_text(g.taken_over || to_jsonb(p_players)) as e (value))
  where g.game = p_game and g.code = p_code and g.status = 'playing';
$$;

-- What follows a recorded game (the ratings, the totals of the players): nothing yet, later migrations replace it. It runs in the transaction of `record_game_result`.
create or replace function public.after_game_result(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  null;
end;
$$;

-- Records a game that has just ended: the result and one participant for each seat, or nothing at all when it was recorded already (it answers null then). `p_result` is what the server tells of the game (`core/server/results.ts`):
--   rating_kind, end_reason, coop_outcome, coop_score, engine_version, options, and for each seat (participants) seat, player (the player id of the table), name, avatar_url, rank, score and outcome;
--   debug (a debug command ended the game) and taken_over (the players played for by the takeover that ended it), when they apply.
-- The accounts are the table's (`games.member_ids`), read here and not sent by the server; an account that does not exist any more is a guest. The table is read for what it kept of the game (`started_at`, `ranked`, `taken_over`) and
-- told the game is over, so that the next game starts from nothing.
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
  v_kind text := p_result ->> 'rating_kind';
  v_all_accounts boolean;
  v_ranked boolean;
  v_id uuid;
begin
  select coalesce(g.member_ids, '{}'::jsonb), g.started_at, g.ranked, coalesce(g.taken_over, '[]'::jsonb) || v_taken_over
  into v_members, v_started_at, v_table_ranked, v_taken_over
  from public.games g
  where g.game = p_game and g.code = p_code;

  -- The table may be gone already (deleted): the game is recorded all the same, with a guest in every seat. A select that finds nothing leaves its targets null, so they are set again
  if not found then
    v_members := '{}'::jsonb;
    v_started_at := null;
    v_table_ranked := false;
    v_taken_over := coalesce(p_result -> 'taken_over', '[]'::jsonb);
  end if;

  -- A ranked game is one where every seat is a different account
  select coalesce(bool_and(u.id is not null), false) and count(distinct u.id) = count(*)
  into v_all_accounts
  from jsonb_to_recordset(p_result -> 'participants') as x (player text)
  left join auth.users u on u.id = public.uuid_or_null(v_members ->> x.player);

  v_ranked := v_table_ranked and v_all_accounts and v_kind in ('elo', 'coop') and not coalesce((p_result ->> 'debug')::boolean, false);

  insert into public.game_results (game, table_created_at, finished_at, ranked, rating_kind, end_reason, player_count, coop_outcome, coop_score, duration_s, options, engine_version)
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
    p_result ->> 'engine_version'
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

-- An account that is deleted leaves its games as a "Deleted player": the name and the picture that were kept for its seats go with it (the link to the account is set to null by the key above)
create or replace function public.erase_member_from_results()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.game_participants set display_name = null, avatar_url = null where user_id = old.id;
  return old;
end;
$$;

drop trigger if exists erase_member_from_results on auth.users;
create trigger erase_member_from_results before delete on auth.users for each row execute function public.erase_member_from_results();

-- Server only (service role), like the tables: none of these is callable by the public roles
revoke all on function public.uuid_or_null(text) from public, anon, authenticated;
revoke all on function public.mark_game_started(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.mark_taken_over(text, text, text[]) from public, anon, authenticated;
revoke all on function public.after_game_result(uuid) from public, anon, authenticated;
revoke all on function public.record_game_result(text, text, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.erase_member_from_results() from public, anon, authenticated;
grant execute on function public.uuid_or_null(text) to service_role;
grant execute on function public.mark_game_started(text, text, timestamptz) to service_role;
grant execute on function public.mark_taken_over(text, text, text[]) to service_role;
grant execute on function public.after_game_result(uuid) to service_role;
grant execute on function public.record_game_result(text, text, timestamptz, timestamptz, jsonb) to service_role;
