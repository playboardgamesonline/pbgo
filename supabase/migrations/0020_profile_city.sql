-- The city a member says they live in, on their profile (PLT-139), shown to every visitor like the other things a profile says (0018). It is never free text: the server only takes a city of the list that ships with the site (`@pbgo/cities`, the places of 5000 inhabitants and more
-- from GeoNames), looked up by its GeoNames number, so a profile never holds a place that nobody checked, and what a member typed to find it never left the site.
--
-- Three columns of `profiles`, empty by default and checked together by the table:
--   - `city_id`: the GeoNames number of the city (a whole number, 1 and up);
--   - `city_name`: its name as the list writes it (1 to 100 characters, nothing around it, no control character), so that the page needs no list to say it;
--   - `city_country`: its country, two capital letters, which has to be the profile's own `country` (`profiles_city_check`): a city comes with its country, so the profile shows "Lyon, France" and never a city in another country than the profile says. A member
--     who changes their country takes the city away in the same change, and a profile that has a city has a country.
-- The three are all set or all empty. Which city a number is, and whether it is on the list, is the server's to say; the table keeps the shape.
--
-- `set_profile(uuid, jsonb)` takes a new key, `city`: an object `{"id": 2996944, "name": "Lyon", "country": "FR"}`, or null to take the city away; like the other keys it is left alone when missing, and everything is changed in one statement or nothing is.
-- `profile_by_handle` answers with the three columns (a function's result cannot change in place: it is dropped and made again, then its privileges are given again). A closed account stays without a page, and the columns go with the row.

alter table public.profiles add column if not exists city_id integer;
alter table public.profiles add column if not exists city_name text;
alter table public.profiles add column if not exists city_country text;

alter table public.profiles drop constraint if exists profiles_city_check;
alter table public.profiles add constraint profiles_city_check check (
  (city_id is null and city_name is null and city_country is null)
  or (
    city_id is not null and city_id > 0
    and city_name is not null and char_length(city_name) between 1 and 100 and city_name = btrim(city_name) and city_name !~ '[\x01-\x1f\x7f-\x9f\u2028\u2029]'
    and city_country is not null and city_country ~ '^[A-Z]{2}$'
    and country is not null and city_country = country
  )
);

drop function if exists public.profile_by_handle(text, integer);
create function public.profile_by_handle(p_nickname text, p_tag integer)
returns table (user_id uuid, nickname text, tag integer, avatar_url text, hide_history boolean, created_at timestamptz, pronouns text, country text, favorite_games text[], bio text, city_id integer, city_name text, city_country text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.nickname, p.tag::integer, p.avatar_url, p.hide_history, p.created_at, p.pronouns, p.country, p.favorite_games, p.bio, p.city_id, p.city_name, p.city_country
  from public.profiles p
  where lower(p.nickname) = lower(p_nickname) and p.tag = p_tag
    and exists (select 1 from auth.users u where u.id = p.user_id and u.last_sign_in_at is not null)
    and not exists (select 1 from public.account_deletions d where d.user_id = p.user_id)
$$;

-- As in 0018, with the `city` key
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
  v_games text[];
  v_bio text;
  v_city_id integer;
  v_city_name text;
  v_city_country text;
  v_has_nickname boolean;
  v_has_tag boolean;
  v_has_pronouns boolean;
  v_has_country boolean;
  v_has_games boolean;
  v_has_bio boolean;
  v_has_city boolean;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    return 'invalid';
  end if;
  if exists (select 1 from jsonb_object_keys(p_changes) as k where k not in ('nickname', 'tag', 'pronouns', 'country', 'favorite_games', 'bio', 'city')) then
    return 'invalid';
  end if;
  v_has_nickname := p_changes ? 'nickname';
  v_has_tag := p_changes ? 'tag';
  v_has_pronouns := p_changes ? 'pronouns';
  v_has_country := p_changes ? 'country';
  v_has_games := p_changes ? 'favorite_games';
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
  if v_has_games then
    if jsonb_typeof(p_changes -> 'favorite_games') = 'null' then
      v_games := '{}';
    elsif jsonb_typeof(p_changes -> 'favorite_games') <> 'array' or exists (select 1 from jsonb_array_elements(p_changes -> 'favorite_games') as e where jsonb_typeof(e) <> 'string') then
      return 'invalid';
    else
      v_games := array(select e.value from jsonb_array_elements_text(p_changes -> 'favorite_games') with ordinality as e (value, n) order by e.n);
    end if;
  end if;
  if v_has_bio then
    if jsonb_typeof(p_changes -> 'bio') not in ('string', 'null') then
      return 'invalid';
    end if;
    v_bio := p_changes ->> 'bio';
  end if;
  if v_has_city and jsonb_typeof(p_changes -> 'city') <> 'null' then
    -- An object with its three keys and no other, of the kinds the table keeps: the table judges the rest
    if jsonb_typeof(p_changes -> 'city') <> 'object'
       or not (p_changes -> 'city' ?& array['id', 'name', 'country'])
       or exists (select 1 from jsonb_object_keys(p_changes -> 'city') as k where k not in ('id', 'name', 'country'))
       or jsonb_typeof(p_changes -> 'city' -> 'id') <> 'number'
       or jsonb_typeof(p_changes -> 'city' -> 'name') <> 'string'
       or jsonb_typeof(p_changes -> 'city' -> 'country') <> 'string'
       or (p_changes -> 'city' ->> 'id') !~ '^[0-9]{1,9}$' then
      return 'invalid';
    end if;
    v_city_id := (p_changes -> 'city' ->> 'id')::integer;
    v_city_name := p_changes -> 'city' ->> 'name';
    v_city_country := p_changes -> 'city' ->> 'country';
  end if;

  begin
    update public.profiles p set
      nickname = case when v_has_nickname then v_nickname else p.nickname end,
      tag = case when v_has_tag then v_tag else p.tag end,
      pronouns = case when v_has_pronouns then v_pronouns else p.pronouns end,
      country = case when v_has_country then v_country else p.country end,
      favorite_games = case when v_has_games then v_games else p.favorite_games end,
      bio = case when v_has_bio then v_bio else p.bio end,
      city_id = case when v_has_city then v_city_id else p.city_id end,
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
