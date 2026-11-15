-- The groups of the members, end to end (migration 0027): an invitation to a group that a friend accepts (the first one makes the group and its sender leads it), any member who invites, the cap, a member who asks to join the group of a friend (one request for each member,
-- the first answer is everybody's), leaving, the leader who removes a member and hands the lead over, the lead that goes to the member who has been in the longest when the leader leaves, the group that goes with its second-to-last member, the blocks (nothing is
-- stored and nothing is told, and the blocker leaves the group they share), a closed account, the cascade of a deleted account, the invitations that expire, the caps, the state of the panel (never a table's code), the nightly clean-up, what the invitations to a
-- table keep, and who may call what.
--
-- Run it on a throwaway Postgres whose `auth` schema is a stand-in (the migrations 0001 to 0025, then 0027, then this file). It makes fixture rows in `auth.users` that the rollback takes back. It is one `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`:
-- everything it writes is rolled back, and the message is the answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production. On `pbgo-preview` the same flows are tried between existing members, with the statements of
-- the migration put in a block of their own before the checks when it is not applied yet (there are not nine members there, so the caps are given smaller).
-- A function that writes and a query that reads what it wrote cannot share a statement (the query keeps the snapshot it started with): each answer is taken into a variable first. `joined_at` is `now()`, the same for everything in one transaction, so the checks
-- that depend on who joined first set it themselves.

DO $do$
declare
  ua uuid := '00000000-0000-4000-8000-0000000000a1';
  ub uuid := '00000000-0000-4000-8000-0000000000a2';
  uc uuid := '00000000-0000-4000-8000-0000000000a3';
  ud uuid := '00000000-0000-4000-8000-0000000000a4';
  ue uuid := '00000000-0000-4000-8000-0000000000a5';
  uf uuid := '00000000-0000-4000-8000-0000000000a6';
  ug uuid := '00000000-0000-4000-8000-0000000000a7';
  uh uuid := '00000000-0000-4000-8000-0000000000a8';
  ui uuid := '00000000-0000-4000-8000-0000000000a9';
  ttl interval := interval '30 minutes';
  r text := '';
  answer text;
  state jsonb;
  list jsonb;
  inv uuid;
  grp uuid;
  n integer;
begin
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;
  -- The nickname and the tag of a profile (`set_profile` takes a JSON object since 0018)
  create function pg_temp.sp(p_user uuid, p_nickname text, p_tag integer) returns text language sql as $f$
    select public.set_profile(p_user, jsonb_build_object('nickname', p_nickname, 'tag', p_tag))
  $f$;
  -- Whether a statement is refused with this state (23505 a pair that is taken, 23514 a check, 23503 a key)
  create function pg_temp.refused_with(p_sql text, p_state text) returns boolean language plpgsql as $f$
  begin
    execute p_sql;
    return false;
  exception when others then
    return sqlstate = p_state;
  end
  $f$;
  -- Friends: a pair, written once, the lower id first
  create function pg_temp.befriend(p_a uuid, p_b uuid) returns void language sql as $f$
    insert into public.friendships (user_a, user_b) values (least(p_a, p_b), greatest(p_a, p_b)) on conflict do nothing
  $f$;
  -- The id of the pending invitation of a kind from a sender to a recipient
  create function pg_temp.pending(p_sender uuid, p_recipient uuid, p_kind text) returns uuid language sql as $f$
    select i.id from public.table_invitations i where i.sender = p_sender and i.recipient = p_recipient and i.kind = p_kind and i.status = 'pending' limit 1
  $f$;
  -- The entry of a member in the members of a group's state, by nickname
  create function pg_temp.member(p_state jsonb, p_nickname text) returns jsonb language sql as $f$
    select e from jsonb_array_elements(p_state -> 'group' -> 'members') e where e ->> 'nickname' = p_nickname limit 1
  $f$;
  -- How many members a member's group has, and who leads it
  create function pg_temp.size(p_user uuid) returns integer language sql as $f$
    select count(*)::integer from public.friend_group_members m where m.group_id = public.group_of(p_user)
  $f$;
  create function pg_temp.leader(p_user uuid) returns uuid language sql as $f$
    select g.leader from public.friend_groups g where g.id = public.group_of(p_user)
  $f$;

  -- Fixtures: nine members who signed in. Ann invites her friends Bob, Cat and Dan; Bob is a friend of Eve; Cat of Fay; Gus, Hal and Ida are friends of each other; Dan and Gus are friends
  insert into auth.users (id, email, raw_user_meta_data) values
    (ua, 'ann@example.test', '{"full_name":"Ann"}'), (ub, 'bob@example.test', '{"full_name":"Bob"}'), (uc, 'cat@example.test', '{"full_name":"Cat"}'),
    (ud, 'dan@example.test', '{"full_name":"Dan"}'), (ue, 'eve@example.test', '{"full_name":"Eve"}'), (uf, 'fay@example.test', '{"full_name":"Fay"}'),
    (ug, 'gus@example.test', '{"full_name":"Gus"}'), (uh, 'hal@example.test', '{"full_name":"Hal"}'), (ui, 'ida@example.test', '{"full_name":"Ida"}');
  answer := pg_temp.sp(ua, 'Ann', 1) || pg_temp.sp(ub, 'Bob', 2) || pg_temp.sp(uc, 'Cat', 3) || pg_temp.sp(ud, 'Dan', 4) || pg_temp.sp(ue, 'Eve', 5)
    || pg_temp.sp(uf, 'Fay', 6) || pg_temp.sp(ug, 'Gus', 7) || pg_temp.sp(uh, 'Hal', 8) || pg_temp.sp(ui, 'Ida', 9);
  update auth.users set last_sign_in_at = now() where id in (ua, ub, uc, ud, ue, uf, ug, uh, ui);
  perform pg_temp.befriend(ua, ub); perform pg_temp.befriend(ua, uc); perform pg_temp.befriend(ua, ud); perform pg_temp.befriend(ub, ue); perform pg_temp.befriend(uc, uf);
  perform pg_temp.befriend(ug, uh); perform pg_temp.befriend(ug, ui); perform pg_temp.befriend(uh, ui); perform pg_temp.befriend(ud, ug);
  r := r || pg_temp.check_that('the fixtures are nine profiles', answer = 'okokokokokokokokok', answer);

  -- 0. The tables: one group for a member, and the shape of an invitation
  insert into public.friend_groups (id, leader) values ('00000000-0000-4000-8000-00000000c001', ua), ('00000000-0000-4000-8000-00000000c002', ub);
  insert into public.friend_group_members (group_id, user_id) values ('00000000-0000-4000-8000-00000000c001', ua);
  r := r || pg_temp.check_that('a member is in one group at most', pg_temp.refused_with(format('insert into public.friend_group_members (group_id, user_id) values (%L, %L)', '00000000-0000-4000-8000-00000000c002', ua), '23505'), null);
  r := r || pg_temp.check_that('a member needs an account', pg_temp.refused_with(format('insert into public.friend_group_members (group_id, user_id) values (%L, %L)', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-0000000000ff'), '23503'), null);
  r := r || pg_temp.check_that('an invitation to a group names no table', pg_temp.refused_with(format('insert into public.table_invitations (sender, recipient, kind, game, code, expires_at) values (%L, %L, ''group'', ''hanabi'', ''K7Q2'', now() + interval ''1 hour'')', ua, ub), '23514'), null);
  r := r || pg_temp.check_that('a request to join names its group', pg_temp.refused_with(format('insert into public.table_invitations (sender, recipient, kind, expires_at) values (%L, %L, ''join'', now() + interval ''1 hour'')', ua, ub), '23514'), null);
  r := r || pg_temp.check_that('an invitation to a table names its table', pg_temp.refused_with(format('insert into public.table_invitations (sender, recipient, kind, expires_at) values (%L, %L, ''table'', now() + interval ''1 hour'')', ua, ub), '23514'), null);
  r := r || pg_temp.check_that('a kind is one of the three', pg_temp.refused_with(format('insert into public.table_invitations (sender, recipient, kind, expires_at) values (%L, %L, ''party'', now() + interval ''1 hour'')', ua, ub), '23514'), null);
  delete from public.friend_groups;
  r := r || pg_temp.check_that('the fixture groups are gone with their members', not exists (select 1 from public.friend_group_members) and not exists (select 1 from public.friend_groups), null);

  -- 1. Inviting to a group: a friend, only. Nobody has a group yet: the first acceptance makes it
  r := r || pg_temp.check_that('a friend is invited', public.group_invite(ua, 'Bob', 2, ttl, 20, 20, 8) = 'sent', null);
  r := r || pg_temp.check_that('the handle is read as the profiles read it (the case does not matter)', public.group_invite(ua, 'dAN', 4, ttl, 20, 20, 8) = 'sent', null);
  answer := public.group_invite(ua, 'Bob', 2, ttl, 20, 20, 8);
  select count(*) into n from public.table_invitations where sender = ua and recipient = ub and kind = 'group';
  r := r || pg_temp.check_that('a second press for the same friend changes nothing', answer = 'sent' and n = 1, answer || n);
  r := r || pg_temp.check_that('nobody goes by an unknown handle', public.group_invite(ua, 'Nobody', 1, ttl, 20, 20, 8) = 'missing', null);
  r := r || pg_temp.check_that('nobody invites themselves', public.group_invite(ua, 'Ann', 1, ttl, 20, 20, 8) = 'self', null);
  r := r || pg_temp.check_that('a member who is not a friend is refused', public.group_invite(ua, 'Eve', 5, ttl, 20, 20, 8) = 'not_friends' and not exists (select 1 from public.table_invitations where recipient = ue), null);
  r := r || pg_temp.check_that('sending made no group: it is made when somebody accepts', not exists (select 1 from public.friend_groups), null);
  list := public.invitations_for(ub);
  r := r || pg_temp.check_that('Bob sees the invitation, of the kind group, from Ann, with no game', jsonb_array_length(list) = 1 and list -> 0 ->> 'kind' = 'group' and list -> 0 ->> 'nickname' = 'Ann' and list -> 0 -> 'game' = 'null'::jsonb, list::text);
  r := r || pg_temp.check_that('Cat sees nothing', jsonb_array_length(public.invitations_for(uc)) = 0, null);
  state := public.group_state(ua);
  r := r || pg_temp.check_that('Ann sees who she invited, and is in no group yet', state -> 'group' = 'null'::jsonb and jsonb_array_length(state -> 'invited') = 2 and state -> 'invited' -> 0 ->> 'nickname' in ('Bob', 'Dan'), state::text);

  -- 2. Answering: peek, the wrong door, the right one. The first acceptance makes the group, and its sender leads it
  inv := pg_temp.pending(ua, ub, 'group');
  r := r || pg_temp.check_that('peeking tells the kind and changes nothing', public.invitation_answer(ub, inv, 'peek') ->> 'kind' = 'group' and public.invitation_answer(ub, inv, 'peek') ->> 'result' = 'pending' and public.invitation_answer(ub, inv, 'peek') ->> 'code' is null, null);
  r := r || pg_temp.check_that('a group invitation is not accepted by the answer of the invitations to a table', public.invitation_answer(ub, inv, 'accept') ->> 'result' = 'missing' and (select status from public.table_invitations where id = inv) = 'pending', null);
  r := r || pg_temp.check_that('an invitation of another member does not exist for Cat', public.group_accept(uc, inv, 8) = 'missing' and public.invitation_answer(uc, inv, 'peek') ->> 'result' = 'missing' and (select status from public.table_invitations where id = inv) = 'pending', null);
  r := r || pg_temp.check_that('an invitation that does not exist is missing', public.group_accept(ub, gen_random_uuid(), 8) = 'missing', null);
  answer := public.group_accept(ub, inv, 8);
  grp := public.group_of(ub);
  r := r || pg_temp.check_that('accepting makes the group, and Ann, who invited, leads it', answer = 'created' and grp is not null and grp = public.group_of(ua) and pg_temp.leader(ub) = ua and pg_temp.size(ub) = 2, answer);
  r := r || pg_temp.check_that('the invitation is accepted, and it leaves Bob''s list', (select status from public.table_invitations where id = inv) = 'accepted' and jsonb_array_length(public.invitations_for(ub)) = 0, null);
  r := r || pg_temp.check_that('an answered invitation is not answered twice', public.group_accept(ub, inv, 8) = 'missing', null);
  state := public.group_state(ua);
  r := r || pg_temp.check_that('Ann sees the two members, herself first as the leader and as herself', jsonb_array_length(state -> 'group' -> 'members') = 2 and state -> 'group' -> 'members' -> 0 ->> 'nickname' = 'Ann'
    and (state -> 'group' -> 'members' -> 0 ->> 'leader')::boolean and (state -> 'group' -> 'members' -> 0 ->> 'you')::boolean and not (pg_temp.member(state, 'Bob') ->> 'leader')::boolean and not (pg_temp.member(state, 'Bob') ->> 'you')::boolean, state::text);
  state := public.group_state(ub);
  r := r || pg_temp.check_that('Bob sees the same group, himself as himself', (pg_temp.member(state, 'Bob') ->> 'you')::boolean and not (pg_temp.member(state, 'Ann') ->> 'you')::boolean and (pg_temp.member(state, 'Ann') ->> 'leader')::boolean, state::text);
  r := r || pg_temp.check_that('Ann''s invitation to Bob is not in the list of who she invited any more', jsonb_array_length(public.group_state(ua) -> 'invited') = 1, null);
  state := public.group_state(uc);
  r := r || pg_temp.check_that('Cat, who is in no group, sees that her friend Ann is in one, and not Bob, who is not her friend', state -> 'group' = 'null'::jsonb and jsonb_array_length(state -> 'grouped') = 1 and state -> 'grouped' -> 0 ->> 'nickname' = 'Ann', state::text);

  -- 3. Any member invites; the later invitations join the group that now exists (nobody validates)
  r := r || pg_temp.check_that('Dan, invited before the group was made, joins it', public.group_accept(ud, pg_temp.pending(ua, ud, 'group'), 8) = 'joined' and pg_temp.size(ua) = 3, null);
  r := r || pg_temp.check_that('Bob, who does not lead, invites his friend Eve', public.group_invite(ub, 'Eve', 5, ttl, 20, 20, 8) = 'sent', null);
  r := r || pg_temp.check_that('Eve joins; nobody validated', public.group_accept(ue, pg_temp.pending(ub, ue, 'group'), 8) = 'joined' and pg_temp.size(ua) = 4 and pg_temp.leader(ue) = ua, null);
  r := r || pg_temp.check_that('a member who is in the group is not invited to it', public.group_invite(ua, 'Bob', 2, ttl, 20, 20, 8) = 'already', null);
  r := r || pg_temp.check_that('a group at its cap cannot invite', public.group_invite(ua, 'Cat', 3, ttl, 20, 20, 4) = 'full' and not exists (select 1 from public.table_invitations where recipient = uc and kind = 'group'), null);
  r := r || pg_temp.check_that('Cat is invited when there is room', public.group_invite(ua, 'Cat', 3, ttl, 20, 20, 8) = 'sent', null);

  -- 4. Asking to join: not a group that does not exist, not for a friend who is in no group
  r := r || pg_temp.check_that('Fay cannot ask Cat to join a group Cat is not in', public.group_ask(uf, 'Cat', 3, ttl, 20, 20, 8) = 'no_group', null);
  r := r || pg_temp.check_that('Cat accepts', public.group_accept(uc, pg_temp.pending(ua, uc, 'group'), 8) = 'joined' and pg_temp.size(ua) = 5, null);
  r := r || pg_temp.check_that('Fay cannot ask a member who is not her friend', public.group_ask(uf, 'Dan', 4, ttl, 20, 20, 8) = 'not_friends', null);
  r := r || pg_temp.check_that('nobody asks themselves, and nobody goes by an unknown handle', public.group_ask(uf, 'Fay', 6, ttl, 20, 20, 8) = 'self' and public.group_ask(uf, 'Nobody', 1, ttl, 20, 20, 8) = 'missing', null);
  r := r || pg_temp.check_that('a member who is in a group cannot ask to join another', public.group_ask(ud, 'Gus', 7, ttl, 20, 20, 8) = 'in_group', null);
  r := r || pg_temp.check_that('a group at its cap cannot be asked', public.group_ask(uf, 'Cat', 3, ttl, 20, 20, 5) = 'full' and not exists (select 1 from public.table_invitations where sender = uf), null);
  answer := public.group_ask(uf, 'Cat', 3, ttl, 20, 20, 8);
  select count(*) into n from public.table_invitations where sender = uf and kind = 'join' and status = 'pending' and group_id = public.group_of(ua);
  r := r || pg_temp.check_that('Fay asks Cat, and the request goes to every member of the group', answer = 'sent' and n = 5, answer || n);
  answer := public.group_ask(uf, 'Cat', 3, ttl, 20, 20, 8);
  select count(*) into n from public.table_invitations where sender = uf and kind = 'join';
  r := r || pg_temp.check_that('a second press changes nothing', answer = 'sent' and n = 5, answer || n);
  list := public.invitations_for(ua);
  r := r || pg_temp.check_that('Ann, who is not Fay''s friend, sees the request, of the kind join, from Fay', jsonb_array_length(list) = 1 and list -> 0 ->> 'kind' = 'join' and list -> 0 ->> 'nickname' = 'Fay' and list -> 0 -> 'game' = 'null'::jsonb, list::text);
  r := r || pg_temp.check_that('Eve sees it too, and Gus, who is not in that group, does not', jsonb_array_length(public.invitations_for(ue)) = 1 and jsonb_array_length(public.invitations_for(ug)) = 0, null);
  state := public.group_state(uf);
  r := r || pg_temp.check_that('Fay sees that she asked Cat, and nobody else of the group (she is not their friend)', jsonb_array_length(state -> 'requested') = 1 and state -> 'requested' -> 0 ->> 'nickname' = 'Cat' and state -> 'group' = 'null'::jsonb, state::text);
  r := r || pg_temp.check_that('a request is not accepted by the answer of the invitations to a table', public.invitation_answer(ub, pg_temp.pending(uf, ub, 'join'), 'accept') ->> 'result' = 'missing', null);
  answer := public.group_accept(ub, pg_temp.pending(uf, ub, 'join'), 8);
  r := r || pg_temp.check_that('Bob, who does not lead, lets Fay in: any member answers', answer = 'joined' and pg_temp.size(uf) = 6 and public.group_of(uf) = public.group_of(ua) and pg_temp.leader(uf) = ua, answer);
  select count(*) into n from public.table_invitations where sender = uf and status = 'pending';
  r := r || pg_temp.check_that('the first answer is everybody''s: the others have no request to answer', n = 0 and jsonb_array_length(public.invitations_for(ua)) = 0 and jsonb_array_length(public.invitations_for(uc)) = 0, n::text);
  r := r || pg_temp.check_that('the request that was accepted is accepted, and the others are ended', (select count(*) from public.table_invitations where sender = uf and kind = 'join' and status = 'accepted') = 1, null);

  -- 5. A request that is declined is declined for all
  perform public.group_invite(ug, 'Hal', 8, ttl, 20, 20, 8);
  answer := public.group_accept(uh, pg_temp.pending(ug, uh, 'group'), 8);
  r := r || pg_temp.check_that('Gus and Hal make another group; Gus leads', answer = 'created' and pg_temp.leader(uh) = ug and pg_temp.size(ug) = 2, answer);
  answer := public.group_ask(ui, 'Gus', 7, ttl, 20, 20, 8);
  r := r || pg_temp.check_that('Ida asks to join it, from Gus, and both members get the request', answer = 'sent' and jsonb_array_length(public.invitations_for(ug)) = 1 and jsonb_array_length(public.invitations_for(uh)) = 1, answer);
  answer := public.invitation_answer(uh, pg_temp.pending(ui, uh, 'join'), 'decline') ->> 'result';
  r := r || pg_temp.check_that('Hal declines, and it is declined for Gus too', answer = 'declined' and jsonb_array_length(public.invitations_for(ug)) = 0 and not exists (select 1 from public.table_invitations where sender = ui and status = 'pending'), answer);
  r := r || pg_temp.check_that('a member who is in a group is not invited to another one (Dan, in the first, is Gus''s friend)', public.group_invite(ug, 'Dan', 4, ttl, 20, 20, 8) = 'busy', null);
  r := r || pg_temp.check_that('and cannot ask to join it either', public.group_ask(ud, 'Gus', 7, ttl, 20, 20, 8) = 'in_group', null);

  -- 6. A member who is invited and asks at the same time is let in by the invitation, and the request goes
  perform public.group_invite(ug, 'Ida', 9, ttl, 20, 20, 8);
  perform public.group_ask(ui, 'Hal', 8, ttl, 20, 20, 8);
  r := r || pg_temp.check_that('Ida asks Hal to join, though Gus invited her too: she has an invitation and a request', pg_temp.pending(ug, ui, 'group') is not null and pg_temp.pending(ui, uh, 'join') is not null, null);
  answer := public.group_accept(ui, pg_temp.pending(ug, ui, 'group'), 8);
  r := r || pg_temp.check_that('Ida accepts Gus''s invitation: she joins, and her own request is ended with it', answer = 'joined' and pg_temp.size(ug) = 3 and not exists (select 1 from public.table_invitations where sender = ui and kind = 'join' and status = 'pending'), answer);

  -- 7. Leaving: a member goes
  update public.friend_group_members set joined_at = now() - interval '6 hours' where user_id = ua;
  update public.friend_group_members set joined_at = now() - interval '5 hours' where user_id = ub;
  update public.friend_group_members set joined_at = now() - interval '4 hours' where user_id = ud;
  update public.friend_group_members set joined_at = now() - interval '3 hours' where user_id = ue;
  update public.friend_group_members set joined_at = now() - interval '2 hours' where user_id = uc;
  update public.friend_group_members set joined_at = now() - interval '1 hour' where user_id = uf;
  answer := public.group_leave(ue);
  r := r || pg_temp.check_that('Eve leaves', answer = 'left' and public.group_of(ue) is null and pg_temp.size(ua) = 5, answer);
  r := r || pg_temp.check_that('a member who is in no group leaves nothing', public.group_leave(ue) = 'missing', null);
  r := r || pg_temp.check_that('Eve sees no group', public.group_state(ue) -> 'group' = 'null'::jsonb, null);

  -- 8. Removing, and handing the lead over
  r := r || pg_temp.check_that('a member who does not lead cannot remove', public.group_kick(ub, 'Dan', 4) = 'not_leader' and public.group_of(ud) is not null, null);
  r := r || pg_temp.check_that('a member who is in no group cannot remove', public.group_kick(ue, 'Dan', 4) = 'not_in_group', null);
  r := r || pg_temp.check_that('the leader cannot remove somebody who is not in the group', public.group_kick(ua, 'Eve', 5) = 'missing' and public.group_kick(ua, 'Nobody', 1) = 'missing', null);
  r := r || pg_temp.check_that('the leader cannot remove themselves', public.group_kick(ua, 'Ann', 1) = 'missing' and public.group_of(ua) is not null, null);
  answer := public.group_kick(ua, 'Dan', 4);
  r := r || pg_temp.check_that('the leader removes Dan', answer = 'kicked' and public.group_of(ud) is null and pg_temp.size(ua) = 4, answer);
  r := r || pg_temp.check_that('a member who does not lead cannot hand the lead over', public.group_lead(ub, 'Cat', 3) = 'not_leader', null);
  r := r || pg_temp.check_that('the lead is not handed to somebody who is not in the group, nor to oneself', public.group_lead(ua, 'Dan', 4) = 'missing' and public.group_lead(ua, 'Ann', 1) = 'missing' and pg_temp.leader(ua) = ua, null);
  r := r || pg_temp.check_that('Ann hands the lead to Cat', public.group_lead(ua, 'Cat', 3) = 'led' and pg_temp.leader(ua) = uc, null);
  r := r || pg_temp.check_that('Ann does not lead any more', public.group_kick(ua, 'Bob', 2) = 'not_leader' and public.group_lead(ua, 'Bob', 2) = 'not_leader', null);
  state := public.group_state(ub);
  r := r || pg_temp.check_that('the group shows Cat as the leader, first, and one leader only', state -> 'group' -> 'members' -> 0 ->> 'nickname' = 'Cat' and (state -> 'group' -> 'members' -> 0 ->> 'leader')::boolean
    and (select count(*) from jsonb_array_elements(state -> 'group' -> 'members') e where (e ->> 'leader')::boolean) = 1, state::text);
  answer := public.group_kick(uc, 'Fay', 6);
  r := r || pg_temp.check_that('the new leader removes a member: Fay', answer = 'kicked' and public.group_of(uf) is null and pg_temp.size(ua) = 3, answer);
  -- The leader leaves without handing the lead over: the member who has been in the longest leads (Ann, 6 hours, then Bob)
  r := r || pg_temp.check_that('the leader leaves, and the member who has been in the longest leads', public.group_leave(uc) = 'left' and pg_temp.leader(ua) = ua and pg_temp.size(ua) = 2, null);
  select count(*) into n from public.friend_groups g where not exists (select 1 from public.friend_group_members m where m.group_id = g.id and m.user_id = g.leader);
  r := r || pg_temp.check_that('no group has a leader who is not in it', n = 0, n::text);
  r := r || pg_temp.check_that('Cat, who left, is in no group and cannot be asked to join one', public.group_ask(uf, 'Cat', 3, ttl, 20, 20, 8) = 'no_group', null);
  -- A group that goes takes the requests to join it with it: Cat comes back, Fay asks for the three of them, then they leave
  perform public.group_invite(ua, 'Cat', 3, ttl, 20, 20, 8);
  perform public.group_accept(uc, pg_temp.pending(ua, uc, 'group'), 8);
  perform public.group_ask(uf, 'Cat', 3, ttl, 20, 20, 8);
  select count(*) into n from public.table_invitations where sender = uf and kind = 'join' and status = 'pending';
  r := r || pg_temp.check_that('Fay''s request waits, for the three of them', n = 3, n::text);
  perform public.group_leave(ub);
  perform public.group_leave(uc);
  select count(*) into n from public.table_invitations where kind = 'join' and sender = uf;
  r := r || pg_temp.check_that('a group left with one member goes, and the requests to join it with it', public.group_of(ua) is null and public.group_of(ub) is null and public.group_of(uc) is null and public.group_of(ug) is not null and n = 0, n::text);
  perform public.group_leave(ui);

  -- 9. Blocks: the blocker leaves a group they share with the blocked member; nothing is stored for a request that goes to a member who blocked the sender, and the sender is told it went
  delete from public.friend_groups;
  delete from public.table_invitations;
  perform public.group_invite(ua, 'Bob', 2, ttl, 20, 20, 8);
  perform public.group_accept(ub, pg_temp.pending(ua, ub, 'group'), 8);
  perform public.group_invite(ua, 'Cat', 3, ttl, 20, 20, 8);
  perform public.group_accept(uc, pg_temp.pending(ua, uc, 'group'), 8);
  r := r || pg_temp.check_that('the group of Ann, Bob and Cat', pg_temp.size(ua) = 3, pg_temp.size(ua)::text);
  answer := public.friend_block(ub, 'Ann', 1, 500);
  r := r || pg_temp.check_that('Bob blocks Ann: the friendship ends and Bob leaves the group they shared', answer = 'blocked_friend' and public.group_of(ub) is null and pg_temp.size(ua) = 2, answer);
  r := r || pg_temp.check_that('a block is not told: Ann''s group shows two members and nothing about Bob', pg_temp.member(public.group_state(ua), 'Bob') is null and jsonb_array_length(public.group_state(ua) -> 'group' -> 'members') = 2, null);
  r := r || pg_temp.check_that('a member who blocked the sender gets nothing, and the sender is told what a removed friend is told', public.group_invite(ub, 'Ann', 1, ttl, 20, 20, 8) = 'not_friends', null);
  answer := public.friend_block(ua, 'Cat', 3, 500);
  r := r || pg_temp.check_that('Ann blocks Cat: she leaves, and a group of one is no group', answer = 'blocked_friend' and public.group_of(ua) is null and public.group_of(uc) is null and not exists (select 1 from public.friend_groups), answer);
  perform public.friend_unblock(ua, 'Cat', 3);
  perform public.friend_unblock(ub, 'Ann', 1);
  perform pg_temp.befriend(ua, uc);
  perform pg_temp.befriend(ua, ub);
  perform public.group_invite(ua, 'Bob', 2, ttl, 20, 20, 8);
  perform public.group_accept(ub, pg_temp.pending(ua, ub, 'group'), 8);
  perform public.group_invite(ub, 'Eve', 5, ttl, 20, 20, 8);
  perform public.group_accept(ue, pg_temp.pending(ub, ue, 'group'), 8);
  perform pg_temp.befriend(ub, ui);
  r := r || pg_temp.check_that('Ann, Bob and Eve are a group, and Ida, who is Bob''s friend, is in none', pg_temp.size(ua) = 3 and public.group_of(ui) is null, null);
  insert into public.friend_blocks (blocker, blocked) values (ue, ui);
  r := r || pg_temp.check_that('a member who blocks somebody they share no group with stays in their own', public.group_of(ue) is not null, null);
  answer := public.group_ask(ui, 'Bob', 2, ttl, 20, 20, 8);
  select count(*) into n from public.table_invitations where sender = ui;
  r := r || pg_temp.check_that('Ida asks Bob''s group, where Eve blocked her: the answer is sent and nothing is stored', answer = 'sent' and n = 0, answer || n);
  delete from public.friend_blocks where blocker = ue and blocked = ui;
  insert into public.friend_blocks (blocker, blocked) values (ui, ue);
  answer := public.group_ask(ui, 'Bob', 2, ttl, 20, 20, 8);
  r := r || pg_temp.check_that('Ida, who blocked Eve, cannot ask a group that Eve is in', answer = 'unavailable' and not exists (select 1 from public.table_invitations where sender = ui), answer);
  delete from public.friend_blocks where blocker = ui and blocked = ue;
  -- A request that was sent before a member blocked the sender is not let through
  answer := public.group_ask(ui, 'Bob', 2, ttl, 20, 20, 8);
  insert into public.friend_blocks (blocker, blocked) values (ue, ui);
  r := r || pg_temp.check_that('a request is not accepted once a member of the group blocked the one who asks', answer = 'sent' and public.group_accept(ua, pg_temp.pending(ui, ua, 'join'), 8) = 'unavailable' and public.group_of(ui) is null, answer);
  delete from public.friend_blocks where blocker = ue and blocked = ui;
  -- A block beside a friendship (it should not stand): nothing is stored and the answer is sent
  insert into public.friend_blocks (blocker, blocked) values (uc, ua);
  perform pg_temp.befriend(ua, uc);
  r := r || pg_temp.check_that('with a block beside a friendship the answer is sent and nothing is stored', public.group_invite(ua, 'Cat', 3, ttl, 20, 20, 8) = 'sent' and not exists (select 1 from public.table_invitations where recipient = uc), null);
  delete from public.friend_blocks where blocker = uc and blocked = ua;

  -- 10. A closed account (PLT-36) leaves its group and is in nobody's list
  delete from public.friend_groups;
  delete from public.table_invitations;
  perform public.group_invite(ua, 'Bob', 2, ttl, 20, 20, 8);
  perform public.group_accept(ub, pg_temp.pending(ua, ub, 'group'), 8);
  perform public.group_invite(ub, 'Eve', 5, ttl, 20, 20, 8);
  perform public.group_accept(ue, pg_temp.pending(ub, ue, 'group'), 8);
  perform public.group_invite(ua, 'Cat', 3, ttl, 20, 20, 8);
  r := r || pg_temp.check_that('Cat has an invitation from Ann', jsonb_array_length(public.invitations_for(uc)) = 1, null);
  insert into public.account_deletions (user_id, token_hash, scheduled_for) values (ua, repeat('a', 64), now() + interval '7 days');
  r := r || pg_temp.check_that('Ann closes her account: she is out of her group, and the lead goes on (Bob, then Eve: the same day, so by their id)', public.group_of(ua) is null and pg_temp.size(ub) = 2 and pg_temp.leader(ub) = ub, null);
  r := r || pg_temp.check_that('her invitation is not in Cat''s list while the account is closed', jsonb_array_length(public.invitations_for(uc)) = 0, null);
  r := r || pg_temp.check_that('Cat cannot accept an invitation of a closed account', public.group_accept(uc, pg_temp.pending(ua, uc, 'group'), 8) = 'missing', null);
  delete from public.account_deletions where user_id = ua;

  -- 11. The cascade: a deleted account takes its membership, and the lead goes on; a group of one goes
  delete from public.friend_groups;
  delete from public.table_invitations;
  perform public.group_invite(ud, 'Ann', 1, ttl, 20, 20, 8);
  perform public.group_accept(ua, pg_temp.pending(ud, ua, 'group'), 8);
  perform public.group_invite(ua, 'Cat', 3, ttl, 20, 20, 8);
  perform public.group_accept(uc, pg_temp.pending(ua, uc, 'group'), 8);
  update public.friend_group_members set joined_at = now() - interval '3 hours' where user_id = ud;
  update public.friend_group_members set joined_at = now() - interval '2 hours' where user_id = ua;
  update public.friend_group_members set joined_at = now() - interval '1 hour' where user_id = uc;
  r := r || pg_temp.check_that('Dan leads a group of Dan, Ann and Cat', pg_temp.size(ud) = 3 and pg_temp.leader(ua) = ud, null);
  delete from auth.users where id = ud;
  r := r || pg_temp.check_that('Dan''s account is deleted: the group stays, with Ann at its head, who has been in it longest', pg_temp.size(ua) = 2 and pg_temp.leader(ua) = ua, null);
  delete from auth.users where id = ua;
  r := r || pg_temp.check_that('Ann''s is deleted too: a group of one is no group', not exists (select 1 from public.friend_groups) and not exists (select 1 from public.friend_group_members), null);

  -- 12. Expiry (Ann and Dan are gone: Bob invites Cat)
  delete from public.table_invitations;
  perform pg_temp.befriend(ub, uc);
  perform public.group_invite(ub, 'Cat', 3, ttl, 20, 20, 8);
  inv := pg_temp.pending(ub, uc, 'group');
  update public.table_invitations set expires_at = now() - interval '1 minute' where id = inv;
  r := r || pg_temp.check_that('an invitation past its time is not listed', jsonb_array_length(public.invitations_for(uc)) = 0 and jsonb_array_length(public.group_state(ub) -> 'invited') = 0, null);
  answer := public.group_accept(uc, inv, 8);
  r := r || pg_temp.check_that('it cannot be accepted: it is expired and marked so', answer = 'expired' and (select status from public.table_invitations where id = inv) = 'expired' and public.group_of(uc) is null, answer);
  answer := public.group_invite(ub, 'Cat', 3, ttl, 20, 20, 8);
  r := r || pg_temp.check_that('an expired invitation can be sent again', answer = 'sent' and jsonb_array_length(public.invitations_for(uc)) = 1, answer);
  update public.table_invitations set expires_at = now() - interval '1 minute' where sender = ub and recipient = uc and status = 'pending';
  answer := public.group_invite(ub, 'Cat', 3, ttl, 20, 20, 8);
  r := r || pg_temp.check_that('a stale pending one is marked expired when the friend is invited again', answer = 'sent' and (select count(*) from public.table_invitations where sender = ub and recipient = uc and kind = 'group' and status = 'pending') = 1, answer);
  update public.table_invitations set created_at = now() - interval '2 days', expires_at = now() - interval '2 days' where sender = ub and recipient = uc and status <> 'pending';
  answer := public.group_invite(ub, 'Cat', 3, ttl, 20, 20, 8);
  r := r || pg_temp.check_that('what is two days old goes when the pair is invited again', not exists (select 1 from public.table_invitations where sender = ub and recipient = uc and created_at < now() - interval '1 day'), answer);
  delete from public.table_invitations;

  -- 13. The caps
  perform pg_temp.befriend(ub, ug);
  answer := public.group_invite(ub, 'Cat', 3, ttl, 1, 20, 8) || ' ' || public.group_invite(ub, 'Gus', 7, ttl, 1, 20, 8);
  r := r || pg_temp.check_that('a sender at their cap is refused', answer = 'sent too_many_sent', answer);
  delete from public.table_invitations;
  delete from public.friend_groups;
  answer := public.group_invite(uh, 'Gus', 7, ttl, 20, 1, 8) || ' ' || public.group_invite(ui, 'Gus', 7, ttl, 20, 1, 8);
  r := r || pg_temp.check_that('a friend at their cap cannot be invited more', answer = 'sent unavailable', answer);
  delete from public.table_invitations;

  -- 14. The invitations to a table keep working beside them (they are the same rows, of the kind table)
  perform public.group_invite(ub, 'Cat', 3, ttl, 20, 20, 8);
  answer := public.invitation_answer(uc, pg_temp.pending(ub, uc, 'group'), 'decline') ->> 'result';
  r := r || pg_temp.check_that('declining an invitation to a group is the same press', answer = 'declined' and jsonb_array_length(public.invitations_for(uc)) = 0, answer);
  r := r || pg_temp.check_that('an invitation to a table is sent as it was', public.invitation_send(ub, 'Cat', 3, 'hanabi', 'K7Q2', ttl, 20, 20) = 'sent', null);
  list := public.invitations_for(uc);
  r := r || pg_temp.check_that('it is listed with its kind and its game, and never its code', jsonb_array_length(list) = 1 and list -> 0 ->> 'kind' = 'table' and list -> 0 ->> 'game' = 'hanabi' and position('K7Q2' in list::text) = 0, list::text);
  inv := (list -> 0 ->> 'id')::uuid;
  r := r || pg_temp.check_that('peeking tells the table of a table invitation, and its kind', public.invitation_answer(uc, inv, 'peek') ->> 'kind' = 'table' and public.invitation_answer(uc, inv, 'peek') ->> 'code' = 'K7Q2', null);
  r := r || pg_temp.check_that('a table invitation is not a group invitation: group_accept takes none of them', public.group_accept(uc, inv, 8) = 'missing', null);
  state := public.invitation_answer(uc, inv, 'accept');
  r := r || pg_temp.check_that('accepting it says the table and marks it', state ->> 'result' = 'accepted' and (select status from public.table_invitations where id = inv) = 'accepted', state::text);
  delete from public.table_invitations;

  -- 15. The idle groups go with the nightly clean-up: Bob and Cat, and Gus and Hal, three days old; Bob was seen
  perform public.group_invite(ub, 'Cat', 3, ttl, 20, 20, 8);
  perform public.group_accept(uc, pg_temp.pending(ub, uc, 'group'), 8);
  perform public.group_invite(ug, 'Hal', 8, ttl, 20, 20, 8);
  perform public.group_accept(uh, pg_temp.pending(ug, uh, 'group'), 8);
  update public.friend_groups set created_at = now() - interval '3 days';
  perform public.touch_member(ub);
  n := public.groups_purge(interval '1 day', true);
  r := r || pg_temp.check_that('a dry run counts the idle groups and deletes none', n = 1 and public.group_of(ub) is not null and public.group_of(ug) is not null, n::text);
  n := public.groups_purge(interval '1 day');
  r := r || pg_temp.check_that('a group is kept while somebody in it was seen, and goes when nobody was', n = 1 and public.group_of(ub) is not null and public.group_of(ug) is null, n::text);
  update public.friend_groups set created_at = now() - interval '3 hours';
  r := r || pg_temp.check_that('a young group stays whatever happened', public.groups_purge(interval '1 day') = 0 and public.group_of(ub) is not null, null);

  -- 16. For the server: who is in a group, with the accounts' ids; and the state of the groups never has a table's code
  state := public.group_members_of(ub);
  r := r || pg_temp.check_that('the server reads the group of a member with its accounts', state ->> 'leader' = ub::text and jsonb_array_length(state -> 'members') = 2 and state -> 'members' ->> 0 = ub::text and public.group_members_of(ug) is null, state::text);
  state := public.group_state(ub);
  r := r || pg_temp.check_that('the state of the groups has no code', position('code' in state::text) = 0, state::text);

  -- 17. Who may do what
  r := r || pg_temp.check_that('the tables are server only', not has_table_privilege('anon', 'public.friend_groups', 'select') and not has_table_privilege('authenticated', 'public.friend_group_members', 'insert')
    and has_table_privilege('service_role', 'public.friend_groups', 'select') and has_table_privilege('service_role', 'public.friend_group_members', 'delete')
    and (select relrowsecurity from pg_class where oid = 'public.friend_groups'::regclass) and (select relrowsecurity from pg_class where oid = 'public.friend_group_members'::regclass), null);
  r := r || pg_temp.check_that('no public role may call the functions', not has_function_privilege('anon', 'public.group_invite(uuid, text, integer, interval, integer, integer, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.group_ask(uuid, text, integer, interval, integer, integer, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.group_accept(uuid, uuid, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.group_leave(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.group_kick(uuid, text, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.group_lead(uuid, text, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.group_state(uuid, interval)', 'execute')
    and not has_function_privilege('authenticated', 'public.group_members_of(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.groups_purge(interval, boolean)', 'execute')
    and not has_function_privilege('authenticated', 'public.invitation_answer(uuid, uuid, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.invitations_for(uuid)', 'execute')
    and has_function_privilege('service_role', 'public.group_invite(uuid, text, integer, interval, integer, integer, integer)', 'execute')
    and has_function_privilege('service_role', 'public.group_accept(uuid, uuid, integer)', 'execute')
    and has_function_privilege('service_role', 'public.group_state(uuid, interval)', 'execute')
    and has_function_privilege('service_role', 'public.invitation_answer(uuid, uuid, text)', 'execute'), null);

  raise exception 'RESULT %', r;
end
$do$;
