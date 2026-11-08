-- The ratings of the players, from the games that counted for them (PLT-13, PLT-105).
--
-- A rating is an Elo, per player and game, and it is HIDDEN: it never leaves the server. No type that a browser gets carries it, and what reads ratings for the pages (migration 0009) answers places and ranks, never the rating:
-- the platform shows a rank instead. Only the server reads these tables (service role): row level security is on without policy, like the tables of the games.
--
-- A game counts when it is ranked and rated by Elo (`game_results.ranked`, `rating_kind`) and for the seats that count (`game_participants.counted_ranked`: an account, and a player who played their own moves). The rules are the ones of
-- the final schema of PLT-13: a player starts at 1500; the factor is 32 for a player's first 20 rated games and 16 after; against several opponents a player is compared with each of them in turn and the result is the mean of the
-- comparisons (the game "free for all" of the schema: the pairs, scaled by 1/(n-1)); players who tie for a place share the points of it. A game with fewer than two seats that count changes nothing.
--
-- `rate_game` runs in the transaction that records the game (`after_game_result`), so a game is rated once, with the ratings as they were just before it, and two games that end together with a player in common wait for each other.

create table if not exists public.ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9-]+$'),
  rating double precision not null default 1500,
  -- The rated games: the ones that count, so a player is on the board of a game after their fifth
  games_played integer not null default 0,
  wins integer not null default 0,
  peak double precision not null default 1500,
  last_played_at timestamptz,
  -- What the board of the game shows of a player: the name and the picture they had at their last rated game
  display_name text,
  avatar_url text check (avatar_url ~ '^https://'),
  primary key (user_id, game)
);

create index if not exists ratings_board_idx on public.ratings (game, rating desc) where games_played >= 5;

-- What each rated game did to a rating: the audit of the rating
create table if not exists public.rating_changes (
  game_result_id uuid not null references public.game_results (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9-]+$'),
  rating_before double precision not null,
  rating_after double precision not null,
  primary key (game_result_id, user_id)
);

create index if not exists rating_changes_user_idx on public.rating_changes (user_id, game);

alter table public.ratings enable row level security;
alter table public.rating_changes enable row level security;

revoke all on table public.ratings from anon, authenticated;
revoke all on table public.rating_changes from anon, authenticated;
grant select, insert, update, delete on table public.ratings to service_role;
grant select, insert, update, delete on table public.rating_changes to service_role;

create or replace function public.rate_game(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game text;
  v_finished_at timestamptz;
begin
  select r.game, r.finished_at into v_game, v_finished_at
  from public.game_results r
  where r.id = p_id and r.ranked and r.rating_kind = 'elo';
  if not found then
    return;
  end if;

  -- Everybody whose seat counts has a rating, and the ratings are locked in one order: two games that end together with players in common wait for each other, they do not read each other's ratings half written
  insert into public.ratings (user_id, game)
  select distinct gp.user_id, v_game
  from public.game_participants gp
  where gp.game_result_id = p_id and gp.counted_ranked and gp.user_id is not null
  on conflict (user_id, game) do nothing;

  perform 1
  from public.ratings rt
  where rt.game = v_game and rt.user_id in (select gp.user_id from public.game_participants gp where gp.game_result_id = p_id and gp.counted_ranked and gp.user_id is not null)
  order by rt.user_id
  for update;

  with seats as (
    select gp.user_id, gp.rank, gp.outcome, gp.display_name, gp.avatar_url, rt.rating, rt.games_played
    from public.game_participants gp
    join public.ratings rt on rt.user_id = gp.user_id and rt.game = v_game
    where gp.game_result_id = p_id and gp.counted_ranked and gp.user_id is not null
  ),
  -- Each player against each of the others: what they scored (1 for a better place, a half for the same, 0 for a worse one) and what their rating expected, the means of the pairs
  versus as (
    select a.user_id,
           avg(case when a.rank is null or b.rank is null then 0.5::double precision when a.rank < b.rank then 1::double precision when a.rank = b.rank then 0.5::double precision else 0::double precision end) as actual,
           avg(1 / (1 + power(10::double precision, (b.rating - a.rating) / 400))) as expected
    from seats a
    join seats b on b.user_id <> a.user_id
    group by a.user_id
  ),
  moved as (
    select s.user_id, s.rating as rating_before, s.rating + (case when s.games_played < 20 then 32 else 16 end) * (v.actual - v.expected) as rating_after
    from seats s
    join versus v on v.user_id = s.user_id
  ),
  logged as (
    insert into public.rating_changes (game_result_id, user_id, game, rating_before, rating_after)
    select p_id, m.user_id, v_game, m.rating_before, m.rating_after
    from moved m
    returning user_id
  )
  update public.ratings rt
  set rating = m.rating_after,
      games_played = rt.games_played + 1,
      wins = rt.wins + (case when s.outcome = 'win' then 1 else 0 end),
      peak = greatest(rt.peak, m.rating_after),
      last_played_at = v_finished_at,
      display_name = coalesce(s.display_name, rt.display_name),
      avatar_url = s.avatar_url
  from moved m
  join seats s on s.user_id = m.user_id
  where rt.game = v_game and rt.user_id = m.user_id;
end;
$$;

-- A recorded game is rated (see migration 0006: this replaces what follows a recorded game)
create or replace function public.after_game_result(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.rate_game(p_id);
end;
$$;

revoke all on function public.rate_game(uuid) from public, anon, authenticated;
revoke all on function public.after_game_result(uuid) from public, anon, authenticated;
grant execute on function public.rate_game(uuid) to service_role;
grant execute on function public.after_game_result(uuid) to service_role;
