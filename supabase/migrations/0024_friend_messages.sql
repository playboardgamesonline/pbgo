-- Messages between friends (PLT-25): direct text messages from one member to a friend, with their history and a read state. Until now the panel's Messages tab was empty and the chat window opened for the demo account only.
--
-- One table, server only (service role), like the friends' tables (0017): row level security is on without policy and the public roles have no grant, so the browser never reads it. The server reads and writes it through the functions below, each of which decides
-- in one transaction. A conversation is not a row of its own: it is the pair of two members, read as the messages between them, so that there is nothing to keep in step with the friendship.
--
-- `friend_messages`: `sender` wrote `body` to `recipient`; `read_at` is when the recipient read it (null while it waits). The table holds the text as written, at most 2000 characters (the server limits what it takes to `MESSAGE_MAX_LENGTH`, `core/lib/messages.ts`, which is
-- less); nothing else of the message: no attachment, no reaction, no group.
--
-- Who may write: a friend, only. A member who is not a friend (never, removed, or blocked the sender) is one answer (`not_friends`), so a block is not told. Ending the friendship, by a removal or by a block (which ends it), deletes the messages between the two members
-- (the trigger below): nothing is kept of a conversation whose friendship is over, so that a member who blocks another is left with nothing of them. A message is deleted `MESSAGE_RETENTION_DAYS` days after it was written by the nightly clean-up (`core/lib/retention.ts`),
-- and with either account (`on delete cascade`). The list of a member's conversations only has current friends whose account is not closed (PLT-36).
-- A sender cannot leave more than `p_max_unread` messages unread in a conversation: a friend who never reads is not flooded.

create table if not exists public.friend_messages (
  id bigint generated always as identity primary key,
  sender uuid not null references auth.users (id) on delete cascade,
  recipient uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint friend_messages_self_check check (sender <> recipient)
);

-- The messages between two members, the newest first (the history of a conversation), whoever wrote them
create index if not exists friend_messages_pair_idx on public.friend_messages (least(sender, recipient), greatest(sender, recipient), id desc);
-- What a member got and has not read (the counts of the panel), and what each member wrote or got (the list of conversations)
create index if not exists friend_messages_unread_idx on public.friend_messages (recipient, sender) where read_at is null;
create index if not exists friend_messages_recipient_idx on public.friend_messages (recipient, created_at desc);
create index if not exists friend_messages_sender_idx on public.friend_messages (sender, created_at desc);
-- The nightly clean-up goes by the day
create index if not exists friend_messages_created_idx on public.friend_messages (created_at);

alter table public.friend_messages enable row level security;
revoke all on table public.friend_messages from anon, authenticated;
grant select, insert, update, delete on table public.friend_messages to service_role;

-- Writes `p_body` to the friend who goes by this handle. The text is trimmed; answers `{result, id, at}` (`id` and `at` when it was sent):
--   'sent'         it is written;
--   'missing'      nobody goes by this handle (a closed account is nobody);
--   'self'         the handle is the sender's own;
--   'not_friends'  they are not friends (never, removed, or blocked: the answer is one);
--   'empty'        nothing but spaces;
--   'too_long'     more than `p_max_length` characters (once trimmed);
--   'too_many'     the sender has `p_max_unread` messages that the friend has not read.
create or replace function public.message_send(p_user uuid, p_nickname text, p_tag integer, p_body text, p_max_length integer, p_max_unread integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := public.friend_target(p_nickname, p_tag);
  v_body text := btrim(coalesce(p_body, ''));
  v_id bigint;
  v_at timestamptz;
begin
  if v_target is null then
    return jsonb_build_object('result', 'missing');
  end if;
  if v_target = p_user then
    return jsonb_build_object('result', 'self');
  end if;
  perform public.friend_lock(p_user, v_target);
  if not exists (select 1 from public.friendships f where f.user_a = least(p_user, v_target) and f.user_b = greatest(p_user, v_target))
    or exists (select 1 from public.friend_blocks b where (b.blocker = p_user and b.blocked = v_target) or (b.blocker = v_target and b.blocked = p_user)) then
    return jsonb_build_object('result', 'not_friends');
  end if;
  if v_body = '' then
    return jsonb_build_object('result', 'empty');
  end if;
  if char_length(v_body) > p_max_length then
    return jsonb_build_object('result', 'too_long');
  end if;
  if (select count(*) from public.friend_messages m where m.sender = p_user and m.recipient = v_target and m.read_at is null) >= p_max_unread then
    return jsonb_build_object('result', 'too_many');
  end if;
  insert into public.friend_messages (sender, recipient, body) values (p_user, v_target, v_body) returning id, created_at into v_id, v_at;
  return jsonb_build_object('result', 'sent', 'id', v_id, 'at', v_at);
end;
$$;

-- The conversation of `p_user` with the friend who goes by this handle: the last `p_limit` messages, the oldest first, each `{id, mine, text, at}`, and how many of the friend's they have not read yet. Answers `{result: 'ok', messages, unread}`, or
-- `{result: 'missing'}` (nobody goes by it) or `{result: 'not_friends'}` (they are not friends, so there is nothing to read: a block shows nothing).
create or replace function public.messages_with(p_user uuid, p_nickname text, p_tag integer, p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_other uuid := public.friend_target(p_nickname, p_tag);
begin
  if v_other is null or v_other = p_user then
    return jsonb_build_object('result', 'missing');
  end if;
  if not exists (select 1 from public.friendships f where f.user_a = least(p_user, v_other) and f.user_b = greatest(p_user, v_other)) then
    return jsonb_build_object('result', 'not_friends');
  end if;
  return jsonb_build_object(
    'result', 'ok',
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'mine', t.sender = p_user, 'text', t.body, 'at', t.created_at) order by t.id)
      from (
        select m.* from public.friend_messages m
        where least(m.sender, m.recipient) = least(p_user, v_other) and greatest(m.sender, m.recipient) = greatest(p_user, v_other)
        order by m.id desc limit p_limit
      ) t
    ), '[]'::jsonb),
    'unread', (select count(*) from public.friend_messages m where m.sender = v_other and m.recipient = p_user and m.read_at is null)
  );
end;
$$;

-- Marks what the friend who goes by this handle wrote to `p_user` as read. Answers how many it marked (0 when nobody goes by it, or they are not friends).
create or replace function public.messages_read(p_user uuid, p_nickname text, p_tag integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other uuid := public.friend_target(p_nickname, p_tag);
  v_count integer;
begin
  if v_other is null or v_other = p_user then
    return 0;
  end if;
  if not exists (select 1 from public.friendships f where f.user_a = least(p_user, v_other) and f.user_b = greatest(p_user, v_other)) then
    return 0;
  end if;
  update public.friend_messages m set read_at = now() where m.sender = v_other and m.recipient = p_user and m.read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- The conversations of a member for the panel, the one with the latest message first, `p_limit` at the most: with each friend they have written to or got a message from (current friends only, no closed account), their nickname, tag and picture, how many of
-- theirs are not read yet and the last message `{last_text, last_at, last_mine}`.
create or replace function public.conversations_for(p_user uuid, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select case when m.sender = p_user then m.recipient else m.sender end as other, m.id, m.body, m.created_at, m.sender = p_user as is_mine, m.recipient = p_user and m.read_at is null as is_unread
    from public.friend_messages m
    where m.sender = p_user or m.recipient = p_user
  ),
  last as (
    select distinct on (other) other, body, created_at, is_mine from mine order by other, id desc
  ),
  unread as (
    select other, count(*) as n from mine where is_unread group by other
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'nickname', p.nickname, 'tag', p.tag, 'avatar_url', p.avatar_url, 'unread', coalesce(u.n, 0), 'last_text', l.body, 'last_at', l.created_at, 'last_mine', l.is_mine
  ) order by l.created_at desc, p.user_id), '[]'::jsonb)
  from (
    select l0.* from last l0
    where exists (select 1 from public.friendships f where f.user_a = least(p_user, l0.other) and f.user_b = greatest(p_user, l0.other))
    order by l0.created_at desc limit p_limit
  ) l
  join public.profiles p on p.user_id = l.other
  left join unread u on u.other = l.other
  where not exists (select 1 from public.account_deletions d where d.user_id = l.other)
$$;

-- Deletes the messages between two members when they stop being friends (a removal, or a block, which ends the friendship)
create or replace function public.messages_between_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friend_messages m where (m.sender = old.user_a and m.recipient = old.user_b) or (m.sender = old.user_b and m.recipient = old.user_a);
  return null;
end;
$$;

drop trigger if exists friend_messages_friendship_end on public.friendships;
create trigger friend_messages_friendship_end after delete on public.friendships for each row execute function public.messages_between_end();

revoke all on function public.message_send(uuid, text, integer, text, integer, integer) from public, anon, authenticated;
revoke all on function public.messages_with(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.messages_read(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.conversations_for(uuid, integer) from public, anon, authenticated;
revoke all on function public.messages_between_end() from public, anon, authenticated;
grant execute on function public.message_send(uuid, text, integer, text, integer, integer) to service_role;
grant execute on function public.messages_with(uuid, text, integer, integer) to service_role;
grant execute on function public.messages_read(uuid, text, integer) to service_role;
grant execute on function public.conversations_for(uuid, integer) to service_role;
