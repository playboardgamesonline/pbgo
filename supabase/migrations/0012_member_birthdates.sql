-- The date of birth a member declared, for the games and expansions that ask for an age (PLT-125). A declaration, never a proof: the member says it, once, and the server judges it.
-- It is not kept in the member's `user_metadata`, which they can rewrite from their browser: a check of the age has to trust a place they cannot write. This table is written and read by the server only (service role); the date reaches no
-- browser but its owner's, on their own settings page. One row per member, deleted with the account. Server only, like the tables of the games: row level security is on without policy.
create table if not exists public.member_birthdates (
  user_id uuid primary key references auth.users (id) on delete cascade,
  birthdate date not null,
  set_at timestamptz not null default now()
);

alter table public.member_birthdates enable row level security;

revoke all on table public.member_birthdates from anon, authenticated;
grant select, insert, update, delete on table public.member_birthdates to service_role;

-- Declares the date of birth of an account, once. It answers true when the date is kept and false when the account has one already, which is never replaced: a member who was refused a game for their age cannot declare another date to get in.
-- A date that makes the member younger than 13, the minimum age of the Terms of Use (`SITE_MINIMUM_AGE` of @pbgo/accounts), or that is in the future, is refused here as well as by the route: the Privacy Policy says the site keeps nothing of a child.
create or replace function public.set_member_birthdate(p_user uuid, p_birthdate date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kept integer;
begin
  if p_birthdate > current_date - interval '13 years' then
    raise exception 'invalid_birthdate' using errcode = '22023';
  end if;
  insert into public.member_birthdates (user_id, birthdate) values (p_user, p_birthdate) on conflict (user_id) do nothing;
  get diagnostics v_kept = row_count;
  return v_kept = 1;
end;
$$;

-- Server only (service role), like the tables: the function is not callable by the public roles
revoke all on function public.set_member_birthdate(uuid, date) from public, anon, authenticated;
grant execute on function public.set_member_birthdate(uuid, date) to service_role;
