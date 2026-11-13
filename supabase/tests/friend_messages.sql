-- The messages between friends, end to end (migration 0025): who may write (a friend, only; never, removed and blocked are one answer), the text (trimmed, empty, too long), the cap of unread messages, the history of a conversation (both sides, in order, the
-- last ones when there are many), the read state and the unread counts, the list of conversations (current friends only, the latest first, no closed account), what ending a friendship deletes, the cascade of a deleted account, and who may call what.
--
-- Run it on a throwaway Postgres whose `auth` schema is a stand-in (the migrations 0001 to 0025, then this file) or on `pbgo-preview` once the migration is applied. One `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled
-- back, and the message is the answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production.
-- A function that writes and a query that reads what it wrote cannot share a statement (the query keeps the snapshot it started with): each answer is taken into a variable first.

DO $do$
declare
  ua uuid := '00000000-0000-4000-8000-0000000000d1';
  ub uuid := '00000000-0000-4000-8000-0000000000d2';
  uc uuid := '00000000-0000-4000-8000-0000000000d3';
  ud uuid := '00000000-0000-4000-8000-0000000000d4';
  ue uuid := '00000000-0000-4000-8000-0000000000d5';
  r text := '';
  answer text;
  reply jsonb;
  list jsonb;
  n integer;
begin
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;
  create function pg_temp.sp(p_user uuid, p_nickname text, p_tag integer) returns text language sql as $f$
    select public.set_profile(p_user, jsonb_build_object('nickname', p_nickname, 'tag', p_tag))
  $f$;
  -- What a send answers, as a word
  create function pg_temp.send(p_from uuid, p_nick text, p_tag integer, p_body text, p_unread integer default 100) returns text language sql as $f$
    select public.message_send(p_from, p_nick, p_tag, p_body, 1000, p_unread) ->> 'result'
  $f$;

  -- Fixtures: Ann writes to her friends Bob and Cat; Dan is nobody's friend; Eve is a friend of Ann who closes her account
  insert into auth.users (id, email, raw_user_meta_data) values
    (ua, 'ann@example.test', '{"full_name":"Ann"}'), (ub, 'bob@example.test', '{"full_name":"Bob"}'), (uc, 'cat@example.test', '{"full_name":"Cat"}'),
    (ud, 'dan@example.test', '{"full_name":"Dan"}'), (ue, 'eve@example.test', '{"full_name":"Eve"}');
  answer := pg_temp.sp(ua, 'Ann', 1) || pg_temp.sp(ub, 'Bob', 2) || pg_temp.sp(uc, 'Cat', 3) || pg_temp.sp(ud, 'Dan', 4) || pg_temp.sp(ue, 'Eve', 5);
  update auth.users set last_sign_in_at = now() where id in (ua, ub, uc, ud, ue);
  insert into public.friendships (user_a, user_b) values (least(ua, ub), greatest(ua, ub)), (least(ua, uc), greatest(ua, uc)), (least(ua, ue), greatest(ua, ue));
  r := r || pg_temp.check_that('the fixtures are five profiles', answer = 'okokokokok', answer);

  -- Sending
  reply := public.message_send(ua, 'bob', 2, '  Hello Bob  ', 1000, 100);
  r := r || pg_temp.check_that('a friend is written to, the text trimmed, the handle read as the profiles read it', reply ->> 'result' = 'sent' and reply ->> 'id' is not null and reply ->> 'at' is not null
    and (select body from public.friend_messages where id = (reply ->> 'id')::bigint) = 'Hello Bob', reply::text);
  r := r || pg_temp.check_that('nobody goes by an unknown handle', pg_temp.send(ua, 'Nobody', 1, 'x') = 'missing', null);
  r := r || pg_temp.check_that('nobody writes to themselves', pg_temp.send(ua, 'Ann', 1, 'x') = 'self', null);
  r := r || pg_temp.check_that('a member who is not a friend is refused and nothing is kept', pg_temp.send(ua, 'Dan', 4, 'x') = 'not_friends' and not exists (select 1 from public.friend_messages where recipient = ud), null);
  r := r || pg_temp.check_that('nothing but spaces is empty', pg_temp.send(ua, 'Bob', 2, '   ') = 'empty' and pg_temp.send(ua, 'Bob', 2, null) = 'empty', null);
  r := r || pg_temp.check_that('more than the length given is too long, exactly that is not', pg_temp.send(ua, 'Bob', 2, repeat('x', 1001)) = 'too_long' and pg_temp.send(ua, 'Bob', 2, repeat('y', 1000)) = 'sent', null);
  r := r || pg_temp.check_that('the table itself refuses more than 2000 characters', exists (select 1 from pg_constraint where conrelid = 'public.friend_messages'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%2000%'), null);

  -- The cap of unread messages
  select count(*) into n from public.friend_messages where sender = ua and recipient = ub and read_at is null;
  answer := pg_temp.send(ua, 'Bob', 2, 'one more', n);
  r := r || pg_temp.check_that('a sender at their cap of unread messages is refused', answer = 'too_many', answer || ' ' || n);

  -- The history, both sides, in order
  perform pg_temp.send(ub, 'Ann', 1, 'Hi Ann');
  perform pg_temp.send(ua, 'Bob', 2, 'How are you?');
  reply := public.messages_with(ua, 'Bob', 2, 50);
  r := r || pg_temp.check_that('the history has both sides, the oldest first, and what is mine', reply ->> 'result' = 'ok' and jsonb_array_length(reply -> 'messages') = 4
    and reply -> 'messages' -> 0 ->> 'text' = 'Hello Bob' and (reply -> 'messages' -> 0 ->> 'mine')::boolean and reply -> 'messages' -> 2 ->> 'text' = 'Hi Ann' and not (reply -> 'messages' -> 2 ->> 'mine')::boolean
    and reply -> 'messages' -> 3 ->> 'text' = 'How are you?', reply::text);
  reply := public.messages_with(ub, 'Ann', 1, 2);
  r := r || pg_temp.check_that('only the last ones come when there are many, still oldest first', jsonb_array_length(reply -> 'messages') = 2 and reply -> 'messages' -> 1 ->> 'text' = 'How are you?' and reply -> 'messages' -> 0 ->> 'text' = 'Hi Ann', reply::text);
  r := r || pg_temp.check_that('Cat has none with Ann', jsonb_array_length(public.messages_with(uc, 'Ann', 1, 50) -> 'messages') = 0, null);
  r := r || pg_temp.check_that('a member who is not a friend reads nothing', public.messages_with(ud, 'Ann', 1, 50) ->> 'result' = 'not_friends' and public.messages_with(ua, 'Dan', 4, 50) ->> 'result' = 'not_friends', null);
  r := r || pg_temp.check_that('an unknown handle is missing', public.messages_with(ua, 'Nobody', 9, 50) ->> 'result' = 'missing', null);

  -- Read state and counts
  reply := public.messages_with(ua, 'Bob', 2, 50);
  r := r || pg_temp.check_that('Ann has one message of Bob not read', (reply ->> 'unread')::integer = 1, reply ->> 'unread');
  list := public.conversations_for(ua, 50);
  r := r || pg_temp.check_that('the list has Bob with the count and the last message, and nobody who has not written', jsonb_array_length(list) = 1 and list -> 0 ->> 'nickname' = 'Bob' and (list -> 0 ->> 'unread')::integer = 1
    and list -> 0 ->> 'last_text' = 'How are you?' and (list -> 0 ->> 'last_mine')::boolean, list::text);
  list := public.conversations_for(ub, 50);
  r := r || pg_temp.check_that('for Bob the unread are Ann''s three, and the last message is not his', jsonb_array_length(list) = 1 and (list -> 0 ->> 'unread')::integer = 3 and not (list -> 0 ->> 'last_mine')::boolean, list::text);
  n := public.messages_read(ua, 'Bob', 2);
  r := r || pg_temp.check_that('reading marks what the friend wrote, once', n = 1 and public.messages_read(ua, 'Bob', 2) = 0, n::text);
  reply := public.messages_with(ua, 'Bob', 2, 50);
  r := r || pg_temp.check_that('nothing is unread then, and Bob''s own messages are not marked by Ann reading', (reply ->> 'unread')::integer = 0 and (select count(*) from public.friend_messages where sender = ua and recipient = ub and read_at is null) = 3, reply ->> 'unread');
  r := r || pg_temp.check_that('reading a conversation of nobody or of a stranger marks nothing', public.messages_read(ua, 'Dan', 4) = 0 and public.messages_read(ua, 'Nobody', 9) = 0, null);
  n := public.messages_read(ub, 'Ann', 1);
  answer := pg_temp.send(ua, 'Bob', 2, 'later', 1);
  r := r || pg_temp.check_that('after Bob reads, Ann is under the cap again', n = 3 and answer = 'sent', n || ' ' || answer);

  -- The list: latest first, current friends only, no closed account
  perform pg_temp.send(uc, 'Ann', 1, 'Cat here');
  list := public.conversations_for(ua, 50);
  r := r || pg_temp.check_that('the conversation with the latest message is first', jsonb_array_length(list) = 2 and list -> 0 ->> 'nickname' in ('Bob', 'Cat'), list::text);
  list := public.conversations_for(ua, 1);
  r := r || pg_temp.check_that('the limit is kept', jsonb_array_length(list) = 1, list::text);
  perform pg_temp.send(ue, 'Ann', 1, 'Eve here');
  insert into public.account_deletions (user_id, token_hash, scheduled_for) values (ue, repeat('e', 64), now() + interval '7 days');
  list := public.conversations_for(ua, 50);
  r := r || pg_temp.check_that('a closed account is in no list', not exists (select 1 from jsonb_array_elements(list) e where e ->> 'nickname' = 'Eve'), list::text);
  delete from public.account_deletions where user_id = ue;

  -- What ends the friendship takes the messages
  perform public.friend_remove(ua, 'Bob', 2);
  select count(*) into n from public.friend_messages where (sender = ua and recipient = ub) or (sender = ub and recipient = ua);
  r := r || pg_temp.check_that('removing a friend deletes the messages between them', n = 0, n::text);
  r := r || pg_temp.check_that('and nothing can be written or read after', pg_temp.send(ua, 'Bob', 2, 'hi') = 'not_friends' and public.messages_with(ua, 'Bob', 2, 50) ->> 'result' = 'not_friends', null);
  answer := public.friend_block(uc, 'Ann', 1, 500);
  select count(*) into n from public.friend_messages where sender in (ua, uc) and recipient in (ua, uc);
  r := r || pg_temp.check_that('a block deletes them too and the blocked member is refused with the same answer', answer = 'blocked_friend' and n = 0 and pg_temp.send(ua, 'Cat', 3, 'hi') = 'not_friends', answer || ' ' || n);
  -- A friendship that stands beside a block (it should not): the message is refused all the same
  insert into public.friendships (user_a, user_b) values (least(ua, uc), greatest(ua, uc));
  r := r || pg_temp.check_that('a friendship beside a block does not let a message through', pg_temp.send(ua, 'Cat', 3, 'hi') = 'not_friends', null);
  delete from public.friendships where user_a = least(ua, uc) and user_b = greatest(ua, uc);

  -- The cascade
  perform pg_temp.send(ue, 'Ann', 1, 'bye');
  delete from auth.users where id = ue;
  select count(*) into n from public.friend_messages where sender = ue or recipient = ue;
  r := r || pg_temp.check_that('deleting an account takes the messages it wrote and got', n = 0, n::text);

  -- Who may do what
  r := r || pg_temp.check_that('the table is server only', not has_table_privilege('anon', 'public.friend_messages', 'select') and not has_table_privilege('authenticated', 'public.friend_messages', 'insert')
    and has_table_privilege('service_role', 'public.friend_messages', 'select') and (select relrowsecurity from pg_class where oid = 'public.friend_messages'::regclass), null);
  r := r || pg_temp.check_that('no public role may call the functions', not has_function_privilege('anon', 'public.message_send(uuid, text, integer, text, integer, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.messages_with(uuid, text, integer, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.messages_read(uuid, text, integer)', 'execute')
    and not has_function_privilege('anon', 'public.conversations_for(uuid, integer)', 'execute')
    and has_function_privilege('service_role', 'public.message_send(uuid, text, integer, text, integer, integer)', 'execute')
    and has_function_privilege('service_role', 'public.messages_with(uuid, text, integer, integer)', 'execute')
    and has_function_privilege('service_role', 'public.messages_read(uuid, text, integer)', 'execute')
    and has_function_privilege('service_role', 'public.conversations_for(uuid, integer)', 'execute'), null);

  raise exception 'RESULT %', r;
end
$do$;
