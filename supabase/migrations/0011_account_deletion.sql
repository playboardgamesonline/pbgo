-- Deleting an account (PLT-36), the way Spotify does it. The member deletes their account from their settings and it is CLOSED at once: every session of it ends and nobody can sign in to it. The site e-mails the address of the account a link
-- that REOPENS it, for `ACCOUNT_DELETION_GRACE_DAYS` days (`core/lib/retention.ts`). When the day has passed the link is dead and the nightly clean-up (`core/server/retention.ts`) deletes the account with what it holds. A member who follows the link
-- can also delete it right away. Every change of state is a function here, so that one transaction decides and the tests can run it end to end; the server only hashes the token, sends the e-mail and calls them. All of them are server only
-- (service role): row level security is on without policy, and no function is callable by the public roles.
--
-- A closed account is one with a row in `account_deletions`: the SHA-256 of the token of the link (never the token), when it was closed, the day it is deleted, and the ban it already had. "Nobody can sign in" is Supabase Auth's own ban
-- (`auth.users.banned_until`): the Auth server refuses a password, a provider, a code and a refresh token for a banned user, and any token already issued, at once (`user_banned`), so no other part of the site has to know about it. The ban is
-- set a hundred years ahead so that it holds even if the clean-up is late; the row's day is what the link and the clean-up go by.

create table if not exists public.account_deletions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- The SHA-256 of the token of the link that reopens the account: only the e-mail holds the token
  token_hash text not null,
  closed_at timestamptz not null default now(),
  -- The day the account is deleted for good: the link works until then
  scheduled_for timestamptz not null,
  -- The ban the account had before it was closed (none, unless it was banned for another reason), which reopening puts back
  previous_ban timestamptz,
  check (scheduled_for > closed_at)
);

create index if not exists account_deletions_scheduled_idx on public.account_deletions (scheduled_for);

alter table public.account_deletions enable row level security;

revoke all on table public.account_deletions from anon, authenticated;
grant select, insert, update, delete on table public.account_deletions to service_role;

-- The account is closed: the row, the ban, and every session of it ends (the refresh tokens go with them). `p_scheduled` is the day it is deleted, which the server computes and writes in the e-mail it sent first. Answers that day, or null when
-- there is no such account or it is closed already.
create or replace function public.close_account(p_user uuid, p_token_hash text, p_scheduled timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous timestamptz;
  v_rows integer;
begin
  if p_token_hash is null or p_scheduled is null or p_scheduled <= now() then
    raise exception 'a closed account needs a token and a day in the future';
  end if;

  select u.banned_until into v_previous from auth.users u where u.id = p_user for update;
  if not found then
    return null;
  end if;

  insert into public.account_deletions (user_id, token_hash, closed_at, scheduled_for, previous_ban)
  values (p_user, p_token_hash, now(), p_scheduled, v_previous)
  on conflict (user_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return null;
  end if;

  update auth.users u set banned_until = greatest(v_previous, p_scheduled + interval '100 years'), updated_at = now() where u.id = p_user;
  delete from auth.sessions s where s.user_id = p_user;
  return p_scheduled;
end;
$$;

-- What the page of the link may show before anything is done: the address of the account and the day it is deleted, when the link is the one of a closed account whose day has not come, else nothing. It changes nothing: a mail scanner that
-- opens the link spends nothing.
create or replace function public.peek_reopen_link(p_user uuid, p_token_hash text)
returns table (email text, scheduled_for timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text, d.scheduled_for
  from public.account_deletions d
  join auth.users u on u.id = d.user_id
  where d.user_id = p_user and d.token_hash = p_token_hash and d.scheduled_for > now()
$$;

-- The member follows the link: the account is open again, with the ban it had before (none, as a rule). Only the token of the link, and only before the day: after it the account cannot be reopened, even if the clean-up has not come yet.
-- Answers whether it was reopened.
create or replace function public.reopen_account(p_user uuid, p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous timestamptz;
begin
  delete from public.account_deletions d
  where d.user_id = p_user and d.token_hash = p_token_hash and d.scheduled_for > now()
  returning d.previous_ban into v_previous;
  if not found then
    return false;
  end if;
  update auth.users u set banned_until = v_previous, updated_at = now() where u.id = p_user;
  return true;
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
-- the dashboard can switch off), then the account itself, whose deletion cascades to its identities, sessions, presence, totals, rank points, ratings and its row here, scrubs the tables it sat at and erases the name and picture of its seats in
-- the games played (the triggers). With `p_due_before`, only an account that is closed with a day that has passed by then, and the row is locked first: a member who reopens their account in that very moment either did it first (nothing is
-- found, nothing is deleted) or waits for this to finish. Without it, the account is deleted whatever its state (the member followed the link and chose "Delete it now"). Answers whether an account was deleted.
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

-- Server only (service role), like the tables: none of these is callable by the public roles
revoke all on function public.close_account(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.peek_reopen_link(uuid, text) from public, anon, authenticated;
revoke all on function public.reopen_account(uuid, text) from public, anon, authenticated;
revoke all on function public.due_account_deletions(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.scrub_member_from_tables(uuid) from public, anon, authenticated;
revoke all on function public.erase_member_from_tables() from public, anon, authenticated;
revoke all on function public.erase_account(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.close_account(uuid, text, timestamptz) to service_role;
grant execute on function public.peek_reopen_link(uuid, text) to service_role;
grant execute on function public.reopen_account(uuid, text) to service_role;
grant execute on function public.due_account_deletions(timestamptz, integer) to service_role;
grant execute on function public.scrub_member_from_tables(uuid) to service_role;
grant execute on function public.erase_account(uuid, timestamptz) to service_role;
