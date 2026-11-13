-- Table invitations (PLT-109): a member invites a friend to the lobby they sit at, and the friend sees it in the social panel and accepts (they are taken to the table) or declines. Until now "Invite a friend" in the menu of a free seat was always
-- disabled.
--
-- One table, server only (service role), like the friends' tables (0017): row level security is on without policy and the public roles have no grant, so the browser never reads it. The server reads and writes it through the functions below, each of which
-- decides in one transaction. What is not in the database is checked by the server before it calls them, from the table's own row: that the sender sits at a lobby that waits and has a seat free (`core/server/invitations.ts`).
--
-- `table_invitations`: `sender` invited `recipient` to the table `code` of the game `game` (the slug). `status` is `pending` until the recipient answers (`accepted`, `declined`) or `expires_at` passes (`expired`: a pending invitation whose time has passed is
-- read as expired everywhere, and the functions mark it). An invitation lasts as long as the server says (`core/lib/invitations.ts`, `INVITATION_TTL_MINUTES`: a lobby is short-lived), and the rows go with the nightly clean-up a day after they were made (`INVITATION_RETENTION_DAYS`).
-- At most one pending invitation for a sender, a recipient and a table (a second press changes nothing and the friend is not asked twice); the caps are given by the server like the friends' limits (`MAX_INVITATIONS_SENT`, `MAX_INVITATIONS_RECEIVED`).
--
-- Who may be invited: a friend, only. A member who is not a friend is refused (`not_friends`), whether they never were, were removed, or blocked the sender, so that nothing tells a sender that they were blocked. If a block exists beside a friendship (it should not:
-- blocking ends it), the answer is `sent` and nothing is stored. Removing a friend or blocking one takes the invitations between them away (the triggers below), and the list of a member's invitations only has the ones whose sender is still a friend and
-- whose account is not closed (PLT-36).
--
-- The table's code never reaches the browser: the invitation is named by its own id, and the server reads the code when the friend accepts (`invitation_answer`).

create table if not exists public.table_invitations (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references auth.users (id) on delete cascade,
  recipient uuid not null references auth.users (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9-]+$'),
  code text not null check (char_length(code) between 1 and 16),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  answered_at timestamptz,
  constraint table_invitations_self_check check (sender <> recipient)
);

-- One pending invitation for the same sender, friend and table
create unique index if not exists table_invitations_pending_idx on public.table_invitations (sender, recipient, game, code) where status = 'pending';
-- What a member has waiting (the list of the panel), and what a sender has out (their cap)
create index if not exists table_invitations_recipient_idx on public.table_invitations (recipient) where status = 'pending';
create index if not exists table_invitations_sender_idx on public.table_invitations (sender) where status = 'pending';
-- The nightly clean-up goes by the day
create index if not exists table_invitations_created_idx on public.table_invitations (created_at);

alter table public.table_invitations enable row level security;
revoke all on table public.table_invitations from anon, authenticated;
grant select, insert, update, delete on table public.table_invitations to service_role;

-- Sends an invitation to the friend who goes by this handle, to the table `p_code` of `p_game` (the server has checked the table: the sender sits at it, it waits and has a seat free). Answers:
--   'sent'           the invitation waits for them (or it did already: nothing changes), or a block stands beside the friendship, in which case nothing is stored and the answer is the same;
--   'missing'        nobody goes by this handle (a closed account is nobody);
--   'self'           the handle is the sender's own;
--   'not_friends'    they are not friends (never, removed, or blocked: the answer is one);
--   'too_many_sent'  the sender has `p_max_sent` invitations that wait;
--   'unavailable'    the friend has `p_max_received` invitations waiting.
create or replace function public.invitation_send(p_user uuid, p_nickname text, p_tag integer, p_game text, p_code text, p_ttl interval, p_max_sent integer, p_max_received integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := public.friend_target(p_nickname, p_tag);
begin
  if v_target is null then
    return 'missing';
  end if;
  if v_target = p_user then
    return 'self';
  end if;
  perform public.friend_lock(p_user, v_target);

  if not exists (select 1 from public.friendships f where f.user_a = least(p_user, v_target) and f.user_b = greatest(p_user, v_target)) then
    return 'not_friends';
  end if;
  if exists (select 1 from public.friend_blocks b where (b.blocker = p_user and b.blocked = v_target) or (b.blocker = v_target and b.blocked = p_user)) then
    return 'sent';
  end if;

  -- What is stale: the ones nobody answered in time are expired, and what is a day old goes (the nightly clean-up does the rest)
  update public.table_invitations i set status = 'expired', answered_at = now() where i.status = 'pending' and i.expires_at <= now() and (i.sender = p_user or i.recipient = v_target);
  delete from public.table_invitations i where i.created_at < now() - interval '1 day' and (i.sender = p_user or i.recipient = v_target);

  if exists (select 1 from public.table_invitations i where i.sender = p_user and i.recipient = v_target and i.game = p_game and i.code = p_code and i.status = 'pending') then
    return 'sent';
  end if;
  if (select count(*) from public.table_invitations i where i.sender = p_user and i.status = 'pending') >= p_max_sent then
    return 'too_many_sent';
  end if;
  if (select count(*) from public.table_invitations i where i.recipient = v_target and i.status = 'pending') >= p_max_received then
    return 'unavailable';
  end if;
  insert into public.table_invitations (sender, recipient, game, code, expires_at) values (p_user, v_target, p_game, p_code, now() + p_ttl);
  return 'sent';
end;
$$;

-- Looks at, accepts or declines an invitation of `p_user` (`p_answer`: 'peek', 'accept', 'decline'), by its id. The answer is `{result, game, code}`, `game` and `code` only when the invitation is theirs and was pending:
--   'pending'   (peek) it waits, and is theirs: the server then checks the table before accepting;
--   'accepted' | 'declined'   done;
--   'expired'   its time has passed (it is marked so);
--   'missing'   there is none by this id for them, it was answered already, or its sender is not their friend any more.
-- An invitation that is not the member's own is 'missing': nothing tells another member that it exists.
create or replace function public.invitation_answer(p_user uuid, p_id uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.table_invitations;
begin
  if p_answer not in ('peek', 'accept', 'decline') then
    return jsonb_build_object('result', 'missing');
  end if;
  select * into v from public.table_invitations i where i.id = p_id and i.recipient = p_user for update;
  if not found or v.status <> 'pending' then
    return jsonb_build_object('result', 'missing');
  end if;
  perform public.friend_lock(p_user, v.sender);
  if not exists (select 1 from public.friendships f where f.user_a = least(p_user, v.sender) and f.user_b = greatest(p_user, v.sender)) then
    return jsonb_build_object('result', 'missing');
  end if;
  if v.expires_at <= now() then
    update public.table_invitations i set status = 'expired', answered_at = now() where i.id = v.id;
    return jsonb_build_object('result', 'expired');
  end if;
  if p_answer = 'peek' then
    return jsonb_build_object('result', 'pending', 'game', v.game, 'code', v.code);
  end if;
  update public.table_invitations i set status = case p_answer when 'accept' then 'accepted' else 'declined' end, answered_at = now() where i.id = v.id;
  return jsonb_build_object('result', case p_answer when 'accept' then 'accepted' else 'declined' end, 'game', v.game, 'code', v.code);
end;
$$;

-- The invitations that wait for a member, the newest first, for the social panel: who sent each (nickname, tag, picture), the game and when it was sent and expires. Never the table's code. Only the ones whose sender is still a friend and whose account is not
-- closed, not yet expired, fifty at the most.
create or replace function public.invitations_for(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'nickname', p.nickname, 'tag', p.tag, 'avatar_url', p.avatar_url, 'game', i.game, 'at', i.created_at, 'expires_at', i.expires_at
  ) order by i.created_at desc, i.id), '[]'::jsonb)
  from (
    select * from public.table_invitations i
    where i.recipient = p_user and i.status = 'pending' and i.expires_at > now()
    order by i.created_at desc limit 50
  ) i
  join public.profiles p on p.user_id = i.sender
  where exists (select 1 from public.friendships f where f.user_a = least(p_user, i.sender) and f.user_b = greatest(p_user, i.sender))
    and not exists (select 1 from public.account_deletions d where d.user_id = i.sender)
$$;

-- Takes the invitations between two members away when they stop being friends (a removal, or a block, which ends the friendship) or when one blocks the other
create or replace function public.invitations_between_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a uuid;
  v_b uuid;
begin
  if tg_table_name = 'friendships' then
    v_a := old.user_a;
    v_b := old.user_b;
  else
    v_a := new.blocker;
    v_b := new.blocked;
  end if;
  delete from public.table_invitations i where (i.sender = v_a and i.recipient = v_b) or (i.sender = v_b and i.recipient = v_a);
  return null;
end;
$$;

drop trigger if exists table_invitations_friendship_end on public.friendships;
create trigger table_invitations_friendship_end after delete on public.friendships for each row execute function public.invitations_between_end();
drop trigger if exists table_invitations_block on public.friend_blocks;
create trigger table_invitations_block after insert on public.friend_blocks for each row execute function public.invitations_between_end();

revoke all on function public.invitation_send(uuid, text, integer, text, text, interval, integer, integer) from public, anon, authenticated;
revoke all on function public.invitation_answer(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.invitations_for(uuid) from public, anon, authenticated;
revoke all on function public.invitations_between_end() from public, anon, authenticated;
grant execute on function public.invitation_send(uuid, text, integer, text, text, interval, integer, integer) to service_role;
grant execute on function public.invitation_answer(uuid, uuid, text) to service_role;
grant execute on function public.invitations_for(uuid) to service_role;
