-- The average place of the friends of a member, end to end (migration 0029): which friends are answered, the average of the places they came at, what is left out (a game where nobody was ranked, a player who is not a friend, the member themselves), the lookup from either side of a friendship, and who may call it.
--
-- Run it on `pbgo-preview` once the migrations are applied (the Supabase MCP's `execute_sql`, or the SQL editor). It is one `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled back with the block, and the message is the answer. Every check prints `ok` or `FAIL` with what it saw;
-- read the whole line. Never on production. It makes five fixture rows in `auth.users` that the rollback takes back: it creates no account that stays.

DO $do$
declare
  ua uuid := '00000000-0000-4000-8000-0000000000a1';
  ub uuid := '00000000-0000-4000-8000-0000000000a2';
  uc uuid := '00000000-0000-4000-8000-0000000000a3';
  ud uuid := '00000000-0000-4000-8000-0000000000a4';
  ue uuid := '00000000-0000-4000-8000-0000000000a5';
  g1 uuid := '00000000-0000-4000-8000-0000000000b1';
  g2 uuid := '00000000-0000-4000-8000-0000000000b2';
  g3 uuid := '00000000-0000-4000-8000-0000000000b3';
  t0 timestamptz := '2026-11-01 10:00:00+00';
  r text := '';
begin
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;
  -- What the function answers for a member, as text: one `friend=average` for each row, the friends in the order of their ids
  create function pg_temp.answer(p_user uuid) returns text language sql as $f$
    select coalesce(string_agg(right(friend_id::text, 2) || '=' || avg_place::text, ' ' order by friend_id), 'nobody') from public.friend_places(p_user)
  $f$;

  insert into auth.users (id, email, raw_user_meta_data, created_at, last_sign_in_at) values
    (ua, 'place-a@example.test', '{"pbgo_nickname":"Pia"}', t0, t0),
    (ub, 'place-b@example.test', '{"pbgo_nickname":"Pat"}', t0, t0),
    (uc, 'place-c@example.test', '{"pbgo_nickname":"Pam"}', t0, t0),
    (ud, 'place-d@example.test', '{"pbgo_nickname":"Pol"}', t0, t0),
    (ue, 'place-e@example.test', '{"pbgo_nickname":"Pip"}', t0, t0);
  -- a is the friend of b, c and e; b is the friend of d as well; nobody else is anybody's
  insert into public.friendships (user_a, user_b) values (ua, ub), (ua, uc), (ua, ue), (ub, ud);

  insert into public.game_results (id, game, table_created_at, finished_at, ranked, rating_kind, player_count, coop_outcome, engine_version) values
    (g1, 'zz-p', '2026-11-02 09:00:00+00', '2026-11-02 10:00:00+00', false, 'none', 4, null, 't'),
    (g2, 'zz-p', '2026-11-03 09:00:00+00', '2026-11-03 10:00:00+00', false, 'none', 2, null, 't'),
    (g3, 'zz-q', '2026-11-04 09:00:00+00', '2026-11-04 10:00:00+00', false, 'coop', 2, 'won', 't');
  insert into public.game_participants (game_result_id, seat, user_id, display_name, rank, outcome, finished_at) values
    (g1, 0, ua, 'Pia', 4, 'loss', '2026-11-02 10:00:00+00'), (g1, 1, ub, 'Pat', 1, 'win', '2026-11-02 10:00:00+00'), (g1, 2, uc, 'Pam', 3, 'loss', '2026-11-02 10:00:00+00'), (g1, 3, ud, 'Pol', 2, 'loss', '2026-11-02 10:00:00+00'),
    (g2, 0, ub, 'Pat', 2, 'loss', '2026-11-03 10:00:00+00'), (g2, 1, ua, 'Pia', 1, 'win', '2026-11-03 10:00:00+00'),
    (g3, 0, ub, 'Pat', null, 'coop_win', '2026-11-04 10:00:00+00'), (g3, 1, ue, 'Pip', null, 'coop_win', '2026-11-04 10:00:00+00');

  r := r || pg_temp.check_that('a friend is answered with the average of the places they came at, to one decimal', pg_temp.answer(ua) like '%a2=1.5%' and pg_temp.answer(ua) like '%a3=3.0%', pg_temp.answer(ua));
  r := r || pg_temp.check_that('a game where nobody was ranked is not counted: the places of b are 1 and 2, not three games', pg_temp.answer(ua) like '%a2=1.5%', pg_temp.answer(ua));
  r := r || pg_temp.check_that('a friend who has no place in any game is not answered', pg_temp.answer(ua) not like '%a5=%', pg_temp.answer(ua));
  r := r || pg_temp.check_that('a player who is not a friend of the member is not answered, nor is the member', pg_temp.answer(ua) not like '%a4=%' and pg_temp.answer(ua) not like '%a1=%', pg_temp.answer(ua));
  r := r || pg_temp.check_that('exactly the friends who have a place are answered', pg_temp.answer(ua) = 'a2=1.5 a3=3.0', pg_temp.answer(ua));
  r := r || pg_temp.check_that('the lookup works from either side of a friendship: b has a and d as friends', pg_temp.answer(ub) = 'a1=2.5 a4=2.0', pg_temp.answer(ub));
  r := r || pg_temp.check_that('a member with no friend is answered nobody, and so is a member who is not one', pg_temp.answer(ud) = 'a2=1.5' and pg_temp.answer('00000000-0000-4000-8000-0000000000ff') = 'nobody', pg_temp.answer(ud));
  r := r || pg_temp.check_that('one row for each friend who has a place, and no more', (select count(*) from public.friend_places(ua)) = 2, null);

  r := r || pg_temp.check_that('the average is a number to one decimal: 1.5 and 3.0', (select avg_place from public.friend_places(ua) where friend_id = ub) = 1.5 and (select scale(avg_place) from public.friend_places(ua) where friend_id = uc) = 1, null);

  r := r || pg_temp.check_that('only the service role calls it', has_function_privilege('service_role', 'public.friend_places(uuid)', 'execute') and not has_function_privilege('anon', 'public.friend_places(uuid)', 'execute') and not has_function_privilege('authenticated', 'public.friend_places(uuid)', 'execute'), null);

  raise exception 'RESULT %', r;
end
$do$;
