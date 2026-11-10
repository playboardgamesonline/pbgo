-- The friends of the members, end to end (migration 0017): a request to a member by their handle, the request that comes back (which accepts), the answers (accept, decline, cancel), the limits (friends, requests that wait, requests sent, blocks),
-- removing a friend, blocking and unblocking (what a block takes away, and that the blocked member is not told), a closed account that is in nobody's list, the whole state of a member with the presence of their friends and the game they are at
-- (never the table), what is between two members, the cascade of a deleted account, what the tables refuse, and who may call what.
--
-- Run it on `pbgo-preview` once the migration is applied (the Supabase MCP's `execute_sql`, or the SQL editor), or on a throwaway Postgres whose `auth` schema is a stand-in (the migrations 0001 to 0017, then this file). It is one `DO` block that ends with
-- `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled back, and the message is the answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production. It makes fixture rows in `auth.users` that the rollback
-- takes back: it creates no account anywhere. (To try the migration itself without applying it: put the statements of the migration right after the `begin` below, in this same block.)
-- A function that writes and a query that reads what it wrote cannot share a statement (the query keeps the snapshot it started with): each answer is taken into a variable first.

DO $do$
declare
  ua uuid := '00000000-0000-4000-8000-0000000000f1';
  ub uuid := '00000000-0000-4000-8000-0000000000f2';
  uc uuid := '00000000-0000-4000-8000-0000000000f3';
  ud uuid := '00000000-0000-4000-8000-0000000000f4';
  ue uuid := '00000000-0000-4000-8000-0000000000f5';
  uf uuid := '00000000-0000-4000-8000-0000000000f6';
  ug uuid := '00000000-0000-4000-8000-0000000000f7';
  uh uuid := '00000000-0000-4000-8000-0000000000f8';
  ui uuid := '00000000-0000-4000-8000-0000000000f9';
  uj uuid := '00000000-0000-4000-8000-0000000000fa';
  uz uuid := '00000000-0000-4000-8000-0000000000ff';
  hash_b text := repeat('b', 64);
  r text := '';
  answer text;
  state jsonb;
  n integer;
  k integer;
  closed_on timestamptz;
  reopened boolean;
begin
  -- A check: the line tells what it was and what the database said
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;
  -- Whether a statement is refused with this state (23505 a pair that is taken, 23514 a check)
  create function pg_temp.refused_with(p_sql text, p_state text) returns boolean language plpgsql as $f$
  begin
    execute p_sql;
    return false;
  exception when others then
    return sqlstate = p_state;
  end
  $f$;
  -- The entry of a member in one of the lists of the state, by nickname: null when they are not in it
  create function pg_temp.entry(p_state jsonb, p_list text, p_nickname text) returns jsonb language sql as $f$
    select e from jsonb_array_elements(p_state -> p_list) e where e ->> 'nickname' = p_nickname limit 1
  $f$;

  -- Fixtures: nine members, who sign in (a profile is found by its handle only once its account has), and one that has no profile
  insert into auth.users (id, email, raw_user_meta_data) values
    (ua, 'ann@example.test', '{"full_name":"Ann","avatar_url":"https://example.com/ann.png"}'), (ub, 'bob@example.test', '{"full_name":"Bob"}'), (uc, 'cat@example.test', '{"full_name":"Cat"}'),
    (ud, 'dan@example.test', '{"full_name":"Dan"}'), (ue, 'eve@example.test', '{"full_name":"Eve"}'), (uf, 'fay@example.test', '{"full_name":"Fay"}'),
    (ug, 'gus@example.test', '{"full_name":"Gus"}'), (uh, 'hal@example.test', '{"full_name":"Hal"}'), (ui, 'ida@example.test', '{"full_name":"Ida"}'), (uj, 'jon@example.test', '{"full_name":"Jon"}');
  answer := public.set_profile(ua, 'Ann', 1) || public.set_profile(ub, 'Bob', 2) || public.set_profile(uc, 'Cat', 3) || public.set_profile(ud, 'Dan', 4) || public.set_profile(ue, 'Eve', 5)
    || public.set_profile(uf, 'Fay', 6) || public.set_profile(ug, 'Gus', 7) || public.set_profile(uh, 'Hal', 8) || public.set_profile(ui, 'Ida', 9);
  update auth.users set last_sign_in_at = now() where id in (ua, ub, uc, ud, ue, uf, ug, uh, ui);
  delete from public.profiles where user_id = uj;
  r := r || pg_temp.check_that('the fixtures are nine profiles', answer = 'okokokokokokokokok', answer);

  -- 0. The tables: ordered pairs, one request between two members, no self, and who may touch them
  r := r || pg_temp.check_that('a friendship has its lower id first', pg_temp.refused_with(format('insert into public.friendships (user_a, user_b) values (%L, %L)', ub, ua), '23514'), null);
  r := r || pg_temp.check_that('a friendship is not between a member and themselves', pg_temp.refused_with(format('insert into public.friendships (user_a, user_b) values (%L, %L)', ua, ua), '23514'), null);
  r := r || pg_temp.check_that('a pair of friends is written once', pg_temp.refused_with(format('insert into public.friendships (user_a, user_b) values (%L, %L), (%L, %L)', ua, ub, ua, ub), '23505'), null);
  r := r || pg_temp.check_that('a request is not from a member to themselves', pg_temp.refused_with(format('insert into public.friend_requests (sender, recipient) values (%L, %L)', ua, ua), '23514'), null);
  r := r || pg_temp.check_that('two members have one request between them, whichever way it goes', pg_temp.refused_with(format('insert into public.friend_requests (sender, recipient) values (%L, %L), (%L, %L)', ua, ub, ub, ua), '23505'), null);
  r := r || pg_temp.check_that('a member does not block themselves', pg_temp.refused_with(format('insert into public.friend_blocks (blocker, blocked) values (%L, %L)', ua, ua), '23514'), null);
  r := r || pg_temp.check_that('a friendship, a request and a block need an account', pg_temp.refused_with(format('insert into public.friendships (user_a, user_b) values (%L, %L)', ua, uz), '23503')
    and pg_temp.refused_with(format('insert into public.friend_requests (sender, recipient) values (%L, %L)', uz, ua), '23503')
    and pg_temp.refused_with(format('insert into public.friend_blocks (blocker, blocked) values (%L, %L)', ua, uz), '23503'), null);
  perform public.friend_lock(ua, ub);
  perform public.friend_lock(ub, ua);
  perform public.friend_lock(ua, ua);
  r := r || pg_temp.check_that('the lock can be taken for two members, in either order, and for one', true, null);

  -- 1. A request to a member, by their handle
  answer := public.friend_request_send(ua, 'Bob', 2, 200, 50, 100);
  select count(*) into n from public.friend_requests where sender = ua and recipient = ub;
  r := r || pg_temp.check_that('a request waits for the member it is sent to', answer = 'sent' and n = 1, answer || '/' || n::text);
  answer := public.friend_request_send(ua, 'bOB', 2, 200, 50, 100);
  select count(*) into n from public.friend_requests where sender = ua and recipient = ub;
  r := r || pg_temp.check_that('the case of the nickname does not matter, and asking twice is one request', answer = 'sent' and n = 1, answer || '/' || n::text);
  state := public.social_state(ub);
  r := r || pg_temp.check_that('the member sees it as a request that came in, with the sender''s handle and picture', (pg_temp.entry(state, 'incoming', 'Ann') ->> 'tag')::integer = 1 and pg_temp.entry(state, 'incoming', 'Ann') ->> 'avatar_url' = 'https://example.com/ann.png' and jsonb_array_length(state -> 'incoming') = 1, state ->> 'incoming');
  state := public.social_state(ua);
  r := r || pg_temp.check_that('the sender sees it as a request that went out', (pg_temp.entry(state, 'outgoing', 'Bob') ->> 'tag')::integer = 2 and jsonb_array_length(state -> 'outgoing') = 1 and jsonb_array_length(state -> 'incoming') = 0, state ->> 'outgoing');
  r := r || pg_temp.check_that('nobody goes by a handle that is not a member''s, or by another tag', public.friend_request_send(ua, 'Nobody', 1, 200, 50, 100) = 'missing' and public.friend_request_send(ua, 'Bob', 3, 200, 50, 100) = 'missing', null);
  r := r || pg_temp.check_that('a member cannot ask themselves', public.friend_request_send(ua, 'Ann', 1, 200, 50, 100) = 'self' and public.friend_request_send(ua, 'ANN', 1, 200, 50, 100) = 'self', null);
  r := r || pg_temp.check_that('an account with no profile cannot ask', public.friend_request_send(uj, 'Ann', 1, 200, 50, 100) = 'no_profile', null);
  update auth.users set last_sign_in_at = null where id = ui;
  r := r || pg_temp.check_that('a member who never signed in has no page, so they cannot be asked', public.friend_request_send(ua, 'Ida', 9, 200, 50, 100) = 'missing', null);
  update auth.users set last_sign_in_at = now() where id = ui;

  -- 2. The request that comes back accepts the one that went: they are friends, and nothing waits any more
  answer := public.friend_request_send(ub, 'Ann', 1, 200, 50, 100);
  select count(*) into n from public.friendships where user_a = ua and user_b = ub;
  select count(*) into k from public.friend_requests where (sender = ua and recipient = ub) or (sender = ub and recipient = ua);
  r := r || pg_temp.check_that('a request to somebody who asked you accepts theirs', answer = 'accepted' and n = 1 and k = 0, answer || '/' || n::text || '/' || k::text);
  r := r || pg_temp.check_that('asking a friend changes nothing, from either side', public.friend_request_send(ua, 'Bob', 2, 200, 50, 100) = 'friends' and public.friend_request_send(ub, 'Ann', 1, 200, 50, 100) = 'friends', null);
  select count(*) into n from public.friend_requests where ua in (sender, recipient);
  r := r || pg_temp.check_that('and leaves no request', n = 0, n::text);
  state := public.social_state(ub);
  r := r || pg_temp.check_that('each is in the other''s list', pg_temp.entry(public.social_state(ua), 'friends', 'Bob') is not null and pg_temp.entry(state, 'friends', 'Ann') is not null, null);

  -- 3. Answering a request: decline, cancel, and what is refused
  answer := public.friend_request_send(uc, 'Ann', 1, 200, 50, 100);
  r := r || pg_temp.check_that('Cat asks Ann', answer = 'sent', answer);
  answer := public.friend_request_answer(ua, 'Cat', 3, 'decline', 200);
  select count(*) into n from public.friend_requests where sender = uc;
  r := r || pg_temp.check_that('Ann declines: the request is gone and they are not friends', answer = 'declined' and n = 0 and pg_temp.entry(public.social_state(ua), 'friends', 'Cat') is null, answer || '/' || n::text);
  r := r || pg_temp.check_that('declining it again has nothing to decline', public.friend_request_answer(ua, 'Cat', 3, 'decline', 200) = 'missing', null);
  answer := public.friend_request_send(uc, 'Ann', 1, 200, 50, 100);
  answer := answer || public.friend_request_answer(uc, 'Ann', 1, 'cancel', 200);
  select count(*) into n from public.friend_requests where sender = uc;
  r := r || pg_temp.check_that('Cat asks again and cancels: nothing waits', answer = 'sentcancelled' and n = 0, answer);
  r := r || pg_temp.check_that('cancelling it again has nothing to cancel', public.friend_request_answer(uc, 'Ann', 1, 'cancel', 200) = 'missing', null);
  answer := public.friend_request_send(ud, 'Ann', 1, 200, 50, 100);
  r := r || pg_temp.check_that('a request cannot be cancelled by the one it was sent to, nor declined by the one who sent it', public.friend_request_answer(ua, 'Dan', 4, 'cancel', 200) = 'missing' and public.friend_request_answer(ud, 'Ann', 1, 'decline', 200) = 'missing' and public.friend_request_answer(ud, 'Ann', 1, 'accept', 200) = 'missing', null);
  r := r || pg_temp.check_that('a request cannot be accepted by somebody it was not sent to', public.friend_request_answer(ue, 'Dan', 4, 'accept', 200) = 'missing', null);
  r := r || pg_temp.check_that('an answer that is none of the three is nothing', public.friend_request_answer(ua, 'Dan', 4, 'ignore', 200) = 'missing' and public.friend_request_answer(ua, 'Ann', 1, 'accept', 200) = 'missing' and public.friend_request_answer(ua, 'Nobody', 1, 'accept', 200) = 'missing', null);
  answer := public.friend_request_answer(ua, 'dan', 4, 'accept', 200);
  select count(*) into n from public.friendships where user_a = ua and user_b = ud;
  select count(*) into k from public.friend_requests where sender = ud;
  r := r || pg_temp.check_that('Ann accepts Dan: they are friends and nothing waits', answer = 'accepted' and n = 1 and k = 0, answer || '/' || n::text || '/' || k::text);
  r := r || pg_temp.check_that('accepting it again has nothing to accept', public.friend_request_answer(ua, 'Dan', 4, 'accept', 200) = 'missing', null);

  -- 4. The limits (the server gives them: here they are small)
  r := r || pg_temp.check_that('a member with all their friends cannot ask', public.friend_request_send(ua, 'Eve', 5, 2, 50, 100) = 'full', null);
  r := r || pg_temp.check_that('nor can a member be asked who has all of theirs', public.friend_request_send(ue, 'Ann', 1, 2, 50, 100) = 'unavailable', null);
  answer := public.friend_request_send(uc, 'Ann', 1, 200, 50, 100);
  r := r || pg_temp.check_that('Cat asks Ann again', answer = 'sent', answer);
  r := r || pg_temp.check_that('a member with all their friends cannot accept', public.friend_request_answer(ua, 'Cat', 3, 'accept', 2) = 'full', null);
  select count(*) into n from public.friend_requests where sender = uc and recipient = ua;
  r := r || pg_temp.check_that('and the request still waits', n = 1, n::text);
  answer := public.friend_request_answer(ua, 'Cat', 3, 'decline', 200);
  answer := public.friend_request_send(ue, 'Bob', 2, 200, 50, 1);
  r := r || pg_temp.check_that('a member can send as many requests as the limit says', answer = 'sent', answer);
  r := r || pg_temp.check_that('and no more', public.friend_request_send(ue, 'Cat', 3, 200, 50, 1) = 'too_many_sent', null);
  r := r || pg_temp.check_that('the one that waits is still there, and no other was written', (select count(*) from public.friend_requests where sender = ue) = 1, null);
  answer := public.friend_request_answer(ub, 'Eve', 5, 'decline', 200);
  answer := public.friend_request_send(uf, 'Gus', 7, 200, 1, 100);
  r := r || pg_temp.check_that('a member can have as many requests waiting as the limit says', answer = 'sent', answer);
  r := r || pg_temp.check_that('and nobody can ask them for more, whoever asks', public.friend_request_send(uh, 'Gus', 7, 200, 1, 100) = 'unavailable', null);
  r := r || pg_temp.check_that('the one who asked first can ask again, which changes nothing', public.friend_request_send(uf, 'Gus', 7, 200, 1, 100) = 'sent' and (select count(*) from public.friend_requests where recipient = ug) = 1, null);
  answer := public.friend_request_send(ug, 'Fay', 6, 200, 1, 100);
  r := r || pg_temp.check_that('a request that comes back is an answer, not one more waiting', answer = 'accepted', answer);
  r := r || pg_temp.check_that('friends are counted from both sides', (select public.friend_count(ua)) = 2 and (select public.friend_count(ub)) = 1 and (select public.friend_count(ug)) = 1 and (select public.friend_count(uf)) = 1, null);
  answer := public.friend_request_send(uh, 'Gus', 7, 1, 50, 100);
  r := r || pg_temp.check_that('a member with all their friends is not asked, though few requests wait', answer = 'unavailable', answer);
  answer := public.friend_request_send(ug, 'Ida', 9, 200, 50, 100);
  r := r || pg_temp.check_that('Gus asks Ida', answer = 'sent', answer);
  r := r || pg_temp.check_that('a request cannot be accepted when the one who sent it has all their friends', public.friend_request_answer(ui, 'Gus', 7, 'accept', 1) = 'unavailable', null);
  select count(*) into n from public.friend_requests where sender = ug and recipient = ui;
  r := r || pg_temp.check_that('and it still waits', n = 1, n::text);
  answer := public.friend_request_answer(ui, 'Gus', 7, 'decline', 200);

  -- 5. Removing a friend
  answer := public.friend_remove(ua, 'Dan', 4);
  select count(*) into n from public.friendships where user_a = ua and user_b = ud;
  r := r || pg_temp.check_that('a friend is removed', answer = 'removed' and n = 0 and pg_temp.entry(public.social_state(ud), 'friends', 'Ann') is null, answer || '/' || n::text);
  r := r || pg_temp.check_that('removing them again, or somebody who is not a friend, or nobody, is nothing', public.friend_remove(ua, 'Dan', 4) = 'missing' and public.friend_remove(ua, 'Eve', 5) = 'missing' and public.friend_remove(ua, 'Nobody', 1) = 'missing' and public.friend_remove(ua, 'Ann', 1) = 'missing', null);
  answer := public.friend_remove(ub, 'Ann', 1);
  r := r || pg_temp.check_that('either of the two can remove the other', answer = 'removed' and not exists (select 1 from public.friendships where user_a = ua and user_b = ub), answer);
  answer := public.friend_request_send(ua, 'Bob', 2, 200, 50, 100);
  r := r || pg_temp.check_that('they are not friends any more, and can ask again', answer = 'sent', answer);
  answer := public.friend_request_answer(ub, 'Ann', 1, 'accept', 200);
  r := r || pg_temp.check_that('Bob accepts: friends again', answer = 'accepted', answer);

  -- 6. Blocking: the friendship and the requests between two members end, the one who is blocked is not told, and nothing is written for their requests
  answer := public.friend_request_send(ue, 'Ann', 1, 200, 50, 100);
  answer := answer || public.friend_request_send(ua, 'Fay', 6, 200, 50, 100);
  r := r || pg_temp.check_that('Eve asks Ann and Ann asks Fay', answer = 'sentsent', answer);
  answer := public.friend_block(ua, 'Eve', 5, 500);
  select count(*) into n from public.friend_requests where sender = ue and recipient = ua;
  r := r || pg_temp.check_that('Ann blocks Eve: the request she had from Eve goes', answer = 'blocked' and n = 0 and exists (select 1 from public.friend_blocks where blocker = ua and blocked = ue), answer || '/' || n::text);
  answer := public.friend_block(uf, 'Ann', 1, 500);
  select count(*) into n from public.friend_requests where sender = ua and recipient = uf;
  r := r || pg_temp.check_that('Fay blocks Ann: the request Ann had made to Fay goes too', answer = 'blocked' and n = 0, answer || '/' || n::text);
  answer := public.friend_block(ua, 'Bob', 2, 500);
  select count(*) into n from public.friendships where user_a = ua and user_b = ub;
  r := r || pg_temp.check_that('Ann blocks a friend: the friendship ends, and the answer says they were friends', answer = 'blocked_friend' and n = 0, answer || '/' || n::text);
  r := r || pg_temp.check_that('blocking somebody who is blocked changes nothing', public.friend_block(ua, 'Bob', 2, 500) = 'blocked' and (select count(*) from public.friend_blocks where blocker = ua) = 2, null);
  r := r || pg_temp.check_that('nobody can block nobody, nor themselves', public.friend_block(ua, 'Nobody', 1, 500) = 'missing' and public.friend_block(ua, 'Ann', 1, 500) = 'self', null);
  r := r || pg_temp.check_that('a member can block as many members as the limit says, and no more', public.friend_block(ua, 'Cat', 3, 2) = 'full' and not exists (select 1 from public.friend_blocks where blocker = ua and blocked = uc), null);
  -- Who is blocked is not told: their request seems to go, and nothing is stored
  answer := public.friend_request_send(ub, 'Ann', 1, 200, 50, 100);
  select count(*) into n from public.friend_requests where (sender = ub and recipient = ua) or (sender = ua and recipient = ub);
  r := r || pg_temp.check_that('a member who is blocked can ask, as far as they can tell, and nothing is stored', answer = 'sent' and n = 0, answer || '/' || n::text);
  state := public.social_state(ub);
  r := r || pg_temp.check_that('and what they see tells them nothing: no request, no friend, no block', jsonb_array_length(state -> 'outgoing') = 0 and pg_temp.entry(state, 'friends', 'Ann') is null and jsonb_array_length(state -> 'blocked') = 0, state::text);
  r := r || pg_temp.check_that('a member who blocked somebody cannot ask them without lifting the block, and knows why', public.friend_request_send(ua, 'Bob', 2, 200, 50, 100) = 'blocked_by_you', null);
  update public.friend_blocks set created_at = now() - interval '1 hour' where blocker = ua and blocked = ue;
  state := public.social_state(ua);
  r := r || pg_temp.check_that('the blocked are listed, the latest first, with their handle', jsonb_array_length(state -> 'blocked') = 2 and state -> 'blocked' -> 0 ->> 'nickname' = 'Bob' and (state -> 'blocked' -> 1 ->> 'tag')::integer = 5, state ->> 'blocked');
  -- Unblocking
  answer := public.friend_unblock(ua, 'Bob', 2);
  r := r || pg_temp.check_that('a member lifts a block', answer = 'unblocked' and not exists (select 1 from public.friend_blocks where blocker = ua and blocked = ub), answer);
  r := r || pg_temp.check_that('lifting it again, or one that was never there, is nothing', public.friend_unblock(ua, 'Bob', 2) = 'missing' and public.friend_unblock(ua, 'Cat', 3) = 'missing' and public.friend_unblock(ua, 'Nobody', 1) = 'missing' and public.friend_unblock(ua, 'Ann', 1) = 'missing', null);
  select count(*) into n from public.friendships where user_a = ua and user_b = ub;
  r := r || pg_temp.check_that('the friendship does not come back by itself', n = 0, n::text);
  answer := public.friend_request_send(ua, 'Bob', 2, 200, 50, 100);
  r := r || pg_temp.check_that('and a request can be sent again', answer = 'sent' and exists (select 1 from public.friend_requests where sender = ua and recipient = ub), answer);
  answer := public.friend_request_answer(ua, 'Bob', 2, 'cancel', 200);
  answer := public.friend_unblock(ua, 'Eve', 5);
  r := r || pg_temp.check_that('a member can be unblocked whoever blocked them', answer = 'unblocked' and public.friend_unblock(uf, 'Ann', 1) = 'unblocked', answer);

  -- 7. A closed account is in nobody's list and nobody can find it, until it is reopened
  answer := public.friend_request_send(ub, 'Ann', 1, 200, 50, 100);
  answer := public.friend_request_answer(ua, 'Bob', 2, 'accept', 200);
  answer := public.friend_request_send(ua, 'Cat', 3, 200, 50, 100);
  answer := answer || public.friend_request_send(ud, 'Ann', 1, 200, 50, 100);
  r := r || pg_temp.check_that('Ann has a friend, a request that went out and one that came in', answer = 'sentsent' and pg_temp.entry(public.social_state(ua), 'friends', 'Bob') is not null and pg_temp.entry(public.social_state(ua), 'outgoing', 'Cat') is not null and pg_temp.entry(public.social_state(ua), 'incoming', 'Dan') is not null, answer);
  closed_on := public.close_account(ub, hash_b, now() + interval '7 days');
  closed_on := public.close_account(uc, hash_b, now() + interval '7 days');
  closed_on := public.close_account(ud, hash_b, now() + interval '7 days');
  state := public.social_state(ua);
  r := r || pg_temp.check_that('a closed account is in no list: not the friends, not the requests that came in nor those that went out', jsonb_array_length(state -> 'friends') = 0 and jsonb_array_length(state -> 'incoming') = 0 and jsonb_array_length(state -> 'outgoing') = 0, state::text);
  r := r || pg_temp.check_that('and cannot be asked, removed, blocked nor answered', public.friend_request_send(ua, 'Bob', 2, 200, 50, 100) = 'missing' and public.friend_remove(ua, 'Bob', 2) = 'missing' and public.friend_block(ua, 'Bob', 2, 500) = 'missing' and public.friend_request_answer(ua, 'Dan', 4, 'accept', 200) = 'missing', null);
  select count(*) into n from public.friendships where user_a = ua and user_b = ub;
  select count(*) into k from public.friend_requests where (sender = ua and recipient = uc) or (sender = ud and recipient = ua);
  r := r || pg_temp.check_that('its rows are kept meanwhile', n = 1 and k = 2, n::text || '/' || k::text);
  answer := public.friend_block(ua, 'Eve', 5, 500);
  closed_on := public.close_account(ue, hash_b, now() + interval '7 days');
  state := public.social_state(ua);
  r := r || pg_temp.check_that('nor is a blocked member who is closed in the list of those blocked', jsonb_array_length(state -> 'blocked') = 0, state ->> 'blocked');
  reopened := public.reopen_account(ub, hash_b);
  reopened := public.reopen_account(uc, hash_b) and reopened;
  reopened := public.reopen_account(ud, hash_b) and reopened;
  reopened := public.reopen_account(ue, hash_b) and reopened;
  state := public.social_state(ua);
  r := r || pg_temp.check_that('they are all back when the accounts are reopened', reopened and pg_temp.entry(state, 'friends', 'Bob') is not null and pg_temp.entry(state, 'outgoing', 'Cat') is not null and pg_temp.entry(state, 'incoming', 'Dan') is not null and pg_temp.entry(state, 'blocked', 'Eve') is not null, state::text);
  answer := public.friend_unblock(ua, 'Eve', 5);
  answer := public.friend_request_answer(ua, 'Cat', 3, 'cancel', 200) || public.friend_request_answer(ua, 'Dan', 4, 'decline', 200);

  -- 8. What is between two members, as the first may know it
  answer := public.friend_request_send(uc, 'Ann', 1, 200, 50, 100);
  answer := public.friend_request_send(ua, 'Dan', 4, 200, 50, 100);
  answer := public.friend_block(ua, 'Hal', 8, 500);
  answer := public.friend_block(ui, 'Ann', 1, 500);
  r := r || pg_temp.check_that('a friend is a friend', public.friend_relation(ua, ub) = 'friends' and public.friend_relation(ub, ua) = 'friends', null);
  r := r || pg_temp.check_that('a request is incoming for the one who got it and outgoing for the one who sent it', public.friend_relation(ua, uc) = 'incoming' and public.friend_relation(uc, ua) = 'outgoing' and public.friend_relation(ua, ud) = 'outgoing' and public.friend_relation(ud, ua) = 'incoming', null);
  r := r || pg_temp.check_that('a member who blocked is told so, and a member who was blocked is told nothing', public.friend_relation(ua, uh) = 'blocked' and public.friend_relation(uh, ua) = 'none' and public.friend_relation(ua, ui) = 'none' and public.friend_relation(ui, ua) = 'blocked', null);
  r := r || pg_temp.check_that('strangers, oneself and nobody are none', public.friend_relation(ua, ug) = 'none' and public.friend_relation(ua, ua) = 'none' and public.friend_relation(ua, null) = 'none' and public.friend_relation(ua, uz) = 'none', null);
  answer := public.friend_request_answer(ua, 'Cat', 3, 'decline', 200) || public.friend_request_answer(ua, 'Dan', 4, 'cancel', 200) || public.friend_unblock(ua, 'Hal', 8) || public.friend_unblock(ui, 'Ann', 1);

  -- 9. The presence of the friends, and the game they are at, which is never the table
  answer := public.friend_remove(ua, 'Bob', 2);
  insert into public.friendships (user_a, user_b) values (ua, ub), (ua, uc), (ua, ud), (ua, ue), (ua, uf), (ua, ug), (ua, uh), (ua, ui);
  -- Bob beats and sits nowhere. Cat beats and waits in a lobby. Dan does not beat but is at a game that is played, seen by the table 30 s ago. Eve has not been seen for ten minutes by anything, and sits at a game that is played.
  -- Fay beats and sits at a lobby and at a game that is played. Gus beats and left his game. Hal beats and sits at a game that is over. Ida beats and sits at a table nobody wrote to for seven hours.
  insert into public.member_presence (user_id, seen_at) values (ub, now() - interval '30 seconds'), (uc, now() - interval '30 seconds'), (ue, now() - interval '10 minutes'), (uf, now() - interval '119 seconds'),
    (ug, now() - interval '1 minute'), (uh, now() - interval '1 minute'), (ui, now() - interval '1 minute');
  insert into public.games (game, code, host_id, status, players, member_ids, seen, version, created_at, updated_at) values
    ('zz-test', 'LCAT01', 'sc', 'lobby', '[{"id":"sc","nickname":"Cat"}]', jsonb_build_object('sc', uc::text), '{}', 1, now(), now()),
    ('zz-test', 'PDAN01', 'sd', 'playing', '[{"id":"sd","nickname":"Dan"},{"id":"sx","nickname":"Guest"}]', jsonb_build_object('sd', ud::text), jsonb_build_object('sd', now() - interval '30 seconds'), 1, now(), now()),
    ('zz-test', 'PEVE01', 'se', 'playing', '[{"id":"se","nickname":"Eve"}]', jsonb_build_object('se', ue::text), jsonb_build_object('se', now() - interval '10 minutes'), 1, now(), now()),
    ('zz-test', 'LFAY01', 'sf', 'lobby', '[{"id":"sf","nickname":"Fay"}]', jsonb_build_object('sf', uf::text), '{}', 1, now(), now()),
    ('zz-other', 'PFAY01', 'sf', 'starting', '[{"id":"sf","nickname":"Fay"}]', jsonb_build_object('sf', uf::text), '{}', 1, now(), now() - interval '1 hour'),
    ('zz-test', 'PGUS01', 'sg', 'playing', '[{"id":"sg","nickname":"Gus","left":true}]', jsonb_build_object('sg', ug::text), jsonb_build_object('sg', now()), 1, now(), now()),
    ('zz-test', 'OHAL01', 'sh', 'over', '[{"id":"sh","nickname":"Hal"}]', jsonb_build_object('sh', uh::text), jsonb_build_object('sh', now()), 1, now(), now()),
    ('zz-test', 'LIDA01', 'si', 'lobby', '[{"id":"si","nickname":"Ida"}]', jsonb_build_object('si', ui::text), '{}', 1, now() - interval '8 hours', now() - interval '7 hours');
  state := public.social_state(ua);
  r := r || pg_temp.check_that('all eight friends are listed, with their handles, by nickname', jsonb_array_length(state -> 'friends') = 8 and state -> 'friends' -> 0 ->> 'nickname' = 'Bob' and (state -> 'friends' -> 7 ->> 'tag')::integer = 9, state ->> 'friends');
  r := r || pg_temp.check_that('a friend whose tab beats is online, and at no game when they sit at none', (pg_temp.entry(state, 'friends', 'Bob') ->> 'online')::boolean and pg_temp.entry(state, 'friends', 'Bob') -> 'game' = 'null'::jsonb and pg_temp.entry(state, 'friends', 'Bob') -> 'phase' = 'null'::jsonb, pg_temp.entry(state, 'friends', 'Bob')::text);
  r := r || pg_temp.check_that('one who waits at a lobby is online at that game, in its lobby', (pg_temp.entry(state, 'friends', 'Cat') ->> 'online')::boolean and pg_temp.entry(state, 'friends', 'Cat') ->> 'game' = 'zz-test' and pg_temp.entry(state, 'friends', 'Cat') ->> 'phase' = 'lobby', pg_temp.entry(state, 'friends', 'Cat')::text);
  r := r || pg_temp.check_that('one whose tab does not beat is online when their table saw them, and playing', (pg_temp.entry(state, 'friends', 'Dan') ->> 'online')::boolean and pg_temp.entry(state, 'friends', 'Dan') ->> 'game' = 'zz-test' and pg_temp.entry(state, 'friends', 'Dan') ->> 'phase' = 'playing', pg_temp.entry(state, 'friends', 'Dan')::text);
  r := r || pg_temp.check_that('one nobody has seen for ten minutes is offline and shows no game', not (pg_temp.entry(state, 'friends', 'Eve') ->> 'online')::boolean and pg_temp.entry(state, 'friends', 'Eve') -> 'game' = 'null'::jsonb and pg_temp.entry(state, 'friends', 'Eve') -> 'phase' = 'null'::jsonb, pg_temp.entry(state, 'friends', 'Eve')::text);
  r := r || pg_temp.check_that('a beat 119 seconds old counts, and the game that is played comes before the lobby, and a table in its ready check is a game in progress', (pg_temp.entry(state, 'friends', 'Fay') ->> 'online')::boolean and pg_temp.entry(state, 'friends', 'Fay') ->> 'game' = 'zz-other' and pg_temp.entry(state, 'friends', 'Fay') ->> 'phase' = 'playing', pg_temp.entry(state, 'friends', 'Fay')::text);
  r := r || pg_temp.check_that('a seat that was left is no seat', (pg_temp.entry(state, 'friends', 'Gus') ->> 'online')::boolean and pg_temp.entry(state, 'friends', 'Gus') -> 'game' = 'null'::jsonb, pg_temp.entry(state, 'friends', 'Gus')::text);
  r := r || pg_temp.check_that('a table that is over is no game', (pg_temp.entry(state, 'friends', 'Hal') ->> 'online')::boolean and pg_temp.entry(state, 'friends', 'Hal') -> 'game' = 'null'::jsonb, pg_temp.entry(state, 'friends', 'Hal')::text);
  r := r || pg_temp.check_that('a table nobody wrote to for seven hours is no game', (pg_temp.entry(state, 'friends', 'Ida') ->> 'online')::boolean and pg_temp.entry(state, 'friends', 'Ida') -> 'game' = 'null'::jsonb, pg_temp.entry(state, 'friends', 'Ida')::text);
  r := r || pg_temp.check_that('the state holds no code of any table, and no account', state::text !~ '(LCAT01|PDAN01|PEVE01|LFAY01|PFAY01|PGUS01|OHAL01|LIDA01)' and state::text !~* '00000000-0000-4000-8000', null);
  r := r || pg_temp.check_that('a friend sees the other as a friend', pg_temp.entry(public.social_state(ub), 'friends', 'Ann') is not null and jsonb_array_length(public.social_state(ub) -> 'friends') = 1, null);
  r := r || pg_temp.check_that('a member with nobody has nothing in any list', public.social_state(uj) = '{"friends":[],"incoming":[],"outgoing":[],"blocked":[]}'::jsonb and public.social_state(uz) = '{"friends":[],"incoming":[],"outgoing":[],"blocked":[]}'::jsonb, public.social_state(uj)::text);
  delete from public.games where game in ('zz-test', 'zz-other');
  delete from public.member_presence where user_id in (ub, uc, ud, ue, uf, ug, uh, ui);
  delete from public.friendships where user_a = ua and user_b in (ub, uc, ud, ue, uf, ug, uh, ui);

  -- 10. A deleted account takes its rows, the ones it made and the ones it got, and nobody else's
  answer := public.friend_request_send(ub, 'Ann', 1, 200, 50, 100);
  answer := public.friend_request_answer(ua, 'Bob', 2, 'accept', 200);
  answer := public.friend_request_send(ub, 'Cat', 3, 200, 50, 100);
  answer := public.friend_request_send(ud, 'Bob', 2, 200, 50, 100);
  answer := public.friend_block(ub, 'Eve', 5, 500);
  answer := public.friend_block(uf, 'Bob', 2, 500);
  answer := public.friend_request_send(uc, 'Dan', 4, 200, 50, 100);
  answer := public.friend_request_answer(ud, 'Cat', 3, 'accept', 200);
  answer := public.friend_block(uc, 'Gus', 7, 500);
  select count(*) into n from public.friendships where ub in (user_a, user_b);
  select count(*) into k from public.friend_requests where ub in (sender, recipient);
  r := r || pg_temp.check_that('Bob has a friend, two requests and two blocks, one of each way', n = 1 and k = 2 and (select count(*) from public.friend_blocks where ub in (blocker, blocked)) = 2, n::text || '/' || k::text);
  delete from auth.users where id = ub;
  select count(*) into n from public.friendships where ub in (user_a, user_b);
  select count(*) into k from public.friend_requests where ub in (sender, recipient);
  r := r || pg_temp.check_that('the rows of a deleted account go with it', n = 0 and k = 0 and not exists (select 1 from public.friend_blocks where ub in (blocker, blocked)), n::text || '/' || k::text);
  r := r || pg_temp.check_that('nobody else''s do', exists (select 1 from public.friendships where user_a = uc and user_b = ud) and exists (select 1 from public.friend_blocks where blocker = uc and blocked = ug) and exists (select 1 from public.friendships where user_a = uf and user_b = ug), null);
  state := public.social_state(ua);
  r := r || pg_temp.check_that('and nobody lists it', pg_temp.entry(state, 'friends', 'Bob') is null and pg_temp.entry(state, 'incoming', 'Bob') is null and pg_temp.entry(state, 'blocked', 'Bob') is null and pg_temp.entry(public.social_state(ue), 'blocked', 'Bob') is null, state::text);
  r := r || pg_temp.check_that('and its handle finds nobody', public.friend_request_send(ua, 'Bob', 2, 200, 50, 100) = 'missing', null);

  -- 11. Nothing of ours may block the deletion of an account, and who may call what
  select count(*), string_agg(c.conrelid::regclass::text || ' ' || c.confdeltype::text, ', ') into n, answer
  from pg_constraint c join pg_namespace ns on ns.oid = c.connamespace
  where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and ns.nspname = 'public' and c.confdeltype in ('a', 'r');
  r := r || pg_temp.check_that('no table of public holds an account with no action or restrict', n = 0, answer);
  r := r || pg_temp.check_that('the three tables are for the server only', not has_table_privilege('anon', 'public.friendships', 'select') and not has_table_privilege('authenticated', 'public.friendships', 'select')
    and not has_table_privilege('anon', 'public.friend_requests', 'select') and not has_table_privilege('authenticated', 'public.friend_requests', 'insert')
    and not has_table_privilege('anon', 'public.friend_blocks', 'select') and not has_table_privilege('authenticated', 'public.friend_blocks', 'delete')
    and has_table_privilege('service_role', 'public.friendships', 'select') and has_table_privilege('service_role', 'public.friend_requests', 'delete') and has_table_privilege('service_role', 'public.friend_blocks', 'insert'), null);
  r := r || pg_temp.check_that('row level security is on', (select relrowsecurity from pg_class where oid = 'public.friendships'::regclass) and (select relrowsecurity from pg_class where oid = 'public.friend_requests'::regclass) and (select relrowsecurity from pg_class where oid = 'public.friend_blocks'::regclass), null);
  r := r || pg_temp.check_that('no public role may call the functions', not has_function_privilege('anon', 'public.friend_request_send(uuid, text, integer, integer, integer, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.friend_request_send(uuid, text, integer, integer, integer, integer)', 'execute')
    and not has_function_privilege('anon', 'public.friend_request_answer(uuid, text, integer, text, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.friend_remove(uuid, text, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.friend_block(uuid, text, integer, integer)', 'execute')
    and not has_function_privilege('anon', 'public.friend_unblock(uuid, text, integer)', 'execute')
    and not has_function_privilege('anon', 'public.friend_relation(uuid, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.social_state(uuid, interval)', 'execute')
    and not has_function_privilege('anon', 'public.friend_target(text, integer)', 'execute')
    and not has_function_privilege('anon', 'public.friend_count(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.friend_lock(uuid, uuid)', 'execute'), null);
  r := r || pg_temp.check_that('the service role may', has_function_privilege('service_role', 'public.friend_request_send(uuid, text, integer, integer, integer, integer)', 'execute')
    and has_function_privilege('service_role', 'public.friend_request_answer(uuid, text, integer, text, integer)', 'execute')
    and has_function_privilege('service_role', 'public.friend_remove(uuid, text, integer)', 'execute')
    and has_function_privilege('service_role', 'public.friend_block(uuid, text, integer, integer)', 'execute')
    and has_function_privilege('service_role', 'public.friend_unblock(uuid, text, integer)', 'execute')
    and has_function_privilege('service_role', 'public.friend_relation(uuid, uuid)', 'execute')
    and has_function_privilege('service_role', 'public.social_state(uuid, interval)', 'execute'), null);

  raise exception 'RESULT %', r;
end
$do$;
