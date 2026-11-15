-- Groups (PLT-23): members who play together. A group has two to eight members and one leader. It is made by an invitation that a friend accepts (an invitation to a group is the one mechanism of the invitations to a table, PLT-109, with another `kind`),
-- a member who is not in a group can ask to join the group of a friend (a request that is also a row of `table_invitations`, one for each member of the group, so that any of them can answer it), any member can invite, the leader can remove a member and hand the
-- lead over, a member can leave, and the group stays together whatever its members do (it is not tied to a table). Until now the social panel had no group.
--
-- Two tables, server only (service role), like the friends' tables (0017): row level security is on without policy and the public roles have no grant, so the browser never reads them. The server reads and writes them through the functions below, each of which
-- decides in one transaction.
--
-- `friend_groups`: a group, and who leads it. `friend_group_members`: who is in it, and since when; a member is in one group at most (`user_id` is unique), and the order of `joined_at` is who leads when the leader leaves without handing the lead over. A group
-- of one person is no group: it is made when the second member comes (the first invitation that is accepted makes it, with its sender as the leader), and it goes, with the requests to join it, as soon as it has fewer than two members (the trigger below: a member
-- who leaves, is removed, closes their account or deletes it). The leader is never a key to `auth.users`: the group must live on when its leader's account goes, so the trigger gives the lead to the member who has been in it longest.
--
-- The invitations: `table_invitations` keeps its name and holds three kinds now. `kind = 'table'` is what it held (a friend invited to a lobby, `game` and `code`); `kind = 'group'` invites a friend to the sender's group (the group, if the sender has one, is the one they
-- are in when the friend accepts, and the first acceptance makes it when they have none); `kind = 'join'` asks to join the group of a friend: there is one row for each member of that group (`group_id`), the first member who accepts lets the requester in, and the
-- first who declines declines it for all. Only friends can be invited, and only a friend's group can be asked; a member who blocked someone is never told what they do (nothing is stored for them and the answer is the one of a request that went). Nothing here
-- reveals a table's code, and none of the rows holds one but the invitations to a table.
--
-- Groups are ephemeral: an idle one (nobody in it seen for a day) goes with the nightly clean-up (`groups_purge`), and the invitations and the requests go like the others (they expire, and the rows go a day after they were sent).
--
-- Every group change takes the one lock of the groups (`group_lock`), so that they take turns: they are made at the speed of people, and it keeps the cap, the one group of a member and the lead exact. The order in which the locks are taken, to leave no deadlock, is the pair
-- of two members (`friend_lock`), then the groups, then the rows.

-- The groups

create table if not exists public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  -- A member of the group: kept by the functions and the trigger below. No key to `auth.users`: the group does not go with its leader's account
  leader uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.friend_group_members (
  group_id uuid not null references public.friend_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  -- A member is in one group at most
  constraint friend_group_members_one_group unique (user_id)
);

create index if not exists friend_groups_created_idx on public.friend_groups (created_at);

alter table public.friend_groups enable row level security;
alter table public.friend_group_members enable row level security;
revoke all on table public.friend_groups from anon, authenticated;
revoke all on table public.friend_group_members from anon, authenticated;
grant select, insert, update, delete on table public.friend_groups to service_role;
grant select, insert, update, delete on table public.friend_group_members to service_role;

-- The invitations: a kind, and the group a request is for

alter table public.table_invitations add column if not exists kind text not null default 'table';
alter table public.table_invitations add column if not exists group_id uuid references public.friend_groups (id) on delete cascade;
alter table public.table_invitations alter column game drop not null;
alter table public.table_invitations alter column code drop not null;

alter table public.table_invitations drop constraint if exists table_invitations_kind_check;
alter table public.table_invitations add constraint table_invitations_kind_check check (kind in ('table', 'group', 'join'));
-- A table invitation names its table; an invitation to a group names nothing; a request to join names the group it is for
alter table public.table_invitations drop constraint if exists table_invitations_shape_check;
alter table public.table_invitations add constraint table_invitations_shape_check check (
  (kind = 'table' and game is not null and code is not null and group_id is null)
  or (kind = 'group' and game is null and code is null and group_id is null)
  or (kind = 'join' and game is null and code is null and group_id is not null)
);

-- One pending invitation to a group from a sender to a friend, and one pending request from a member to another for a group (a second press changes nothing)
create unique index if not exists table_invitations_pending_group_idx on public.table_invitations (sender, recipient, kind, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid)) where status = 'pending' and kind <> 'table';
create index if not exists table_invitations_group_idx on public.table_invitations (group_id) where group_id is not null;

-- Locks and small helpers

-- Holds the groups still while a function changes them, until its transaction ends: one lock for all of them
create or replace function public.group_lock()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(7027);
end;
$$;

-- The group a member is in, or null
create or replace function public.group_of(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.group_id from public.friend_group_members m where m.user_id = p_user
$$;

-- When a member leaves a group by any road (they leave, they are removed, they close their account, it is deleted): a group with fewer than two members goes, with the requests to join it, and a group whose leader went gets the member who has been in it longest
create or replace function public.friend_group_member_left()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_leader uuid;
begin
  perform public.group_lock();
  select g.leader into v_leader from public.friend_groups g where g.id = old.group_id;
  if not found then
    -- The group is gone already: it was deleted, and its members with it
    return null;
  end if;
  if (select count(*) from public.friend_group_members m where m.group_id = old.group_id) < 2 then
    delete from public.friend_groups g where g.id = old.group_id;
    return null;
  end if;
  if not exists (select 1 from public.friend_group_members m where m.group_id = old.group_id and m.user_id = v_leader) then
    update public.friend_groups g
    set leader = (select m.user_id from public.friend_group_members m where m.group_id = old.group_id order by m.joined_at, m.user_id limit 1)
    where g.id = old.group_id;
  end if;
  return null;
end;
$$;

drop trigger if exists friend_group_members_left on public.friend_group_members;
create trigger friend_group_members_left after delete on public.friend_group_members for each row execute function public.friend_group_member_left();

-- A member who closes their account (PLT-36) is in nobody's list, so they leave their group
create or replace function public.friend_group_account_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.group_lock();
  delete from public.friend_group_members m where m.user_id = new.user_id;
  return null;
end;
$$;

drop trigger if exists friend_group_account_closed on public.account_deletions;
create trigger friend_group_account_closed after insert on public.account_deletions for each row execute function public.friend_group_account_closed();

-- A member who blocks another leaves the group they share with them: they are not told what the other does, so they are not kept beside them. The name of this trigger is before the one that takes the invitations away (`table_invitations_block`): the groups come first in the
-- order of the locks
create or replace function public.friend_group_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.group_lock();
  delete from public.friend_group_members m
  where m.user_id = new.blocker
    and exists (select 1 from public.friend_group_members o where o.group_id = m.group_id and o.user_id = new.blocked);
  return null;
end;
$$;

drop trigger if exists friend_group_block on public.friend_blocks;
create trigger friend_group_block after insert on public.friend_blocks for each row execute function public.friend_group_block();

-- Inviting and asking

-- Invites the friend who goes by this handle to the sender's group. Answers:
--   'sent'           the invitation waits for them (or it did already: nothing changes), or a block stands beside the friendship, in which case nothing is stored and the answer is the same;
--   'missing'        nobody goes by this handle (a closed account is nobody);
--   'self'           the handle is the sender's own;
--   'not_friends'    they are not friends (never, removed, or blocked: the answer is one);
--   'already'        the friend is in the sender's group already;
--   'busy'           the friend is in another group (they ask to join the sender's, or leave theirs);
--   'full'           the sender's group has `p_max_members` members;
--   'too_many_sent'  the sender has `p_max_sent` invitations and requests that wait;
--   'unavailable'    the friend has `p_max_received` waiting.
-- A sender with no group invites to the one that their friend's acceptance makes: any member may invite, the leader does not validate.
create or replace function public.group_invite(p_user uuid, p_nickname text, p_tag integer, p_ttl interval, p_max_sent integer, p_max_received integer, p_max_members integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := public.friend_target(p_nickname, p_tag);
  v_group uuid;
begin
  if v_target is null then
    return 'missing';
  end if;
  if v_target = p_user then
    return 'self';
  end if;
  perform public.group_lock();

  if not exists (select 1 from public.friendships f where f.user_a = least(p_user, v_target) and f.user_b = greatest(p_user, v_target)) then
    return 'not_friends';
  end if;
  if exists (select 1 from public.friend_blocks b where (b.blocker = p_user and b.blocked = v_target) or (b.blocker = v_target and b.blocked = p_user)) then
    return 'sent';
  end if;

  v_group := public.group_of(p_user);
  if v_group is not null then
    if public.group_of(v_target) = v_group then
      return 'already';
    end if;
    if (select count(*) from public.friend_group_members m where m.group_id = v_group) >= p_max_members then
      return 'full';
    end if;
  end if;
  if public.group_of(v_target) is not null then
    return 'busy';
  end if;

  update public.table_invitations i set status = 'expired', answered_at = now() where i.status = 'pending' and i.expires_at <= now() and (i.sender = p_user or i.recipient = v_target);
  delete from public.table_invitations i where i.created_at < now() - interval '1 day' and (i.sender = p_user or i.recipient = v_target);

  if exists (select 1 from public.table_invitations i where i.sender = p_user and i.recipient = v_target and i.kind = 'group' and i.status = 'pending') then
    return 'sent';
  end if;
  if (select count(*) from public.table_invitations i where i.sender = p_user and i.status = 'pending') >= p_max_sent then
    return 'too_many_sent';
  end if;
  if (select count(*) from public.table_invitations i where i.recipient = v_target and i.status = 'pending') >= p_max_received then
    return 'unavailable';
  end if;
  insert into public.table_invitations (sender, recipient, kind, expires_at) values (p_user, v_target, 'group', now() + p_ttl);
  return 'sent';
end;
$$;

-- Asks to join the group of the friend who goes by this handle: one request for each member of that group, so that any of them can answer it. Answers:
--   'sent'           the request waits (or it did already), or a member of the group blocked the sender, in which case nothing is stored and the answer is the same;
--   'missing'        nobody goes by this handle;
--   'self'           the handle is the sender's own;
--   'not_friends'    they are not friends (never, removed, or blocked: the answer is one);
--   'in_group'       the sender is in a group already (they leave it first);
--   'no_group'       the friend is not in a group (or left it since the screen showed them in one);
--   'full'           the group has `p_max_members` members;
--   'unavailable'    the sender blocked a member of the group (they know their own blocks), or every member of it has `p_max_received` waiting;
--   'too_many_sent'  the sender has `p_max_sent` invitations and requests that wait.
create or replace function public.group_ask(p_user uuid, p_nickname text, p_tag integer, p_ttl interval, p_max_sent integer, p_max_received integer, p_max_members integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := public.friend_target(p_nickname, p_tag);
  v_group uuid;
  v_made integer;
begin
  if v_target is null then
    return 'missing';
  end if;
  if v_target = p_user then
    return 'self';
  end if;
  perform public.group_lock();

  if not exists (select 1 from public.friendships f where f.user_a = least(p_user, v_target) and f.user_b = greatest(p_user, v_target)) then
    return 'not_friends';
  end if;
  if exists (select 1 from public.friend_blocks b where (b.blocker = p_user and b.blocked = v_target) or (b.blocker = v_target and b.blocked = p_user)) then
    return 'sent';
  end if;
  if public.group_of(p_user) is not null then
    return 'in_group';
  end if;
  v_group := public.group_of(v_target);
  if v_group is null then
    return 'no_group';
  end if;
  if (select count(*) from public.friend_group_members m where m.group_id = v_group) >= p_max_members then
    return 'full';
  end if;
  if exists (select 1 from public.friend_group_members m join public.friend_blocks b on b.blocker = p_user and b.blocked = m.user_id where m.group_id = v_group) then
    return 'unavailable';
  end if;
  if exists (select 1 from public.friend_group_members m join public.friend_blocks b on b.blocker = m.user_id and b.blocked = p_user where m.group_id = v_group) then
    -- A member of the group blocked the sender: nothing is stored, and the sender is not told
    return 'sent';
  end if;

  update public.table_invitations i set status = 'expired', answered_at = now() where i.status = 'pending' and i.expires_at <= now() and i.sender = p_user;
  delete from public.table_invitations i where i.created_at < now() - interval '1 day' and i.sender = p_user;

  if exists (select 1 from public.table_invitations i where i.sender = p_user and i.kind = 'join' and i.group_id = v_group and i.status = 'pending') then
    return 'sent';
  end if;
  if (select count(*) from public.table_invitations i where i.sender = p_user and i.status = 'pending') >= p_max_sent then
    return 'too_many_sent';
  end if;
  insert into public.table_invitations (sender, recipient, kind, group_id, expires_at)
  select p_user, m.user_id, 'join', v_group, now() + p_ttl
  from public.friend_group_members m
  where m.group_id = v_group
    and (select count(*) from public.table_invitations i where i.recipient = m.user_id and i.status = 'pending') < p_max_received;
  get diagnostics v_made = row_count;
  if v_made = 0 then
    return 'unavailable';
  end if;
  return 'sent';
end;
$$;

-- Answering

-- Accepts the invitation to a group or the request to join one `p_id` of `p_user`: the invitation of a friend makes `p_user` a member of their group (the sender's group, made now if they had none), and a request that `p_user` accepts makes its sender a member of
-- the group that `p_user` is in. Answers:
--   'created'      the group was made: the sender of the invitation leads it;
--   'joined'       they are in the group (or were already: an invitation to somebody who is in the group is only answered);
--   'missing'      there is none by this id for them, it was answered already, its sender is not their friend any more (an invitation), or the group of a request has gone;
--   'expired'      its time has passed (it is marked so);
--   'in_group'     the member who accepts an invitation is in another group (they leave it first);
--   'full'         the group has `p_max_members` members;
--   'unavailable'  somebody in the group blocked the one who joins it, or the one who joins blocked somebody in it (nothing says which).
-- Accepting answers the siblings of a request, and ends the requests that the one who joined had out.
create or replace function public.group_accept(p_user uuid, p_id uuid, p_max_members integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.table_invitations;
  v_joiner uuid;
  v_host uuid;
  v_group uuid;
  v_made boolean := false;
begin
  perform public.group_lock();
  select * into v from public.table_invitations i where i.id = p_id and i.recipient = p_user and i.kind in ('group', 'join') for update;
  if not found or v.status <> 'pending' then
    return 'missing';
  end if;
  if exists (select 1 from public.account_deletions d where d.user_id = v.sender) then
    return 'missing';
  end if;
  if v.expires_at <= now() then
    update public.table_invitations i set status = 'expired', answered_at = now() where i.id = v.id;
    return 'expired';
  end if;

  if v.kind = 'group' then
    v_joiner := p_user;
    v_host := v.sender;
    if not exists (select 1 from public.friendships f where f.user_a = least(p_user, v.sender) and f.user_b = greatest(p_user, v.sender)) then
      return 'missing';
    end if;
  else
    v_joiner := v.sender;
    v_host := p_user;
    -- The request is for the group the member who answers is still in
    if not exists (select 1 from public.friend_group_members m where m.group_id = v.group_id and m.user_id = p_user) then
      return 'missing';
    end if;
  end if;

  v_group := public.group_of(v_host);
  if v_group is not null and public.group_of(v_joiner) = v_group then
    update public.table_invitations i set status = 'accepted', answered_at = now() where i.id = v.id;
    return 'joined';
  end if;
  if public.group_of(v_joiner) is not null then
    -- A member who asked and joined another group meanwhile has nothing to be let into
    return case when v.kind = 'group' then 'in_group' else 'missing' end;
  end if;
  if v_group is not null then
    if exists (
      select 1 from public.friend_group_members m join public.friend_blocks b on (b.blocker = v_joiner and b.blocked = m.user_id) or (b.blocker = m.user_id and b.blocked = v_joiner)
      where m.group_id = v_group
    ) then
      return 'unavailable';
    end if;
    if (select count(*) from public.friend_group_members m where m.group_id = v_group) >= p_max_members then
      return 'full';
    end if;
    insert into public.friend_group_members (group_id, user_id) values (v_group, v_joiner);
  else
    insert into public.friend_groups (leader) values (v_host) returning id into v_group;
    insert into public.friend_group_members (group_id, user_id) values (v_group, v_host), (v_group, v_joiner);
    v_made := true;
  end if;

  update public.table_invitations i set status = 'accepted', answered_at = now() where i.id = v.id;
  -- The first answer is everybody's: the same request that went to the other members is answered with it, and the one who joined has no use for the others they sent
  update public.table_invitations i set status = 'expired', answered_at = now() where i.status = 'pending' and i.kind = 'join' and i.sender = v_joiner;
  return case when v_made then 'created' else 'joined' end;
end;
$$;

-- Looks at, accepts or declines an invitation of `p_user` (`p_answer`: 'peek', 'accept', 'decline'), by its id. The answer is `{result, kind, game, code}`, `game` and `code` only for an invitation to a table and only when it is theirs and was pending:
--   'pending'   (peek) it waits, and is theirs: for a table the server then checks it before accepting, for a group `group_accept` does it;
--   'accepted' | 'declined'   done (a group invitation or a request is accepted by `group_accept` and only declined here; a decline of a request is every member's);
--   'expired'   its time has passed (it is marked so);
--   'missing'   there is none by this id for them, it was answered already, or its sender is not their friend any more (a request to join is for a member of the group, who need not be a friend of the one who asks: a block is what ends it).
-- An invitation that is not the member's own is 'missing': nothing tells another member that it exists. The pair is held before the group and the row, as a block holds them.
create or replace function public.invitation_answer(p_user uuid, p_id uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.table_invitations;
  v_sender uuid;
  v_kind text;
begin
  if p_answer not in ('peek', 'accept', 'decline') then
    return jsonb_build_object('result', 'missing');
  end if;
  select i.sender, i.kind into v_sender, v_kind from public.table_invitations i where i.id = p_id and i.recipient = p_user;
  if not found then
    return jsonb_build_object('result', 'missing');
  end if;
  perform public.friend_lock(p_user, v_sender);
  if v_kind <> 'table' then
    perform public.group_lock();
  end if;
  select * into v from public.table_invitations i where i.id = p_id and i.recipient = p_user for update;
  if not found or v.status <> 'pending' then
    return jsonb_build_object('result', 'missing');
  end if;
  if v.kind = 'join' then
    if exists (select 1 from public.friend_blocks b where (b.blocker = p_user and b.blocked = v.sender) or (b.blocker = v.sender and b.blocked = p_user)) then
      return jsonb_build_object('result', 'missing');
    end if;
  elsif not exists (select 1 from public.friendships f where f.user_a = least(p_user, v.sender) and f.user_b = greatest(p_user, v.sender)) then
    return jsonb_build_object('result', 'missing');
  end if;
  if v.expires_at <= now() then
    update public.table_invitations i set status = 'expired', answered_at = now() where i.id = v.id;
    return jsonb_build_object('result', 'expired');
  end if;
  if p_answer = 'peek' then
    return jsonb_build_object('result', 'pending', 'kind', v.kind, 'game', v.game, 'code', v.code);
  end if;
  if p_answer = 'accept' and v.kind <> 'table' then
    return jsonb_build_object('result', 'missing');
  end if;
  update public.table_invitations i set status = case p_answer when 'accept' then 'accepted' else 'declined' end, answered_at = now() where i.id = v.id;
  if v.kind = 'join' and p_answer = 'decline' then
    update public.table_invitations i set status = 'declined', answered_at = now() where i.kind = 'join' and i.sender = v.sender and i.group_id = v.group_id and i.status = 'pending';
  end if;
  return jsonb_build_object('result', case p_answer when 'accept' then 'accepted' else 'declined' end, 'kind', v.kind, 'game', v.game, 'code', v.code);
end;
$$;

-- The invitations that wait for a member, the newest first, for the social panel: who sent each (nickname, tag, picture), its kind (`table`, `group`, `join`), the game of an invitation to a table and when it was sent and expires. Never the table's code. Only the ones
-- whose sender is still a friend (a request to join is for a member of the group that is asked, who need not be a friend of the one who asks: the group must still be theirs, the one who asks still in none, and no block between them) and whose account is not closed
-- (PLT-36), not yet expired, fifty at the most.
create or replace function public.invitations_for(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'kind', i.kind, 'nickname', p.nickname, 'tag', p.tag, 'avatar_url', p.avatar_url, 'game', i.game, 'at', i.created_at, 'expires_at', i.expires_at
  ) order by i.created_at desc, i.id), '[]'::jsonb)
  from (
    select * from public.table_invitations i
    where i.recipient = p_user and i.status = 'pending' and i.expires_at > now()
    order by i.created_at desc limit 50
  ) i
  join public.profiles p on p.user_id = i.sender
  where not exists (select 1 from public.account_deletions d where d.user_id = i.sender)
    and (
      (i.kind <> 'join' and exists (select 1 from public.friendships f where f.user_a = least(p_user, i.sender) and f.user_b = greatest(p_user, i.sender)))
      or (
        i.kind = 'join'
        and exists (select 1 from public.friend_group_members m where m.group_id = i.group_id and m.user_id = p_user)
        and not exists (select 1 from public.friend_group_members m where m.user_id = i.sender)
        and not exists (select 1 from public.friend_blocks b where (b.blocker = p_user and b.blocked = i.sender) or (b.blocker = i.sender and b.blocked = p_user))
      )
    )
$$;

-- Leaving, removing and handing the lead over

-- A member leaves their group. Answers 'left', or 'missing' (they are in none). What follows is the trigger's: the lead goes to the member who has been in it longest, and a group left with one member goes.
create or replace function public.group_leave(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.group_lock();
  delete from public.friend_group_members m where m.user_id = p_user;
  return case when found then 'left' else 'missing' end;
end;
$$;

-- The leader removes the member who goes by this handle from their group. Answers 'kicked', 'not_in_group' (they are in none), 'not_leader', or 'missing' (nobody goes by it, it is the leader's own, or they are not in the group).
create or replace function public.group_kick(p_user uuid, p_nickname text, p_tag integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_target uuid;
begin
  perform public.group_lock();
  v_group := public.group_of(p_user);
  if v_group is null then
    return 'not_in_group';
  end if;
  if not exists (select 1 from public.friend_groups g where g.id = v_group and g.leader = p_user) then
    return 'not_leader';
  end if;
  v_target := public.friend_target(p_nickname, p_tag);
  if v_target is null or v_target = p_user then
    return 'missing';
  end if;
  delete from public.friend_group_members m where m.group_id = v_group and m.user_id = v_target;
  return case when found then 'kicked' else 'missing' end;
end;
$$;

-- The leader hands the lead over to the member who goes by this handle. Answers 'led', 'not_in_group', 'not_leader', or 'missing' (nobody goes by it, it is the leader's own, or they are not in the group).
create or replace function public.group_lead(p_user uuid, p_nickname text, p_tag integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_target uuid;
begin
  perform public.group_lock();
  v_group := public.group_of(p_user);
  if v_group is null then
    return 'not_in_group';
  end if;
  if not exists (select 1 from public.friend_groups g where g.id = v_group and g.leader = p_user) then
    return 'not_leader';
  end if;
  v_target := public.friend_target(p_nickname, p_tag);
  if v_target is null or v_target = p_user or public.group_of(v_target) is distinct from v_group then
    return 'missing';
  end if;
  update public.friend_groups g set leader = v_target where g.id = v_group;
  return 'led';
end;
$$;

-- What the panel needs of the groups, in one answer: the member's own group (its members, each with their picture, whether they lead it, whether they are the member themselves, whether they are online and the game they are at: the rule of `social_state`, never
-- the table), the friends who are in a group (the others' groups are not shown: only that a friend is in one), the friends the member invited to their group and the friends whose group they asked to join, which wait for an answer. The group is null for a member who is in none.
-- Keys: group {members [{nickname, tag, avatar_url, leader, you, online, game, phase}]} | null, grouped, invited and requested [{nickname, tag}].
create or replace function public.group_state(p_user uuid, p_idle interval default interval '6 hours')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select m.group_id from public.friend_group_members m where m.user_id = p_user
  ),
  members as (
    select m.user_id as id, m.joined_at, (g.leader = m.user_id) as is_leader, p.nickname, p.tag, p.avatar_url
    from mine
    join public.friend_group_members m on m.group_id = mine.group_id
    join public.friend_groups g on g.id = m.group_id
    join public.profiles p on p.user_id = m.user_id
  ),
  seats as (
    select v.id, g.game, g.status, g.updated_at, coalesce((g.seen ->> m.key)::timestamptz > now() - interval '2 minutes', false) as present
    from public.games g
    cross join lateral jsonb_each_text(g.member_ids) as m (key, value)
    join members v on v.id::text = m.value
    where g.status in ('lobby', 'starting', 'playing')
      and g.updated_at > now() - p_idle
      and exists (select 1 from jsonb_array_elements(g.players) pl where pl ->> 'id' = m.key and not (pl @> '{"left": true}'::jsonb))
  ),
  online as (
    select v.id,
      exists (select 1 from public.member_presence mp where mp.user_id = v.id and mp.seen_at > now() - interval '2 minutes')
      or exists (select 1 from seats s where s.id = v.id and s.present) as is_online
    from members v
  ),
  placed as (
    select distinct on (s.id) s.id, s.game, case when s.status = 'lobby' then 'lobby' else 'playing' end as phase
    from seats s
    order by s.id, (case s.status when 'playing' then 0 when 'starting' then 1 else 2 end), s.updated_at desc
  )
  select jsonb_build_object(
    'group', case when exists (select 1 from mine) then jsonb_build_object('members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nickname', v.nickname, 'tag', v.tag, 'avatar_url', v.avatar_url, 'leader', v.is_leader, 'you', (v.id = p_user),
        'online', o.is_online, 'game', case when o.is_online then pl.game end, 'phase', case when o.is_online then pl.phase end
      ) order by v.is_leader desc, v.joined_at, v.id)
      from members v join online o on o.id = v.id left join placed pl on pl.id = v.id
    ), '[]'::jsonb)) end,
    'grouped', coalesce((
      select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'tag', p.tag) order by lower(p.nickname), p.tag)
      from public.friendships f
      join public.friend_group_members m on m.user_id = (case when f.user_a = p_user then f.user_b else f.user_a end)
      join public.profiles p on p.user_id = m.user_id
      where (f.user_a = p_user or f.user_b = p_user)
        and not exists (select 1 from public.account_deletions d where d.user_id = m.user_id)
    ), '[]'::jsonb),
    'invited', coalesce((
      select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'tag', p.tag) order by i.created_at desc, i.id)
      from public.table_invitations i
      join public.profiles p on p.user_id = i.recipient
      where i.sender = p_user and i.kind = 'group' and i.status = 'pending' and i.expires_at > now()
        and exists (select 1 from public.friendships f where f.user_a = least(p_user, i.recipient) and f.user_b = greatest(p_user, i.recipient))
        and not exists (select 1 from public.account_deletions d where d.user_id = i.recipient)
    ), '[]'::jsonb),
    'requested', coalesce((
      select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'tag', p.tag) order by r.created_at desc, r.recipient)
      from (
        select distinct on (i.recipient) i.recipient, i.created_at
        from public.table_invitations i
        where i.sender = p_user and i.kind = 'join' and i.status = 'pending' and i.expires_at > now()
          and exists (select 1 from public.friendships f where f.user_a = least(p_user, i.recipient) and f.user_b = greatest(p_user, i.recipient))
        order by i.recipient, i.created_at desc
      ) r
      join public.profiles p on p.user_id = r.recipient
      where not exists (select 1 from public.account_deletions d where d.user_id = r.recipient)
    ), '[]'::jsonb)
  )
$$;

-- For the server only, to put a whole group somewhere (a search together, a table of the leader's): the group a member is in, `{id, leader, members}` with the accounts' ids, oldest member first, or null. Never sent to a browser.
create or replace function public.group_members_of(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', g.id, 'leader', g.leader,
    'members', (select jsonb_agg(o.user_id order by o.joined_at, o.user_id) from public.friend_group_members o where o.group_id = g.id)
  )
  from public.friend_group_members m
  join public.friend_groups g on g.id = m.group_id
  where m.user_id = p_user
$$;

-- The nightly clean-up: the groups whose members have all been away for `p_idle` (nobody was seen on the site, `member_presence`, in that time) go, with their requests. Answers how many; with `p_dry` it only counts them.
create or replace function public.groups_purge(p_idle interval, p_dry boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform public.group_lock();
  if p_dry then
    select count(*)::integer into v_count from public.friend_groups g
    where g.created_at < now() - p_idle
      and not exists (
        select 1 from public.friend_group_members m join public.member_presence mp on mp.user_id = m.user_id
        where m.group_id = g.id and mp.seen_at > now() - p_idle
      );
    return v_count;
  end if;
  delete from public.friend_groups g
  where g.created_at < now() - p_idle
    and not exists (
      select 1 from public.friend_group_members m join public.member_presence mp on mp.user_id = m.user_id
      where m.group_id = g.id and mp.seen_at > now() - p_idle
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Server only (service role), like the tables: none of these is callable by the public roles
revoke all on function public.group_lock() from public, anon, authenticated;
revoke all on function public.group_of(uuid) from public, anon, authenticated;
revoke all on function public.friend_group_member_left() from public, anon, authenticated;
revoke all on function public.friend_group_account_closed() from public, anon, authenticated;
revoke all on function public.friend_group_block() from public, anon, authenticated;
revoke all on function public.group_invite(uuid, text, integer, interval, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.group_ask(uuid, text, integer, interval, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.group_accept(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.invitation_answer(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.invitations_for(uuid) from public, anon, authenticated;
revoke all on function public.group_leave(uuid) from public, anon, authenticated;
revoke all on function public.group_kick(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.group_lead(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.group_state(uuid, interval) from public, anon, authenticated;
revoke all on function public.group_members_of(uuid) from public, anon, authenticated;
revoke all on function public.groups_purge(interval, boolean) from public, anon, authenticated;
grant execute on function public.group_lock() to service_role;
grant execute on function public.group_of(uuid) to service_role;
grant execute on function public.group_invite(uuid, text, integer, interval, integer, integer, integer) to service_role;
grant execute on function public.group_ask(uuid, text, integer, interval, integer, integer, integer) to service_role;
grant execute on function public.group_accept(uuid, uuid, integer) to service_role;
grant execute on function public.invitation_answer(uuid, uuid, text) to service_role;
grant execute on function public.invitations_for(uuid) to service_role;
grant execute on function public.group_leave(uuid) to service_role;
grant execute on function public.group_kick(uuid, text, integer) to service_role;
grant execute on function public.group_lead(uuid, text, integer) to service_role;
grant execute on function public.group_state(uuid, interval) to service_role;
grant execute on function public.group_members_of(uuid) to service_role;
grant execute on function public.groups_purge(interval, boolean) to service_role;
