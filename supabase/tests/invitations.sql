-- The table invitations of the members, end to end (migration 0024): who may be invited (a friend, only; a member who was never a friend, was removed, or blocked the sender gets the same refusal), a pending invitation that is not sent twice,
-- the caps, the expiry, peeking, accepting and declining (and that nobody else's invitation exists), the list of a member's invitations (never the code, only the friend's own, nothing from a closed account), what removing a friend or a block
-- takes away, the cascade of a deleted account, and who may call what.
--
-- Run it on a throwaway Postgres whose `auth` schema is a stand-in (the migrations 0001 to 0024, then this file) or on `pbgo-preview` once the migration is applied. One `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled
-- back, and the message is the answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production.

DO $do$
declare
  ua uuid := '00000000-0000-4000-8000-0000000000e1';
  ub uuid := '00000000-0000-4000-8000-0000000000e2';
  uc uuid := '00000000-0000-4000-8000-0000000000e3';
  ud uuid := '00000000-0000-4000-8000-0000000000e4';
  ue uuid := '00000000-0000-4000-8000-0000000000e5';
  r text := '';
  answer text;
  reply jsonb;
  list jsonb;
  inv uuid;
  n integer;
  ttl interval := interval '30 minutes';
begin
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;

  -- The nickname and the tag of a profile (`set_profile` takes a JSON object since 0018)
  create function pg_temp.sp(p_user uuid, p_nickname text, p_tag integer) returns text language sql as $f$
    select public.set_profile(p_user, jsonb_build_object('nickname', p_nickname, 'tag', p_tag))
  $f$;

  -- Fixtures: Ann invites; Bob and Cat are her friends; Dan is nobody's friend; Eve is a friend of Ann who closes her account
  insert into auth.users (id, email, raw_user_meta_data) values
    (ua, 'ann@example.test', '{"full_name":"Ann"}'), (ub, 'bob@example.test', '{"full_name":"Bob"}'), (uc, 'cat@example.test', '{"full_name":"Cat"}'),
    (ud, 'dan@example.test', '{"full_name":"Dan"}'), (ue, 'eve@example.test', '{"full_name":"Eve"}');
  answer := pg_temp.sp(ua, 'Ann', 1) || pg_temp.sp(ub, 'Bob', 2) || pg_temp.sp(uc, 'Cat', 3) || pg_temp.sp(ud, 'Dan', 4) || pg_temp.sp(ue, 'Eve', 5);
  update auth.users set last_sign_in_at = now() where id in (ua, ub, uc, ud, ue);
  insert into public.friendships (user_a, user_b) values (least(ua, ub), greatest(ua, ub)), (least(ua, uc), greatest(ua, uc)), (least(ua, ue), greatest(ua, ue));
  r := r || pg_temp.check_that('the fixtures are five profiles', answer = 'okokokokok', answer);

  -- Sending
  r := r || pg_temp.check_that('a friend is invited', public.invitation_send(ua, 'Bob', 2, 'hanabi', 'K7Q2', ttl, 20, 20) = 'sent', null);
  r := r || pg_temp.check_that('the handle is read as the profiles read it (the case does not matter)', public.invitation_send(ua, 'cAT', 3, 'hanabi', 'K7Q2', ttl, 20, 20) = 'sent', null);
  select count(*) into n from public.table_invitations where sender = ua and status = 'pending';
  r := r || pg_temp.check_that('two are waiting', n = 2, n::text);
  answer := public.invitation_send(ua, 'Bob', 2, 'hanabi', 'K7Q2', ttl, 20, 20);
  select count(*) into n from public.table_invitations where recipient = ub;
  r := r || pg_temp.check_that('a second press for the same friend and table changes nothing', answer = 'sent' and n = 1, answer || n);
  answer := public.invitation_send(ua, 'Bob', 2, 'hanabi', 'ZZZZ', ttl, 20, 20);
  select count(*) into n from public.table_invitations where recipient = ub;
  r := r || pg_temp.check_that('another table is another invitation', answer = 'sent' and n = 2, answer || n);
  r := r || pg_temp.check_that('nobody goes by an unknown handle', public.invitation_send(ua, 'Nobody', 1, 'hanabi', 'K7Q2', ttl, 20, 20) = 'missing', null);
  r := r || pg_temp.check_that('nobody invites themselves', public.invitation_send(ua, 'Ann', 1, 'hanabi', 'K7Q2', ttl, 20, 20) = 'self', null);
  r := r || pg_temp.check_that('a member who is not a friend is refused', public.invitation_send(ua, 'Dan', 4, 'hanabi', 'K7Q2', ttl, 20, 20) = 'not_friends' and not exists (select 1 from public.table_invitations where recipient = ud), null);
  r := r || pg_temp.check_that('a game that is not a slug cannot be written', exists (select 1 from pg_constraint where conrelid = 'public.table_invitations'::regclass and conname = 'table_invitations_game_check'), null);

  -- The caps
  answer := public.invitation_send(ua, 'Cat', 3, 'hanabi', 'AAAA', ttl, 4, 20) || ' ' || public.invitation_send(ua, 'Cat', 3, 'hanabi', 'BBBB', ttl, 4, 20);
  r := r || pg_temp.check_that('a sender at their cap is refused', answer = 'sent too_many_sent', answer);
  r := r || pg_temp.check_that('a friend at their cap cannot be invited more', public.invitation_send(ua, 'Bob', 2, 'hanabi', 'CCCC', ttl, 50, 2) = 'unavailable', null);

  -- The list of a member: theirs, the newest first, no code
  list := public.invitations_for(ub);
  r := r || pg_temp.check_that('Bob sees two, from Ann', jsonb_array_length(list) = 2 and list -> 0 ->> 'nickname' = 'Ann' and list -> 0 ->> 'game' = 'hanabi', list::text);
  r := r || pg_temp.check_that('the list never has the table''s code', position('code' in list::text) = 0 and position('ZZZZ' in list::text) = 0, list::text);
  r := r || pg_temp.check_that('Dan sees none', jsonb_array_length(public.invitations_for(ud)) = 0, null);

  -- Answering
  inv := (list -> 0 ->> 'id')::uuid;
  reply := public.invitation_answer(ub, inv, 'peek');
  r := r || pg_temp.check_that('peeking tells the game and the code and changes nothing', reply ->> 'result' = 'pending' and reply ->> 'game' = 'hanabi' and reply ->> 'code' in ('K7Q2', 'ZZZZ') and (select status from public.table_invitations where id = inv) = 'pending', reply::text);
  r := r || pg_temp.check_that('an invitation of another member does not exist for Cat', public.invitation_answer(uc, inv, 'accept') ->> 'result' = 'missing' and (select status from public.table_invitations where id = inv) = 'pending', null);
  r := r || pg_temp.check_that('an invitation that does not exist is missing', public.invitation_answer(ub, gen_random_uuid(), 'accept') ->> 'result' = 'missing', null);
  r := r || pg_temp.check_that('a word that is no answer is missing', public.invitation_answer(ub, inv, 'maybe') ->> 'result' = 'missing', null);
  reply := public.invitation_answer(ub, inv, 'accept');
  r := r || pg_temp.check_that('accepting says the table and marks it', reply ->> 'result' = 'accepted' and reply ->> 'code' is not null and (select status from public.table_invitations where id = inv) = 'accepted' and (select answered_at from public.table_invitations where id = inv) is not null, reply::text);
  r := r || pg_temp.check_that('an answered invitation is not answered twice', public.invitation_answer(ub, inv, 'accept') ->> 'result' = 'missing' and public.invitation_answer(ub, inv, 'decline') ->> 'result' = 'missing', null);
  r := r || pg_temp.check_that('it leaves the list', jsonb_array_length(public.invitations_for(ub)) = 1, null);
  inv := (public.invitations_for(ub) -> 0 ->> 'id')::uuid;
  reply := public.invitation_answer(ub, inv, 'decline');
  r := r || pg_temp.check_that('declining marks it', reply ->> 'result' = 'declined' and (select status from public.table_invitations where id = inv) = 'declined' and jsonb_array_length(public.invitations_for(ub)) = 0, reply::text);
  answer := public.invitation_send(ua, 'Bob', 2, 'hanabi', 'ZZZZ', ttl, 20, 20);
  r := r || pg_temp.check_that('a declined invitation can be sent again', answer = 'sent' and jsonb_array_length(public.invitations_for(ub)) = 1, answer);

  -- Expiry
  inv := (public.invitations_for(ub) -> 0 ->> 'id')::uuid;
  update public.table_invitations set expires_at = now() - interval '1 minute' where id = inv;
  r := r || pg_temp.check_that('an invitation past its time is not listed', jsonb_array_length(public.invitations_for(ub)) = 0, null);
  reply := public.invitation_answer(ub, inv, 'accept');
  r := r || pg_temp.check_that('it cannot be accepted: it is expired and marked so', reply ->> 'result' = 'expired' and (select status from public.table_invitations where id = inv) = 'expired', reply::text);
  answer := public.invitation_send(ua, 'Bob', 2, 'hanabi', 'ZZZZ', ttl, 20, 20);
  r := r || pg_temp.check_that('an expired invitation can be sent again', answer = 'sent' and jsonb_array_length(public.invitations_for(ub)) = 1, answer);
  update public.table_invitations set expires_at = now() - interval '1 minute' where sender = ua and recipient = ub and status = 'pending';
  answer := public.invitation_send(ua, 'Bob', 2, 'hanabi', 'ZZZZ', ttl, 20, 20);
  r := r || pg_temp.check_that('a stale pending one is marked expired when the pair is invited again', answer = 'sent' and (select count(*) from public.table_invitations where sender = ua and recipient = ub and status = 'pending') = 1, answer);
  update public.table_invitations set created_at = now() - interval '2 days', expires_at = now() - interval '2 days' where sender = ua and recipient = ub and status <> 'pending';
  answer := public.invitation_send(ua, 'Bob', 2, 'hanabi', 'YYYY', ttl, 20, 20);
  r := r || pg_temp.check_that('what is two days old goes when the pair is invited again', answer = 'sent' and not exists (select 1 from public.table_invitations where sender = ua and recipient = ub and created_at < now() - interval '1 day'), answer);

  -- What ends the friendship takes the invitations
  r := r || pg_temp.check_that('Bob has invitations before the friendship ends', exists (select 1 from public.table_invitations where recipient = ub and status = 'pending'), null);
  perform public.friend_remove(ua, 'Bob', 2);
  r := r || pg_temp.check_that('removing a friend takes their invitations away', not exists (select 1 from public.table_invitations where (sender = ua and recipient = ub) or (sender = ub and recipient = ua)), null);
  r := r || pg_temp.check_that('a removed friend cannot be invited', public.invitation_send(ua, 'Bob', 2, 'hanabi', 'K7Q2', ttl, 20, 20) = 'not_friends', null);

  -- Blocks: nothing is sent, nothing tells
  perform public.invitation_send(ua, 'Cat', 3, 'hanabi', 'K7Q2', ttl, 20, 20);
  answer := public.friend_block(uc, 'Ann', 1, 500);
  r := r || pg_temp.check_that('a block ends the friendship and takes the invitations away', answer = 'blocked_friend' and not exists (select 1 from public.table_invitations where sender = ua and recipient = uc), answer);
  r := r || pg_temp.check_that('a member who blocked the sender gets nothing, and the sender is told what a removed friend is told', public.invitation_send(ua, 'Cat', 3, 'hanabi', 'K7Q2', ttl, 20, 20) = 'not_friends' and jsonb_array_length(public.invitations_for(uc)) = 0, null);
  -- A friendship that stands beside a block (it should not): the answer is "sent" and nothing is stored
  insert into public.friendships (user_a, user_b) values (least(ua, uc), greatest(ua, uc));
  r := r || pg_temp.check_that('with a block beside a friendship the answer is sent and nothing is stored', public.invitation_send(ua, 'Cat', 3, 'hanabi', 'K7Q2', ttl, 20, 20) = 'sent' and not exists (select 1 from public.table_invitations where recipient = uc), null);
  delete from public.friendships where least(ua, uc) = user_a and greatest(ua, uc) = user_b;

  -- A closed account is in nobody's list
  perform public.invitation_send(ue, 'Ann', 1, 'hanabi', 'K7Q2', ttl, 20, 20);
  r := r || pg_temp.check_that('Ann sees Eve''s invitation', jsonb_array_length(public.invitations_for(ua)) = 1, null);
  insert into public.account_deletions (user_id, token_hash, scheduled_for) values (ue, repeat('e', 64), now() + interval '7 days');
  r := r || pg_temp.check_that('not once Eve''s account is closed', jsonb_array_length(public.invitations_for(ua)) = 0, null);
  delete from public.account_deletions where user_id = ue;

  -- The cascade
  perform public.invitation_send(ua, 'Eve', 5, 'hanabi', 'K7Q2', ttl, 20, 20);
  delete from auth.users where id = ua;
  select count(*) into n from public.table_invitations where sender in (ua, ue) or recipient in (ua, ue);
  r := r || pg_temp.check_that('deleting an account takes the invitations it made and got', n = 0, n::text);

  -- Who may do what
  r := r || pg_temp.check_that('the table is server only', not has_table_privilege('anon', 'public.table_invitations', 'select') and not has_table_privilege('authenticated', 'public.table_invitations', 'insert')
    and has_table_privilege('service_role', 'public.table_invitations', 'select') and (select relrowsecurity from pg_class where oid = 'public.table_invitations'::regclass), null);
  r := r || pg_temp.check_that('no public role may call the functions', not has_function_privilege('anon', 'public.invitation_send(uuid, text, integer, text, text, interval, integer, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.invitation_answer(uuid, uuid, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.invitations_for(uuid)', 'execute')
    and has_function_privilege('service_role', 'public.invitation_send(uuid, text, integer, text, text, interval, integer, integer)', 'execute')
    and has_function_privilege('service_role', 'public.invitation_answer(uuid, uuid, text)', 'execute')
    and has_function_privilege('service_role', 'public.invitations_for(uuid)', 'execute'), null);

  raise exception 'RESULT %', r;
end
$do$;
