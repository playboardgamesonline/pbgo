-- What a member says of themselves on their profile, beyond their name: the pronouns they go by, the country they are in, up to five favourite games and a short bio. Anybody who opens the profile sees what is filled in (`/player/<nickname>-<tag>`,
-- signed in or not), so none of it is private: the date of birth and the country that the age check reads stay where they are (the account's `pbgo_country`, `member_birthdates`), and a member who fills nothing in shows nothing.
--
-- Four columns of `profiles`, each empty by default and each checked by the table itself, whoever writes it:
--   - `pronouns`: one of a fixed list (a key, never free text; the words the pages show for each are the platform's), null when the member shows none;
--   - `country`: an ISO 3166-1 alpha-2 code in capitals. The shape is checked here and the list of countries by the server (`COUNTRY_CODES` of @pbgo/accounts), as for the account's own country;
--   - `favorite_games`: the slugs of up to five games of the hub's catalog, no slug twice, in the order the member put them (`valid_favorite_games`). Which slugs are games of the catalog is the server's to say (the catalog is the platform's Sanity project, not
--     a table): a game that leaves the catalog is skipped by the page that draws the covers, and the slug stays until the member changes the list;
--   - `bio`: plain text of 1 to 200 characters, with no control character but the line break, at most three of those, nothing around it. It is never HTML: the pages draw it as text, and a text that looks like HTML is only text.
--
-- `set_profile` stays the only writer, and it now takes what to change as one JSON object (`{"nickname": "Alex", "tag": 42, "bio": "…"}`): a key that is there is set (null clears pronouns, country, favourite games and bio), a key that is not is left as it is, so a client
-- that sends one field never rewrites the others, and a new field of the profile is one more key and not one more signature. One statement, so the unique index of the pair decides when two members ask for the same one at once. The three-argument `set_profile`
-- of 0015 is dropped: its only caller was the route, which now sends the object. `profile_by_handle` answers with the four fields (a function's result cannot change in place: it is dropped and made again, then its privileges are given again). A closed account and an
-- account that never signed in stay without a page, and the four columns go with the row when the account is deleted.

alter table public.profiles add column if not exists pronouns text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists favorite_games text[] not null default '{}';
alter table public.profiles add column if not exists bio text;

-- Whether a list is what `favorite_games` can hold: a one-dimensional list of at most five slugs (lowercase letters and digits, words joined by single dashes, 48 characters at most: a game's slug is 40 at most), none of them null, none twice.
-- Immutable, since it reads nothing but its argument, so that a check of the table can call it.
create or replace function public.valid_favorite_games(p_games text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_games is not null
    and coalesce(array_ndims(p_games), 1) = 1
    and cardinality(p_games) <= 5
    and not exists (select 1 from unnest(p_games) as g where g is null or char_length(g) > 48 or g !~ '^[a-z0-9]+(-[a-z0-9]+)*$')
    and (select count(distinct g) from unnest(p_games) as g) = cardinality(p_games)
$$;

alter table public.profiles drop constraint if exists profiles_pronouns_check;
alter table public.profiles add constraint profiles_pronouns_check check (pronouns is null or pronouns in ('he/him', 'she/her', 'they/them', 'he/they', 'she/they', 'any', 'ask'));

alter table public.profiles drop constraint if exists profiles_country_check;
alter table public.profiles add constraint profiles_country_check check (country is null or country ~ '^[A-Z]{2}$');

alter table public.profiles drop constraint if exists profiles_favorite_games_check;
alter table public.profiles add constraint profiles_favorite_games_check check (public.valid_favorite_games(favorite_games));

-- The bio: characters as a person counts them (an emoji is one), no control character but the line break (`\n`), not the two Unicode separators that browsers draw as a line break either (U+2028 and U+2029: they would get round the limit of three),
-- three line breaks at most, and nothing around it that a form would have trimmed
alter table public.profiles drop constraint if exists profiles_bio_check;
alter table public.profiles add constraint profiles_bio_check check (
  bio is null or (
    char_length(bio) between 1 and 200
    and bio = btrim(bio, E' \n')
    and bio !~ '[\x01-\x09\x0b-\x1f\x7f-\x9f\u2028\u2029]'
    and char_length(bio) - char_length(replace(bio, E'\n', '')) <= 3
  )
);

-- The page's lookup by handle, with the four fields. Same conditions as before: only an account that signed in has a page, and a closed account has none.
drop function if exists public.profile_by_handle(text, integer);
create function public.profile_by_handle(p_nickname text, p_tag integer)
returns table (user_id uuid, nickname text, tag integer, avatar_url text, hide_history boolean, created_at timestamptz, pronouns text, country text, favorite_games text[], bio text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.nickname, p.tag::integer, p.avatar_url, p.hide_history, p.created_at, p.pronouns, p.country, p.favorite_games, p.bio
  from public.profiles p
  where lower(p.nickname) = lower(p_nickname) and p.tag = p_tag
    and exists (select 1 from auth.users u where u.id = p.user_id and u.last_sign_in_at is not null)
    and not exists (select 1 from public.account_deletions d where d.user_id = p.user_id)
$$;

-- Changes what a member's profile says. `p_changes` is a JSON object whose keys are the fields to change, any of: `nickname` (a text that `clean_nickname` leaves as it is, which is not empty), `tag` (a whole number from 1 to 9999), `pronouns` (a key of the list or
-- null), `country` (two capital letters or null), `favorite_games` (a list of slugs, or null for none) and `bio` (a text or null). Anything else in it, a value of another kind, or nothing to change, is 'invalid'. Answers 'ok', 'taken' (somebody else has the pair: the case
-- of the nickname does not matter, and the member's own pair is never taken from them), 'invalid' (what is asked is not what a profile can hold: the checks of the table decide what each field can be) or 'missing' (the account has no profile). Everything is
-- changed in one statement or nothing is: a pair that is taken changes no pronoun either.
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
  v_has_nickname boolean;
  v_has_tag boolean;
  v_has_pronouns boolean;
  v_has_country boolean;
  v_has_games boolean;
  v_has_bio boolean;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    return 'invalid';
  end if;
  if exists (select 1 from jsonb_object_keys(p_changes) as k where k not in ('nickname', 'tag', 'pronouns', 'country', 'favorite_games', 'bio')) then
    return 'invalid';
  end if;
  v_has_nickname := p_changes ? 'nickname';
  v_has_tag := p_changes ? 'tag';
  v_has_pronouns := p_changes ? 'pronouns';
  v_has_country := p_changes ? 'country';
  v_has_games := p_changes ? 'favorite_games';
  v_has_bio := p_changes ? 'bio';

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

  begin
    update public.profiles p set
      nickname = case when v_has_nickname then v_nickname else p.nickname end,
      tag = case when v_has_tag then v_tag else p.tag end,
      pronouns = case when v_has_pronouns then v_pronouns else p.pronouns end,
      country = case when v_has_country then v_country else p.country end,
      favorite_games = case when v_has_games then v_games else p.favorite_games end,
      bio = case when v_has_bio then v_bio else p.bio end
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

-- The three-argument writer of 0015: the route that called it now sends the object
drop function if exists public.set_profile(uuid, text, integer);

-- Server only (service role), like the rest of the profiles: a function made again has the default privileges, which are given again here
revoke all on function public.valid_favorite_games(text[]) from public, anon, authenticated;
revoke all on function public.profile_by_handle(text, integer) from public, anon, authenticated;
revoke all on function public.set_profile(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.valid_favorite_games(text[]) to service_role;
grant execute on function public.profile_by_handle(text, integer) to service_role;
grant execute on function public.set_profile(uuid, jsonb) to service_role;
