-- Friends (PLT-23): the friendships between members, the friend requests that wait for an answer, and the members that a member blocked. Until now the friends' panel, the add-friend field and the pages of `/me/friends` were finished screens with no
-- database behind them.
--
-- Three tables, all server only (service role), like `profiles` and `games`: row level security is on without policy and the public roles have no grant, so the browser never reads them. The server reads and writes them through the functions below,
-- each of which decides in one transaction, so that the tests can run them end to end. A member is named to the functions by their handle (nickname and tag, `Alex#0042`), as the pages name them: an account's id stays on the server.
--
-- `friendships`: one row for two members who are friends, written once with the lower id first (`user_a < user_b`), so that there is never a half friendship and never two rows for one pair.
-- `friend_requests`: a request that waits (`sender` to `recipient`). There is at most one between two members, in either direction (a request to somebody who already sent you one accepts theirs). A request that is answered is not kept: accepting
--   makes the friendship, declining and cancelling leave nothing, so the only requests in the table are those that wait, and the nightly clean-up deletes the ones older than `FRIEND_REQUEST_RETENTION_DAYS` (`core/lib/retention.ts`, `core/server/retention.ts`).
-- `friend_blocks`: `blocker` does not want `blocked` near them. Blocking ends the friendship and takes the pending requests away in both directions; a blocked member cannot send a request, and is not told: their request seems to go, and nothing is stored.
--
-- Every key points at `auth.users` with `on delete cascade`: deleting an account takes its friendships, its requests and its blocks, the ones it made and the ones it got (`erase_account` of migration 0011 deletes the account, so it needs nothing new).
-- A closed account (`account_deletions`, PLT-36: the member asked to delete it and has a week to change their mind) is in nobody's list, and cannot be found to be added, until it is reopened; the rows stay meanwhile.
--
-- The limits are not here: the server gives them to each function (`core/lib/friends.ts` is the one place they are written), and the function counts and writes under a lock on the members it is about, so that two requests made at the same moment
-- cannot both pass a limit.

create table if not exists public.friendships (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint friendships_order_check check (user_a < user_b)
);

-- The primary key finds the friends of the member whose id is `user_a`; this one finds those of the member whose id is `user_b`
create index if not exists friendships_user_b_idx on public.friendships (user_b);

create table if not exists public.friend_requests (
  sender uuid not null references auth.users (id) on delete cascade,
  recipient uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sender, recipient),
  constraint friend_requests_self_check check (sender <> recipient)
);

-- At most one request between two members, whichever way it goes
create unique index if not exists friend_requests_pair_idx on public.friend_requests (least(sender, recipient), greatest(sender, recipient));
-- The requests a member got (the primary key finds those they sent), and the nightly clean-up, which goes by the day
create index if not exists friend_requests_recipient_idx on public.friend_requests (recipient);
create index if not exists friend_requests_created_idx on public.friend_requests (created_at);

create table if not exists public.friend_blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  constraint friend_blocks_self_check check (blocker <> blocked)
);

create index if not exists friend_blocks_blocked_idx on public.friend_blocks (blocked);

alter table public.friendships enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friend_blocks enable row level security;

revoke all on table public.friendships from anon, authenticated;
revoke all on table public.friend_requests from anon, authenticated;
revoke all on table public.friend_blocks from anon, authenticated;
grant select, insert, update, delete on table public.friendships to service_role;
grant select, insert, update, delete on table public.friend_requests to service_role;
grant select, insert, update, delete on table public.friend_blocks to service_role;

-- Holds the two members still while a function changes what is between them (and their counts), until its transaction ends. The keys are taken in the order of their hashes, so that two functions that lock the same two members cannot wait for
-- each other. A hash that two members share only makes them wait for one another a moment.
create or replace function public.friend_lock(p_a uuid, p_b uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_x integer := hashtext(p_a::text);
  v_y integer := hashtext(p_b::text);
begin
  perform pg_advisory_xact_lock(7016, least(v_x, v_y));
  if v_x <> v_y then
    perform pg_advisory_xact_lock(7016, greatest(v_x, v_y));
  end if;
end;
$$;

-- The member that goes by this handle (the case of the nickname does not matter), as the page of a profile finds them: nobody for a closed account, or one that never signed in. Null when there is nobody.
create or replace function public.friend_target(p_nickname text, p_tag integer)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select h.user_id from public.profile_by_handle(p_nickname, p_tag) h limit 1
$$;

-- How many friends a member has, how many requests wait for them and how many they sent
create or replace function public.friend_count(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.friendships f where f.user_a = p_user or f.user_b = p_user
$$;

-- Sends a request to the member who goes by this handle, and answers what became of it:
--   'sent'           the request waits for them (or it did already: nothing changes), or the member is one who blocked the sender, who is not told: nothing is stored and the answer is the same;
--   'accepted'       the member had sent a request to the sender: it is accepted, and they are friends;
--   'friends'        they are friends already: nothing changes;
--   'missing'        nobody goes by this handle (a closed account is nobody);
--   'self'           the handle is the sender's own;
--   'blocked_by_you' the sender blocked the member: they unblock them first (the sender knows their own blocks, so this tells them nothing);
--   'full'           the sender has `p_max_friends` friends (it counts for accepting too);
--   'too_many_sent'  the sender already has `p_max_sent` requests that wait;
--   'unavailable'    the member has `p_max_received` requests waiting or `p_max_friends` friends, so cannot be asked.
--   'no_profile'     the sender's own account has no profile (the server makes it first, so this is the rare case): without one they could not be named to the others.
create or replace function public.friend_request_send(p_user uuid, p_nickname text, p_tag integer, p_max_friends integer, p_max_received integer, p_max_sent integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := public.friend_target(p_nickname, p_tag);
  v_a uuid;
  v_b uuid;
begin
  if v_target is null then
    return 'missing';
  end if;
  if v_target = p_user then
    return 'self';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = p_user) then
    return 'no_profile';
  end if;

  perform public.friend_lock(p_user, v_target);
  v_a := least(p_user, v_target);
  v_b := greatest(p_user, v_target);

  if exists (select 1 from public.friendships f where f.user_a = v_a and f.user_b = v_b) then
    return 'friends';
  end if;
  if exists (select 1 from public.friend_blocks b where b.blocker = p_user and b.blocked = v_target) then
    return 'blocked_by_you';
  end if;
  if exists (select 1 from public.friend_blocks b where b.blocker = v_target and b.blocked = p_user) then
    -- Nothing is stored, and the sender is not told: the request seems to go
    return 'sent';
  end if;
  if exists (select 1 from public.friend_requests r where r.sender = p_user and r.recipient = v_target) then
    return 'sent';
  end if;

  if exists (select 1 from public.friend_requests r where r.sender = v_target and r.recipient = p_user) then
    -- They asked first: this is the answer
    if public.friend_count(p_user) >= p_max_friends then
      return 'full';
    end if;
    if public.friend_count(v_target) >= p_max_friends then
      return 'unavailable';
    end if;
    delete from public.friend_requests r where r.sender = v_target and r.recipient = p_user;
    insert into public.friendships (user_a, user_b) values (v_a, v_b) on conflict do nothing;
    return 'accepted';
  end if;

  if public.friend_count(p_user) >= p_max_friends then
    return 'full';
  end if;
  if (select count(*) from public.friend_requests r where r.sender = p_user) >= p_max_sent then
    return 'too_many_sent';
  end if;
  if (select count(*) from public.friend_requests r where r.recipient = v_target) >= p_max_received or public.friend_count(v_target) >= p_max_friends then
    return 'unavailable';
  end if;
  insert into public.friend_requests (sender, recipient) values (p_user, v_target);
  return 'sent';
end;
$$;

-- Answers a request: `p_answer` is 'accept' or 'decline' for a request that the member who goes by this handle sent to `p_user`, and 'cancel' for one that `p_user` sent to them. Answers what happened:
--   'accepted' | 'declined' | 'cancelled'   done; accepting makes the friendship and takes the request away, the other two only take it away;
--   'missing'        there is no such request (it was answered or cancelled in the meantime, or the member is gone);
--   'full'           accepting, and `p_user` has `p_max_friends` friends;
--   'unavailable'    accepting, and the member who sent it has `p_max_friends` friends;
--   'no_profile'     accepting, and `p_user` has no profile (the server makes it first, so this is the rare case).
create or replace function public.friend_request_answer(p_user uuid, p_nickname text, p_tag integer, p_answer text, p_max_friends integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other uuid := public.friend_target(p_nickname, p_tag);
begin
  if v_other is null or v_other = p_user or p_answer not in ('accept', 'decline', 'cancel') then
    return 'missing';
  end if;
  perform public.friend_lock(p_user, v_other);

  if p_answer = 'cancel' then
    delete from public.friend_requests r where r.sender = p_user and r.recipient = v_other;
    return case when found then 'cancelled' else 'missing' end;
  end if;

  if not exists (select 1 from public.friend_requests r where r.sender = v_other and r.recipient = p_user) then
    return 'missing';
  end if;
  if p_answer = 'decline' then
    delete from public.friend_requests r where r.sender = v_other and r.recipient = p_user;
    return 'declined';
  end if;

  if not exists (select 1 from public.profiles p where p.user_id = p_user) then
    return 'no_profile';
  end if;
  if public.friend_count(p_user) >= p_max_friends then
    return 'full';
  end if;
  if public.friend_count(v_other) >= p_max_friends then
    return 'unavailable';
  end if;
  delete from public.friend_requests r where r.sender = v_other and r.recipient = p_user;
  insert into public.friendships (user_a, user_b) values (least(p_user, v_other), greatest(p_user, v_other)) on conflict do nothing;
  return 'accepted';
end;
$$;

-- Ends the friendship with the member who goes by this handle. Answers 'removed' or 'missing' (nobody goes by it, or they are not friends).
create or replace function public.friend_remove(p_user uuid, p_nickname text, p_tag integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other uuid := public.friend_target(p_nickname, p_tag);
begin
  if v_other is null or v_other = p_user then
    return 'missing';
  end if;
  perform public.friend_lock(p_user, v_other);
  delete from public.friendships f where f.user_a = least(p_user, v_other) and f.user_b = greatest(p_user, v_other);
  return case when found then 'removed' else 'missing' end;
end;
$$;

-- Blocks the member who goes by this handle: the friendship ends and the requests that wait between them, in both directions, are taken away. Answers 'blocked', 'blocked_friend' (the same, and they were friends), 'missing' (nobody goes by
-- it), 'self' (the handle is the member's own) or 'full' (they blocked `p_max_blocks` members already). Blocking somebody who is blocked is 'blocked' and changes nothing.
create or replace function public.friend_block(p_user uuid, p_nickname text, p_tag integer, p_max_blocks integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other uuid := public.friend_target(p_nickname, p_tag);
  v_friends boolean;
begin
  if v_other is null then
    return 'missing';
  end if;
  if v_other = p_user then
    return 'self';
  end if;
  perform public.friend_lock(p_user, v_other);

  if exists (select 1 from public.friend_blocks b where b.blocker = p_user and b.blocked = v_other) then
    return 'blocked';
  end if;
  if (select count(*) from public.friend_blocks b where b.blocker = p_user) >= p_max_blocks then
    return 'full';
  end if;
  insert into public.friend_blocks (blocker, blocked) values (p_user, v_other);
  delete from public.friendships f where f.user_a = least(p_user, v_other) and f.user_b = greatest(p_user, v_other);
  v_friends := found;
  delete from public.friend_requests r where (r.sender = p_user and r.recipient = v_other) or (r.sender = v_other and r.recipient = p_user);
  return case when v_friends then 'blocked_friend' else 'blocked' end;
end;
$$;

-- Lifts the block on the member who goes by this handle. Answers 'unblocked' or 'missing' (nobody goes by it, or they were not blocked). The friendship and the requests that the block took away do not come back.
create or replace function public.friend_unblock(p_user uuid, p_nickname text, p_tag integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other uuid := public.friend_target(p_nickname, p_tag);
begin
  if v_other is null or v_other = p_user then
    return 'missing';
  end if;
  delete from public.friend_blocks b where b.blocker = p_user and b.blocked = v_other;
  return case when found then 'unblocked' else 'missing' end;
end;
$$;

-- What is between two members, as `p_user` may know it: 'friends', 'incoming' (the other sent them a request), 'outgoing' (they sent one to the other), 'blocked' (they blocked the other) or 'none'. A member who was blocked by the other is
-- 'none' too: nothing tells them. For the "Add friend" button of a profile.
create or replace function public.friend_relation(p_user uuid, p_other uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_other is null or p_user = p_other then 'none'
    when exists (select 1 from public.friend_blocks b where b.blocker = p_user and b.blocked = p_other) then 'blocked'
    when exists (select 1 from public.friendships f where f.user_a = least(p_user, p_other) and f.user_b = greatest(p_user, p_other)) then 'friends'
    when exists (select 1 from public.friend_requests r where r.sender = p_other and r.recipient = p_user) then 'incoming'
    when exists (select 1 from public.friend_requests r where r.sender = p_user and r.recipient = p_other) then 'outgoing'
    else 'none'
  end
$$;

-- The whole social state of a member, in one answer, for the panel that every page has and for the pages of `/me/friends` and the settings: their friends with their presence, the requests that came in and went out, and the members they blocked.
-- A closed account is in none of them, and neither is one with no profile.
--
-- A friend is online when the server saw them in the last two minutes, the way the players online are counted (migration 0005): a beat of their tab (`member_presence`), or a seat of theirs at a table that is not over, seen by the table in that time (`games.seen`,
-- which a board keeps fresh while it is open: the board is not a page of the hub and does not beat). An online friend is `playing` when they hold a seat at a table that is being played or in its ready check, and in a `lobby` when they hold one at a table
-- that waits, as `member_tables` does (migration 0013: the tables written within `p_idle`, a seat that left is not a seat); a friend at several tables is shown at the one being played first, then the one written last. A friend who is not online is shown at no table.
-- The answer names the game and the phase, never the table: its code is the only key to it.
-- Keys: friends [{nickname, tag, avatar_url, online, game, phase}], incoming and outgoing [{nickname, tag, avatar_url, at}], blocked [{nickname, tag, avatar_url}].
create or replace function public.social_state(p_user uuid, p_idle interval default interval '6 hours')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with visible as (
    select p.user_id as id, p.nickname, p.tag, p.avatar_url
    from public.friendships f
    join public.profiles p on p.user_id = (case when f.user_a = p_user then f.user_b else f.user_a end)
    where (f.user_a = p_user or f.user_b = p_user)
      and not exists (select 1 from public.account_deletions d where d.user_id = p.user_id)
  ),
  seats as (
    select v.id, g.game, g.status, g.updated_at, coalesce((g.seen ->> m.key)::timestamptz > now() - interval '2 minutes', false) as present
    from public.games g
    cross join lateral jsonb_each_text(g.member_ids) as m (key, value)
    join visible v on v.id::text = m.value
    where g.status in ('lobby', 'starting', 'playing')
      and g.updated_at > now() - p_idle
      and exists (select 1 from jsonb_array_elements(g.players) pl where pl ->> 'id' = m.key and not (pl @> '{"left": true}'::jsonb))
  ),
  online as (
    select v.id,
      exists (select 1 from public.member_presence mp where mp.user_id = v.id and mp.seen_at > now() - interval '2 minutes')
      or exists (select 1 from seats s where s.id = v.id and s.present) as is_online
    from visible v
  ),
  placed as (
    select distinct on (s.id) s.id, s.game, case when s.status = 'lobby' then 'lobby' else 'playing' end as phase
    from seats s
    order by s.id, (case s.status when 'playing' then 0 when 'starting' then 1 else 2 end), s.updated_at desc
  )
  select jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nickname', v.nickname, 'tag', v.tag, 'avatar_url', v.avatar_url, 'online', o.is_online,
        'game', case when o.is_online then pl.game end, 'phase', case when o.is_online then pl.phase end
      ) order by lower(v.nickname), v.tag)
      from visible v join online o on o.id = v.id left join placed pl on pl.id = v.id
    ), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'tag', p.tag, 'avatar_url', p.avatar_url, 'at', r.created_at) order by r.created_at desc, r.sender)
      from public.friend_requests r join public.profiles p on p.user_id = r.sender
      where r.recipient = p_user and not exists (select 1 from public.account_deletions d where d.user_id = r.sender)
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'tag', p.tag, 'avatar_url', p.avatar_url, 'at', r.created_at) order by r.created_at desc, r.recipient)
      from public.friend_requests r join public.profiles p on p.user_id = r.recipient
      where r.sender = p_user and not exists (select 1 from public.account_deletions d where d.user_id = r.recipient)
    ), '[]'::jsonb),
    'blocked', coalesce((
      select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'tag', p.tag, 'avatar_url', p.avatar_url) order by b.created_at desc, b.blocked)
      from public.friend_blocks b join public.profiles p on p.user_id = b.blocked
      where b.blocker = p_user and not exists (select 1 from public.account_deletions d where d.user_id = b.blocked)
    ), '[]'::jsonb)
  )
$$;

-- Server only (service role), like the tables: none of these is callable by the public roles
revoke all on function public.friend_lock(uuid, uuid) from public, anon, authenticated;
revoke all on function public.friend_target(text, integer) from public, anon, authenticated;
revoke all on function public.friend_count(uuid) from public, anon, authenticated;
revoke all on function public.friend_request_send(uuid, text, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.friend_request_answer(uuid, text, integer, text, integer) from public, anon, authenticated;
revoke all on function public.friend_remove(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.friend_block(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.friend_unblock(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.friend_relation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.social_state(uuid, interval) from public, anon, authenticated;
grant execute on function public.friend_lock(uuid, uuid) to service_role;
grant execute on function public.friend_target(text, integer) to service_role;
grant execute on function public.friend_count(uuid) to service_role;
grant execute on function public.friend_request_send(uuid, text, integer, integer, integer, integer) to service_role;
grant execute on function public.friend_request_answer(uuid, text, integer, text, integer) to service_role;
grant execute on function public.friend_remove(uuid, text, integer) to service_role;
grant execute on function public.friend_block(uuid, text, integer, integer) to service_role;
grant execute on function public.friend_unblock(uuid, text, integer) to service_role;
grant execute on function public.friend_relation(uuid, uuid) to service_role;
grant execute on function public.social_state(uuid, interval) to service_role;
