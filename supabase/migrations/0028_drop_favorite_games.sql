-- A profile has no favourite games that its member picks any more (0018): the page shows the games they played the most, worked out from the games played, so there is nothing to keep for it. The column `profiles.favorite_games` is dropped with its check
-- (`profiles_favorite_games_check`) and the function behind the check (`valid_favorite_games`); the lists that members had picked go with it, and a profile says nothing else of them.
-- `profile_by_handle` answers without the column (a function's result cannot change in place: it is dropped and made again, then its privileges are given again). `set_profile` takes the key `favorite_games` out of what it is asked to change, whatever it holds, so that a
-- server that has not caught up with this migration yet (a deployment that lands a few minutes after it) and still sends it changes the rest of the profile as before; a change with nothing else in it asks for nothing and is invalid, as an empty one is. A later migration
-- can refuse the key again once no server sends it.
-- Every statement can run again.

-- The lookup of the page first, so that nothing that is left reads the column. Same conditions as in 0021: only an account that signed in has a page, and a closed account has none.
drop function if exists public.profile_by_handle(text, integer);
create function public.profile_by_handle(p_nickname text, p_tag integer)
returns table (user_id uuid, nickname text, tag integer, avatar_url text, hide_history boolean, created_at timestamptz, pronouns text, country text, bio text, city_name text, city_country text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.nickname, p.tag::integer, p.avatar_url, p.hide_history, p.created_at, p.pronouns, p.country, p.bio, p.city_name, p.city_country
  from public.profiles p
  where lower(p.nickname) = lower(p_nickname) and p.tag = p_tag
    and exists (select 1 from auth.users u where u.id = p.user_id and u.last_sign_in_at is not null)
    and not exists (select 1 from public.account_deletions d where d.user_id = p.user_id)
$$;

-- The column with its check, then the function the check called
alter table public.profiles drop constraint if exists profiles_favorite_games_check;
alter table public.profiles drop column if exists favorite_games;
drop function if exists public.valid_favorite_games(text[]);

-- As in 0021, without the favourite games
create or replace function public.set_profile(p_user uuid, p_changes jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text;
  v_tag integer;
  v_pronouns text;
  v_country text;
  v_bio text;
  v_city_name text;
  v_city_country text;
  v_has_nickname boolean;
  v_has_tag boolean;
  v_has_pronouns boolean;
  v_has_country boolean;
  v_has_bio boolean;
  v_has_city boolean;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    return 'invalid';
  end if;
  -- The favourite games are not a field of a profile any more: the key is left out whatever it holds, and what is left is judged as it always was
  p_changes := p_changes - 'favorite_games';
  if p_changes = '{}'::jsonb then
    return 'invalid';
  end if;
  if exists (select 1 from jsonb_object_keys(p_changes) as k where k not in ('nickname', 'tag', 'pronouns', 'country', 'bio', 'city')) then
    return 'invalid';
  end if;
  v_has_nickname := p_changes ? 'nickname';
  v_has_tag := p_changes ? 'tag';
  v_has_pronouns := p_changes ? 'pronouns';
  v_has_country := p_changes ? 'country';
  v_has_bio := p_changes ? 'bio';
  v_has_city := p_changes ? 'city';

  if v_has_nickname then
    if jsonb_typeof(p_changes -> 'nickname') <> 'string' then
      return 'invalid';
    end if;
    v_nickname := p_changes ->> 'nickname';
    if v_nickname = '' or v_nickname <> public.clean_nickname(v_nickname) then
      return 'invalid';
    end if;
  end if;
  if v_has_tag then
    if jsonb_typeof(p_changes -> 'tag') <> 'number' or (p_changes ->> 'tag') !~ '^[0-9]{1,4}$' then
      return 'invalid';
    end if;
    v_tag := (p_changes ->> 'tag')::integer;
    if v_tag not between 1 and 9999 then
      return 'invalid';
    end if;
  end if;
  if v_has_pronouns then
    if jsonb_typeof(p_changes -> 'pronouns') not in ('string', 'null') then
      return 'invalid';
    end if;
    v_pronouns := p_changes ->> 'pronouns';
  end if;
  if v_has_country then
    if jsonb_typeof(p_changes -> 'country') not in ('string', 'null') then
      return 'invalid';
    end if;
    v_country := p_changes ->> 'country';
  end if;
  if v_has_bio then
    if jsonb_typeof(p_changes -> 'bio') not in ('string', 'null') then
      return 'invalid';
    end if;
    v_bio := p_changes ->> 'bio';
  end if;
  if v_has_city and jsonb_typeof(p_changes -> 'city') <> 'null' then
    -- An object with its two keys and no other, both texts: the table judges the rest
    if jsonb_typeof(p_changes -> 'city') <> 'object'
       or not (p_changes -> 'city' ?& array['name', 'country'])
       or exists (select 1 from jsonb_object_keys(p_changes -> 'city') as k where k not in ('name', 'country'))
       or jsonb_typeof(p_changes -> 'city' -> 'name') <> 'string'
       or jsonb_typeof(p_changes -> 'city' -> 'country') <> 'string' then
      return 'invalid';
    end if;
    v_city_name := p_changes -> 'city' ->> 'name';
    v_city_country := p_changes -> 'city' ->> 'country';
  end if;

  begin
    update public.profiles p set
      nickname = case when v_has_nickname then v_nickname else p.nickname end,
      tag = case when v_has_tag then v_tag else p.tag end,
      pronouns = case when v_has_pronouns then v_pronouns else p.pronouns end,
      country = case when v_has_country then v_country else p.country end,
      bio = case when v_has_bio then v_bio else p.bio end,
      city_name = case when v_has_city then v_city_name else p.city_name end,
      city_country = case when v_has_city then v_city_country else p.city_country end
    where p.user_id = p_user;
    if not found then
      return 'missing';
    end if;
    return 'ok';
  exception
    when unique_violation then
      return 'taken';
    when check_violation then
      return 'invalid';
  end;
end;
$$;

revoke all on function public.profile_by_handle(text, integer) from public, anon, authenticated;
revoke all on function public.set_profile(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.profile_by_handle(text, integer) to service_role;
grant execute on function public.set_profile(uuid, jsonb) to service_role;
