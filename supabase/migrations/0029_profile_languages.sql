-- The languages a member speaks, on their profile: the platform's own languages, English once (`SPOKEN_LANGUAGES` of `@pbgo/accounts/language`: the ones a table asks its players to speak), picked by the member and shown as chips under their bio to every visitor of the
-- profile, signed in or not, like the rest of what a member says of themselves (0018), so none of it is private. A member who picks none shows none.
--
-- `languages` is a list of codes in the order the member put them, none twice, none null, at most 40 (`valid_spoken_languages`), each of two or three lowercase letters (`fr`, `en`, `zh`). Which codes are languages of the platform is the server's to say (the list grows with the platform
-- and the table is not edited for each language that it adds): a code that leaves the list is skipped by the page that draws the chips, and stays until the member changes the list. The check is the shape, as for the country (0018).
--
-- `set_profile` takes one more key, `languages` (a list of texts, or null to clear it: the member speaks none), and `profile_by_handle` answers with the column (a function's result cannot change in place: it is dropped and made again, then its privileges are given again). Both are
-- as 0028 left them: no favourite games, and the key still left out whatever it holds. A server that has not caught up with this migration, and sends no `languages`, changes the rest of the profile as before. Every statement can run again.

alter table public.profiles add column if not exists languages text[] not null default '{}';

-- Whether a list is what `languages` can hold: a one-dimensional list of at most 40 codes (two or three lowercase letters), none of them null, none twice. Immutable, since it reads nothing but its argument, so that a check of the table can call it.
create or replace function public.valid_spoken_languages(p_languages text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_languages is not null
    and coalesce(array_ndims(p_languages), 1) = 1
    and cardinality(p_languages) <= 40
    and not exists (select 1 from unnest(p_languages) as l where l is null or l !~ '^[a-z]{2,3}$')
    and (select count(distinct l) from unnest(p_languages) as l) = cardinality(p_languages)
$$;

alter table public.profiles drop constraint if exists profiles_languages_check;
alter table public.profiles add constraint profiles_languages_check check (public.valid_spoken_languages(languages));

-- The lookup of the page, as in 0028 with the column: only an account that signed in has a page, and a closed account has none
drop function if exists public.profile_by_handle(text, integer);
create function public.profile_by_handle(p_nickname text, p_tag integer)
returns table (user_id uuid, nickname text, tag integer, avatar_url text, hide_history boolean, created_at timestamptz, pronouns text, country text, bio text, city_name text, city_country text, languages text[])
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.nickname, p.tag::integer, p.avatar_url, p.hide_history, p.created_at, p.pronouns, p.country, p.bio, p.city_name, p.city_country, p.languages
  from public.profiles p
  where lower(p.nickname) = lower(p_nickname) and p.tag = p_tag
    and exists (select 1 from auth.users u where u.id = p.user_id and u.last_sign_in_at is not null)
    and not exists (select 1 from public.account_deletions d where d.user_id = p.user_id)
$$;

-- As in 0028, with the languages
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
  v_languages text[];
  v_city_name text;
  v_city_country text;
  v_has_nickname boolean;
  v_has_tag boolean;
  v_has_pronouns boolean;
  v_has_country boolean;
  v_has_bio boolean;
  v_has_languages boolean;
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
  if exists (select 1 from jsonb_object_keys(p_changes) as k where k not in ('nickname', 'tag', 'pronouns', 'country', 'bio', 'city', 'languages')) then
    return 'invalid';
  end if;
  v_has_nickname := p_changes ? 'nickname';
  v_has_tag := p_changes ? 'tag';
  v_has_pronouns := p_changes ? 'pronouns';
  v_has_country := p_changes ? 'country';
  v_has_bio := p_changes ? 'bio';
  v_has_city := p_changes ? 'city';
  v_has_languages := p_changes ? 'languages';

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
  if v_has_languages then
    if jsonb_typeof(p_changes -> 'languages') = 'null' then
      v_languages := '{}';
    elsif jsonb_typeof(p_changes -> 'languages') <> 'array' or exists (select 1 from jsonb_array_elements(p_changes -> 'languages') as e where jsonb_typeof(e) <> 'string') then
      return 'invalid';
    else
      v_languages := array(select e.value from jsonb_array_elements_text(p_changes -> 'languages') with ordinality as e (value, n) order by e.n);
    end if;
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
      city_country = case when v_has_city then v_city_country else p.city_country end,
      languages = case when v_has_languages then v_languages else p.languages end
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
revoke all on function public.valid_spoken_languages(text[]) from public, anon, authenticated;
grant execute on function public.profile_by_handle(text, integer) to service_role;
grant execute on function public.set_profile(uuid, jsonb) to service_role;
