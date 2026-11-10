-- The profile of a member (PLT-39, PLT-111): who they are to the other players. A nickname with a tag, `Alex#0042`, that is theirs and nobody else's, the picture of their provider, when they joined, and whether they hide their games. It is what a profile page,
-- a seat at a table, a leaderboard row and, later, a friend's card are made of. Until now a member was only a Supabase Auth user whose name lived in `user_metadata`, which the member can rewrite and the others cannot read.
--
-- The tag is four digits, 1 to 9999 (0 is what the pages call "no tag", a guest), given at random when the profile is made and the member's to change afterwards. A nickname and a tag are unique together, whatever the case of the nickname: `Alex#0042`
-- and `alex#0042` cannot both exist, while `Alex#0042` and `Alex#0043` can. A member who changes their nickname or their tag takes the old pair off, which is free again. The nickname is at most 20 characters, with no `#`, `/` or `\` (they would
-- break the way a profile is written, `Alex#0042`, and its address, `/player/Alex-0042`) and no control character, spaces collapsed (`clean_nickname`, which does what `cleanDisplayName` of @pbgo/accounts does).
--
-- A profile is made by the database itself, whatever way the account came in (a provider, an e-mail address, the hub's own Steam sign-in, the dashboard), by a trigger on `auth.users`, so that no member is ever without one and no code has to remember
-- it. The nickname it starts with is the one `accountOf` of @pbgo/accounts would show: the name the member chose, else the one their provider gives, else the start of their e-mail address, else "Player". From then on the nickname and the tag are the
-- profile's: `set_profile` is the one way to change them (the route `POST /api/hub/profile` calls it), and `user_metadata.pbgo_nickname` is only a copy the browser keeps for the navbar. The picture and the choice to hide the games are not: they follow the
-- account (the provider writes a new picture at every sign-in, the member's choice `pbgo_hide_history` is a key of the account), by a second trigger, so a profile is never out of step with them.
--
-- Written and read by the server only (service role), like the other tables: row level security is on without policy, and no function is callable by the public roles. One row per account, deleted with it (the pair is free again, and what a table
-- kept of the seat goes with `scrub_member_from_tables`, which this migration teaches to take the tag off too).

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  tag smallint not null,
  -- The picture the provider gives: an `https` address of a sensible length, as the seats keep them
  avatar_url text,
  -- The member's choice (`pbgo_hide_history`): their profile shows no games, no records and no ranks to the others
  hide_history boolean not null default false,
  -- When the account was made: "member since"
  created_at timestamptz not null default now(),
  constraint profiles_nickname_check check (char_length(nickname) between 1 and 20 and nickname = btrim(nickname) and nickname !~ '[#/\\[:cntrl:]]'),
  constraint profiles_tag_check check (tag between 1 and 9999),
  constraint profiles_avatar_url_check check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 2048))
);

-- One nickname and tag per member, whatever the case of the nickname. It is also how a profile is found by its address.
create unique index if not exists profiles_handle_idx on public.profiles (lower(nickname), tag);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

-- A nickname as a profile keeps it: no control character, none of `#`, `/` and `\`, one space between words, trimmed, 20 characters at most (and trimmed again if the cut falls after a space). Nothing is left for a text that was only those.
create or replace function public.clean_nickname(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(left(btrim(regexp_replace(regexp_replace(coalesce(p_text, ''), '[#/\\[:cntrl:]]', '', 'g'), '\s+', ' ', 'g')), 20))
$$;

-- The nickname an account starts with, from what Supabase Auth keeps of it: the name the member chose (`pbgo_nickname`), else Discord's chosen name (`custom_claims.global_name`), else `full_name`, `name`, `user_name`, else the start of the e-mail
-- address (not the one that stands in for none for an account of Steam's), else "Player": the order `accountOf` of @pbgo/accounts reads them in.
create or replace function public.profile_nickname_of(p_meta jsonb, p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(public.clean_nickname(p_meta ->> 'pbgo_nickname'), ''),
    nullif(public.clean_nickname(p_meta -> 'custom_claims' ->> 'global_name'), ''),
    nullif(public.clean_nickname(p_meta ->> 'full_name'), ''),
    nullif(public.clean_nickname(p_meta ->> 'name'), ''),
    nullif(public.clean_nickname(p_meta ->> 'user_name'), ''),
    case when p_email is not null and p_email !~* '@external\.pbgo\.invalid$' then nullif(public.clean_nickname(split_part(p_email, '@', 1)), '') end,
    'Player'
  )
$$;

-- The picture an account has from its provider (`avatar_url`, else `picture`), when it is an `https` address of a sensible length; null otherwise
create or replace function public.profile_picture_of(p_meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when s.c ~ '^https://' and char_length(s.c) <= 2048 then s.c end
  from (select coalesce(nullif(btrim(p_meta ->> 'avatar_url'), ''), nullif(btrim(p_meta ->> 'picture'), '')) as c) s
$$;

-- A tag that nobody has with this nickname (whatever its case), at random: a few tries at chance first, then one of the free ones, and null when all of them are taken. `p_max` is only there for the test to shrink the room (never above 9999).
create or replace function public.free_tag(p_nickname text, p_max integer default 9999)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_max integer := least(greatest(coalesce(p_max, 9999), 1), 9999);
  v_tag integer;
  v_try integer := 0;
begin
  while v_try < 12 loop
    v_tag := 1 + floor(random() * v_max)::integer;
    if not exists (select 1 from public.profiles p where lower(p.nickname) = lower(p_nickname) and p.tag = v_tag) then
      return v_tag;
    end if;
    v_try := v_try + 1;
  end loop;
  select t.n into v_tag
  from generate_series(1, v_max) as t (n)
  where not exists (select 1 from public.profiles p where lower(p.nickname) = lower(p_nickname) and p.tag = t.n)
  order by random()
  limit 1;
  return v_tag;
end;
$$;

-- Makes the profile of an account, with a tag at random that nobody has with its nickname. Answers whether it was made: false when the account has one already (nothing changes), or when every tag of the nickname is taken. A nickname that cleans
-- down to nothing is "Player". It is idempotent, so the trigger, the backfill below and the healing of a missing profile all call it.
create or replace function public.make_profile(p_user uuid, p_nickname text, p_avatar_url text default null, p_hide_history boolean default false, p_created_at timestamptz default now())
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text := coalesce(nullif(public.clean_nickname(p_nickname), ''), 'Player');
  v_tag integer;
  v_try integer := 0;
begin
  if exists (select 1 from public.profiles p where p.user_id = p_user) then
    return false;
  end if;
  while v_try < 5 loop
    v_tag := public.free_tag(v_nickname);
    exit when v_tag is null;
    begin
      insert into public.profiles (user_id, nickname, tag, avatar_url, hide_history, created_at)
      values (p_user, v_nickname, v_tag, p_avatar_url, coalesce(p_hide_history, false), coalesce(p_created_at, now()));
      return true;
    exception when unique_violation then
      -- The same tag was taken between the choice and the insert, or this account got its profile in that very moment: look again
      if exists (select 1 from public.profiles p where p.user_id = p_user) then
        return false;
      end if;
      v_try := v_try + 1;
    end;
  end loop;
  return false;
end;
$$;

-- A new account has a profile. It never stops the account from being made: whatever goes wrong is a warning, and the profile is made the next time the account is touched (`profile_follow_user`). An anonymous user has none.
create or replace function public.profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  begin
    perform public.make_profile(
      new.id,
      public.profile_nickname_of(new.raw_user_meta_data, new.email::text),
      public.profile_picture_of(new.raw_user_meta_data),
      coalesce(new.raw_user_meta_data -> 'pbgo_hide_history' = 'true'::jsonb, false),
      new.created_at
    );
  exception when others then
    raise warning 'the profile of account % could not be made: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- The picture and the choice to hide the games follow the account: a provider writes a new picture at every sign-in and the member's choice is a key of their account, so the profile is read from them each time they change. The nickname and the tag
-- do not follow: they are the profile's (`set_profile`). An account that has no profile (the trigger above failed, or it was made before this migration and the backfill missed it) gets one here. Never stops an update of the account.
create or replace function public.profile_follow_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avatar text := public.profile_picture_of(new.raw_user_meta_data);
  v_hide boolean := coalesce(new.raw_user_meta_data -> 'pbgo_hide_history' = 'true'::jsonb, false);
begin
  if coalesce(new.is_anonymous, false) or new.raw_user_meta_data is not distinct from old.raw_user_meta_data then
    return new;
  end if;
  begin
    perform public.make_profile(new.id, public.profile_nickname_of(new.raw_user_meta_data, new.email::text), v_avatar, v_hide, new.created_at);
    update public.profiles p set avatar_url = v_avatar, hide_history = v_hide
    where p.user_id = new.id and (p.avatar_url is distinct from v_avatar or p.hide_history is distinct from v_hide);
  exception when others then
    raise warning 'the profile of account % could not be kept up to date: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists profile_for_new_user on auth.users;
create trigger profile_for_new_user after insert on auth.users for each row execute function public.profile_for_new_user();

drop trigger if exists profile_follow_user on auth.users;
create trigger profile_follow_user after update of raw_user_meta_data on auth.users for each row execute function public.profile_follow_user();

-- The accounts that exist already get their profile, each with a tag at random. Safe to run again: an account that has one is left as it is.
do $backfill$
declare
  u record;
begin
  for u in
    select a.id, a.email::text as email, a.raw_user_meta_data as meta, a.created_at
    from auth.users a
    where a.deleted_at is null and coalesce(a.is_anonymous, false) = false
    order by a.created_at, a.id
  loop
    perform public.make_profile(u.id, public.profile_nickname_of(u.meta, u.email), public.profile_picture_of(u.meta), coalesce(u.meta -> 'pbgo_hide_history' = 'true'::jsonb, false), u.created_at);
  end loop;
end;
$backfill$;

-- The member with this nickname and tag (the case of the nickname does not matter), for the page of a profile. Only an account that has signed in at least once has a page (`last_sign_in_at`): anybody can start a sign-up with any name, and an account
-- that was never confirmed would otherwise have a public page that nobody can sign in to take down. An account that is closed (`account_deletions`, PLT-36: the member asked to delete it and has a week to change their mind) has no profile to anyone
-- either: nothing is found. It changes nothing.
create or replace function public.profile_by_handle(p_nickname text, p_tag integer)
returns table (user_id uuid, nickname text, tag integer, avatar_url text, hide_history boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.nickname, p.tag::integer, p.avatar_url, p.hide_history, p.created_at
  from public.profiles p
  where lower(p.nickname) = lower(p_nickname) and p.tag = p_tag
    and exists (select 1 from auth.users u where u.id = p.user_id and u.last_sign_in_at is not null)
    and not exists (select 1 from public.account_deletions d where d.user_id = p.user_id)
$$;

-- Changes the nickname and the tag of a member. Answers 'ok', 'taken' (somebody else has the pair: the case of the nickname does not matter, and the member's own pair is never taken from them), 'invalid' (a nickname that is not
-- what `clean_nickname` makes of it, which includes one that is empty or longer than 20 characters, or a tag that is not 1 to 9999) or 'missing' (the account has no profile). One statement, so the unique index decides when two members ask for the same pair at once.
create or replace function public.set_profile(p_user uuid, p_nickname text, p_tag integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_nickname is null or p_nickname = '' or p_nickname <> public.clean_nickname(p_nickname) or p_tag is null or p_tag not between 1 and 9999 then
    return 'invalid';
  end if;
  begin
    update public.profiles p set nickname = p_nickname, tag = p_tag where p.user_id = p_user;
    if not found then
      return 'missing';
    end if;
    return 'ok';
  exception when unique_violation then
    return 'taken';
  end;
end;
$$;

-- The seats of a table that a deleted account held: as in 0011, plus the tag, which would otherwise keep the pair the account had on the table
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
          (select coalesce(jsonb_agg(case when e.p ->> 'id' = any (mine.seats) then (e.p - 'avatarUrl' - 'tag') || jsonb_build_object('nickname', 'Deleted player') else e.p end order by e.n), '[]'::jsonb)
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

-- The games a player finished in a game, as in 0009, with the account of each opponent as well (`userId`, null for a guest and for an account that is gone), so that the server can say who they are now (`profiles`) and link to them. The server never
-- sends the account to the browser.
create or replace function public.player_history(p_user uuid, p_game text, p_limit integer default 10)
returns table (id uuid, finished_at timestamptz, outcome text, place integer, score integer, player_count integer, duration_s integer, options jsonb, points integer, opponents jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select
    gr.id,
    gr.finished_at,
    gp.outcome,
    gp.rank::integer,
    gp.score,
    gr.player_count::integer,
    gr.duration_s,
    gr.options,
    rc.points_after - rc.points_before,
    coalesce((select jsonb_agg(jsonb_build_object('name', o.display_name, 'avatarUrl', o.avatar_url, 'userId', o.user_id) order by o.seat) from public.game_participants o where o.game_result_id = gr.id and o.seat <> gp.seat), '[]'::jsonb)
  from public.game_participants gp
  join public.game_results gr on gr.id = gp.game_result_id
  left join public.rating_changes rc on rc.game_result_id = gr.id and rc.user_id = p_user
  where gp.user_id = p_user and gr.game = p_game
  order by gr.finished_at desc
  limit p_limit;
$$;

-- Server only (service role), like the tables: none of these is callable by the public roles
revoke all on function public.clean_nickname(text) from public, anon, authenticated;
revoke all on function public.profile_nickname_of(jsonb, text) from public, anon, authenticated;
revoke all on function public.profile_picture_of(jsonb) from public, anon, authenticated;
revoke all on function public.free_tag(text, integer) from public, anon, authenticated;
revoke all on function public.make_profile(uuid, text, text, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.profile_for_new_user() from public, anon, authenticated;
revoke all on function public.profile_follow_user() from public, anon, authenticated;
revoke all on function public.profile_by_handle(text, integer) from public, anon, authenticated;
revoke all on function public.set_profile(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.player_history(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.clean_nickname(text) to service_role;
grant execute on function public.profile_nickname_of(jsonb, text) to service_role;
grant execute on function public.profile_picture_of(jsonb) to service_role;
grant execute on function public.free_tag(text, integer) to service_role;
grant execute on function public.make_profile(uuid, text, text, boolean, timestamptz) to service_role;
grant execute on function public.profile_by_handle(text, integer) to service_role;
grant execute on function public.set_profile(uuid, text, integer) to service_role;
grant execute on function public.player_history(uuid, text, integer) to service_role;
