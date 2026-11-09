-- Deleting an account (PLT-36). A member asks from their settings; an e-mail goes to the address of the account with a link (valid for an hour, usable once); the page it opens asks for a last confirmation; the account is then
-- ON HOLD for 30 days (`ACCOUNT_DELETION_GRACE_DAYS` of `core/lib/retention.ts`): signed out everywhere and treated as a visitor, its data untouched, and a member who signs in again is asked whether to keep it or to delete it now.
-- When the date has passed, the nightly clean-up (`core/server/retention.ts`) deletes it with what it holds. Everything that changes state is a function here, so that one transaction decides and the tests can run it end to end;
-- the server only hashes the token, sends the e-mail and calls them. All of them are server only (service role): row level security is on without policy, and no function is callable by the public roles.
--
-- `account_deletions` has a row for each account that asked: first AWAITING (the hash of the link's token and when it stops working: the token itself is only in the e-mail), then, once the link is confirmed, ON HOLD (the day the
-- account goes). The row goes with the account (`on delete cascade`) or when the member keeps it. The date is mirrored in the account's `app_metadata` (`pbgo_deletion_at`, which only the server can write) by the same function that
-- sets it, in the same transaction, so that every place that already holds the Auth user (the server, the browser's session, the proxy) knows the account is on hold without asking the database.

create table if not exists public.account_deletions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- AWAITING: the SHA-256 of the link's token (never the token) and when the link stops working
  token_hash text,
  token_expires_at timestamptz,
  -- When the link was last asked for, so that an address is not mailed more than once a minute
  requested_at timestamptz not null default now(),
  -- ON HOLD: the day the account is deleted, fixed when the link is confirmed (a later change of the 30 days does not move a promise already made)
  scheduled_for timestamptz,
  check ((token_hash is null) = (token_expires_at is null)),
  check ((token_hash is not null) <> (scheduled_for is not null))
);

create index if not exists account_deletions_scheduled_idx on public.account_deletions (scheduled_for) where scheduled_for is not null;
create index if not exists account_deletions_links_idx on public.account_deletions (token_expires_at) where token_hash is not null;

alter table public.account_deletions enable row level security;

revoke all on table public.account_deletions from anon, authenticated;
grant select, insert, update, delete on table public.account_deletions to service_role;

-- A link is asked for: the account awaits the confirmation of the token whose hash is given. Answers `sent` (the row is written: the server mails the link), `wait` (a link went less than `p_wait` ago), `on_hold` (the account
-- is on hold already) or `unknown` (no such account). A new link replaces the old one, which stops working.
create or replace function public.request_account_deletion(p_user uuid, p_token_hash text, p_expires timestamptz, p_wait interval default interval '1 minute')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.account_deletions;
  v_rows integer;
begin
  if p_token_hash is null or p_expires is null or p_expires <= now() then
    raise exception 'a link needs a token and an expiry in the future';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then
    return 'unknown';
  end if;

  select * into v_row from public.account_deletions d where d.user_id = p_user for update;
  if found then
    if v_row.scheduled_for is not null then
      return 'on_hold';
    end if;
    if v_row.requested_at > now() - p_wait then
      return 'wait';
    end if;
  end if;

  insert into public.account_deletions as d (user_id, token_hash, token_expires_at, requested_at)
  values (p_user, p_token_hash, p_expires, now())
  on conflict (user_id) do update
    set token_hash = excluded.token_hash, token_expires_at = excluded.token_expires_at, requested_at = excluded.requested_at, scheduled_for = null
    where d.scheduled_for is null;
  get diagnostics v_rows = row_count;
  return case when v_rows > 0 then 'sent' else 'on_hold' end;
end;
$$;

-- What the page of a link may show before anything is confirmed: the address of the account when the link is good (the token is the proof, so showing it hides nothing), else null. It changes nothing: a mail scanner that opens the
-- link spends nothing.
create or replace function public.peek_account_deletion(p_user uuid, p_token_hash text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text
  from public.account_deletions d
  join auth.users u on u.id = d.user_id
  where d.user_id = p_user and d.token_hash = p_token_hash and d.token_expires_at > now() and d.scheduled_for is null
$$;

-- The link is confirmed: the account goes ON HOLD until `p_scheduled`, the token is spent, every session of the account ends (the refresh tokens go with them: a token already issued works until it expires, but the Auth server
-- no longer knows its session) and the date is mirrored in the account's `app_metadata`. Answers the date, or null when the token is not the one awaited, has expired or was spent already.
create or replace function public.confirm_account_deletion(p_user uuid, p_token_hash text, p_scheduled timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_when timestamptz;
begin
  if p_scheduled is null or p_scheduled <= now() then
    raise exception 'a deletion is scheduled in the future';
  end if;

  update public.account_deletions d
  set token_hash = null, token_expires_at = null, scheduled_for = p_scheduled
  where d.user_id = p_user and d.scheduled_for is null and d.token_hash = p_token_hash and d.token_expires_at > now()
  returning d.scheduled_for into v_when;
  if v_when is null then
    return null;
  end if;

  update auth.users u
  set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('pbgo_deletion_at', to_char(v_when at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')), updated_at = now()
  where u.id = p_user;
  delete from auth.sessions s where s.user_id = p_user;
  return v_when;
end;
$$;

-- The member keeps their account (or the link is abandoned): the row and the mark go. Answers whether there was something to cancel.
create or replace function public.cancel_account_deletion(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  delete from public.account_deletions d where d.user_id = p_user;
  get diagnostics v_rows = row_count;
  update auth.users u
  set raw_app_meta_data = u.raw_app_meta_data - 'pbgo_deletion_at', updated_at = now()
  where u.id = p_user and u.raw_app_meta_data ->> 'pbgo_deletion_at' is not null;
  return v_rows > 0;
end;
$$;

-- The accounts whose day has passed, the oldest first, with the address their feedback was sent from: what the nightly clean-up works on. It changes nothing.
create or replace function public.due_account_deletions(p_before timestamptz, p_limit integer default 20)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.user_id, u.email::text
  from public.account_deletions d
  join auth.users u on u.id = d.user_id
  where d.scheduled_for <= p_before
  order by d.scheduled_for
  limit p_limit
$$;

-- Where a member sat, the table keeps the name and the picture address that were copied there (`games.players`) and which account held the seat (`games.member_ids`). When the account goes, the seat stays and the others still see
-- who played, as "Deleted player" (the words of `DELETED_PLAYER` in `packages/ui/src/tables.ts`), with no picture, and the link to the account is cut. Whatever the status of the table. Like `seat_member`, it changes neither `version`
-- nor `updated_at`: it is not a move, and it must not wake the clients up nor restart the clock of the table's retention. Answers how many tables it changed.
create or replace function public.scrub_member_from_tables(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with mine as (
    select g.game, g.code, array_agg(m.key) as seats
    from public.games g
    cross join lateral jsonb_each_text(g.member_ids) as m (key, value)
    where m.value = p_user::text
    group by g.game, g.code
  )
  update public.games g
  set players = case
        when jsonb_typeof(g.players) = 'array' then
          (select coalesce(jsonb_agg(case when e.p ->> 'id' = any (mine.seats) then (e.p - 'avatarUrl') || jsonb_build_object('nickname', 'Deleted player') else e.p end order by e.n), '[]'::jsonb)
           from jsonb_array_elements(g.players) with ordinality as e (p, n))
        else g.players
      end,
      member_ids = (select coalesce(jsonb_object_agg(k.key, k.value), '{}'::jsonb) from jsonb_each(g.member_ids) as k (key, value) where k.value <> to_jsonb(p_user::text))
  from mine
  where g.game = mine.game and g.code = mine.code;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Any deletion of an account, from the dashboard as much as from the nightly clean-up, scrubs the tables it sat at (the deletion of the games already played is `erase_member_from_results`, migration 0006)
create or replace function public.erase_member_from_tables()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.scrub_member_from_tables(old.id);
  return old;
end;
$$;

drop trigger if exists erase_member_from_tables on auth.users;
create trigger erase_member_from_tables before delete on auth.users for each row execute function public.erase_member_from_tables();

-- Deletes an account with what it holds, in one transaction: the lines of Supabase Auth's audit log about it (its id, or its address: they hold the address and the IP of its sign-ins when the project writes them to the database, which
-- the dashboard can switch off), then the account itself, whose deletion cascades to its identities, sessions, presence, totals, rank points and ratings, scrubs the tables it sat at and erases the name and picture of its seats in the
-- games played (the triggers). With `p_due_before`, only an account that is ON HOLD with a day that has passed, and the row is locked first: a member who keeps their account in that very moment either did it first (nothing is
-- found, nothing is deleted) or waits for this to finish. Without it, the account is deleted whatever its state ("Delete it now"). Answers whether an account was deleted.
create or replace function public.erase_account(p_user uuid, p_due_before timestamptz default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_rows integer;
begin
  if p_due_before is not null then
    perform 1 from public.account_deletions d where d.user_id = p_user and d.scheduled_for <= p_due_before for update;
    if not found then
      return false;
    end if;
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = p_user;
  delete from auth.audit_log_entries a
  where a.payload ->> 'actor_id' = p_user::text
     or a.payload -> 'traits' ->> 'user_id' = p_user::text
     or (v_email is not null and lower(a.payload ->> 'actor_username') = v_email);
  delete from auth.users u where u.id = p_user;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- The links that were never confirmed: the rows whose token stopped working before `p_before` go (an account that is ON HOLD is never touched). With `p_dry` nothing is deleted: it answers how many would be.
create or replace function public.purge_deletion_links(p_before timestamptz, p_dry boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_dry then
    select count(*) into v_count from public.account_deletions d where d.token_hash is not null and d.token_expires_at < p_before;
    return v_count;
  end if;
  delete from public.account_deletions d where d.token_hash is not null and d.token_expires_at < p_before;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Server only (service role), like the tables: none of these is callable by the public roles
revoke all on function public.request_account_deletion(uuid, text, timestamptz, interval) from public, anon, authenticated;
revoke all on function public.peek_account_deletion(uuid, text) from public, anon, authenticated;
revoke all on function public.confirm_account_deletion(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.cancel_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.due_account_deletions(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.scrub_member_from_tables(uuid) from public, anon, authenticated;
revoke all on function public.erase_member_from_tables() from public, anon, authenticated;
revoke all on function public.erase_account(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.purge_deletion_links(timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.request_account_deletion(uuid, text, timestamptz, interval) to service_role;
grant execute on function public.peek_account_deletion(uuid, text) to service_role;
grant execute on function public.confirm_account_deletion(uuid, text, timestamptz) to service_role;
grant execute on function public.cancel_account_deletion(uuid) to service_role;
grant execute on function public.due_account_deletions(timestamptz, integer) to service_role;
grant execute on function public.scrub_member_from_tables(uuid) to service_role;
grant execute on function public.erase_account(uuid, timestamptz) to service_role;
grant execute on function public.purge_deletion_links(timestamptz, boolean) to service_role;
