-- The languages a member speaks, end to end (migration 0028): the column and what the table accepts and refuses of it whoever writes it, what `set_profile` takes (a list of texts, or null to clear it, one field or with others), the order the member put them in, the lookup of a page, and who may call what.
--
-- Run it on `pbgo-preview` once the migrations are applied (the Supabase MCP's `execute_sql`, or the SQL editor). It is one `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled back with the block, and the message is the answer. Every check prints `ok` or `FAIL` with what it saw;
-- read the whole line. Never on production. It makes two fixture rows in `auth.users` that the rollback takes back: it creates no account that stays.

DO $do$
declare
  ua uuid := '00000000-0000-4000-8000-0000000000f1';
  ub uuid := '00000000-0000-4000-8000-0000000000f2';
  t0 timestamptz := '2026-11-01 10:00:00+00';
  r text := '';
  answer text;
  tag_a integer;
begin
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;
  -- Whether a statement is refused with this state (23514 a check)
  create function pg_temp.refused_with(p_sql text, p_state text) returns boolean language plpgsql as $f$
  begin
    execute p_sql;
    return false;
  exception when others then
    return sqlstate = p_state;
  end
  $f$;
  -- What `set_profile` says of a change given as text (a JSON object)
  create function pg_temp.change(p_user uuid, p_json text) returns text language sql as $f$
    select public.set_profile(p_user, p_json::jsonb)
  $f$;

  insert into auth.users (id, email, raw_user_meta_data, created_at, last_sign_in_at) values
    (ua, 'lang-a@example.test', '{"pbgo_nickname":"Lia"}', t0, t0),
    (ub, 'lang-b@example.test', '{"pbgo_nickname":"Leo"}', t0, t0);
  select tag into tag_a from public.profiles where user_id = ua;

  -- 1. The column
  r := r || pg_temp.check_that('a profile starts with no language', (select languages = '{}' from public.profiles where user_id = ua), null);
  r := r || pg_temp.check_that('the column holds a list that cannot be null', (select is_nullable = 'NO' and data_type = 'ARRAY' from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'languages'), null);

  -- 2. What set_profile writes
  answer := pg_temp.change(ua, '{"languages":["fr","en","ja"]}');
  r := r || pg_temp.check_that('a list of languages is kept in the order the member put it', answer = 'ok' and (select languages = array['fr','en','ja'] from public.profiles where user_id = ua), answer);
  answer := pg_temp.change(ua, '{"bio":"Hello"}');
  r := r || pg_temp.check_that('a change that does not say the languages leaves them as they are', answer = 'ok' and (select languages = array['fr','en','ja'] and bio = 'Hello' from public.profiles where user_id = ua), answer);
  answer := pg_temp.change(ua, '{"languages":["de"],"bio":"Hallo"}');
  r := r || pg_temp.check_that('the languages change with the other fields, all or none', answer = 'ok' and (select languages = array['de'] and bio = 'Hallo' from public.profiles where user_id = ua), answer);
  answer := pg_temp.change(ua, '{"languages":[]}');
  r := r || pg_temp.check_that('an empty list takes them away', answer = 'ok' and (select languages = '{}' from public.profiles where user_id = ua), answer);
  answer := pg_temp.change(ua, '{"languages":["fr"]}') || pg_temp.change(ua, '{"languages":null}');
  r := r || pg_temp.check_that('null takes them away too', answer = 'okok' and (select languages = '{}' from public.profiles where user_id = ua), answer);

  -- 3. What it refuses: nothing changes
  answer := pg_temp.change(ua, '{"languages":["fr","en"]}');
  r := r || pg_temp.check_that('the shapes below are tried with two languages in place, so that a refusal can be seen', answer = 'ok', answer);
  r := r || pg_temp.check_that('a language twice is refused', pg_temp.change(ua, '{"languages":["fr","fr"]}') = 'invalid', null);
  r := r || pg_temp.check_that('a code in capitals, with a region, with a digit or with one letter is refused', pg_temp.change(ua, '{"languages":["FR"]}') = 'invalid' and pg_temp.change(ua, '{"languages":["en-GB"]}') = 'invalid' and pg_temp.change(ua, '{"languages":["f1"]}') = 'invalid' and pg_temp.change(ua, '{"languages":["f"]}') = 'invalid', null);
  r := r || pg_temp.check_that('a code of two or three lowercase letters is the shape of one', pg_temp.change(ua, '{"languages":["fr","fil"]}') = 'ok' and pg_temp.change(ua, '{"languages":["fr","en"]}') = 'ok', null);
  r := r || pg_temp.check_that('what is not a list of texts is refused', pg_temp.change(ua, '{"languages":"fr"}') = 'invalid' and pg_temp.change(ua, '{"languages":[1]}') = 'invalid' and pg_temp.change(ua, '{"languages":[null]}') = 'invalid' and pg_temp.change(ua, '{"languages":{"fr":true}}') = 'invalid' and pg_temp.change(ua, '{"languages":true}') = 'invalid', null);
  r := r || pg_temp.check_that('more than forty codes are refused', pg_temp.change(ua, (select jsonb_build_object('languages', jsonb_agg(chr(97 + (n / 26)) || chr(97 + (n % 26))))::text from generate_series(0, 40) as n)) = 'invalid', null);
  r := r || pg_temp.check_that('forty codes are the most that fit', pg_temp.change(ua, (select jsonb_build_object('languages', jsonb_agg(chr(97 + (n / 26)) || chr(97 + (n % 26))))::text from generate_series(0, 39) as n)) = 'ok', null);
  answer := pg_temp.change(ua, '{"languages":["fr","en"]}') || pg_temp.change(ua, '{"languages":["fr","fr"]}');
  r := r || pg_temp.check_that('a refused change leaves the list as it was', answer = 'okinvalid' and (select languages = array['fr','en'] from public.profiles where user_id = ua), answer);
  r := r || pg_temp.check_that('a key that is not a field of a profile is still refused', pg_temp.change(ua, '{"languages":["fr"],"user_id":"x"}') = 'invalid', null);

  -- 4. The table says the same whoever writes it
  r := r || pg_temp.check_that('a direct write is judged by the table: capitals, twice, null and a region are refused', pg_temp.refused_with(format('update public.profiles set languages = %L where user_id = %L', '{FR}', ua), '23514')
    and pg_temp.refused_with(format('update public.profiles set languages = %L where user_id = %L', '{fr,fr}', ua), '23514')
    and pg_temp.refused_with(format('update public.profiles set languages = %L where user_id = %L', '{fr,NULL}', ua), '23514')
    and pg_temp.refused_with(format('update public.profiles set languages = %L where user_id = %L', '{en-GB}', ua), '23514')
    and pg_temp.refused_with(format('update public.profiles set languages = null where user_id = %L', ua), '23502'), null);

  -- 5. The page's lookup says them, whatever else is hidden, and says none for a member who picked none
  answer := pg_temp.change(ua, '{"languages":["ja","fr"]}');
  r := r || pg_temp.check_that('the lookup says the languages in their order', (select languages = array['ja','fr'] from public.profile_by_handle('Lia', tag_a)), answer);
  r := r || pg_temp.check_that('the lookup says none for a member who picked none', (select languages = '{}' from public.profile_by_handle('Leo', (select tag from public.profiles where user_id = ub))), null);
  r := r || pg_temp.check_that('the lookup still says the favourite games (0021), none for a member who picked none', (select favorite_games = '{}' from public.profile_by_handle('Lia', tag_a)), null);
  answer := pg_temp.change(ua, '{"favorite_games":["hanabi","flip-7"],"languages":["en"]}');
  r := r || pg_temp.check_that('the favourite games and the languages change together, each in the order it was put', answer = 'ok' and (select favorite_games = array['hanabi','flip-7'] and languages = array['en'] from public.profile_by_handle('Lia', tag_a)), answer);
  answer := pg_temp.change(ua, '{"languages":["fr","ja"]}');
  r := r || pg_temp.check_that('a change of the languages alone leaves the favourite games as they were', answer = 'ok' and (select favorite_games = array['hanabi','flip-7'] and languages = array['fr','ja'] from public.profile_by_handle('Lia', tag_a)), answer);
  answer := pg_temp.change(ua, '{"favorite_games":["courtisans"]}');
  r := r || pg_temp.check_that('a change of the favourite games alone leaves the languages as they were', answer = 'ok' and (select favorite_games = array['courtisans'] and languages = array['fr','ja'] from public.profile_by_handle('Lia', tag_a)), answer);

  -- 6. Another member's list is theirs alone
  r := r || pg_temp.check_that('a change of one member leaves the other as it was', (select languages = '{}' from public.profiles where user_id = ub), null);

  -- 7. Who may call what: the server only
  r := r || pg_temp.check_that('set_profile and the lookup are the service role''s, nobody else''s', has_function_privilege('service_role', 'public.set_profile(uuid, jsonb)', 'execute') and has_function_privilege('service_role', 'public.profile_by_handle(text, integer)', 'execute')
    and not has_function_privilege('anon', 'public.set_profile(uuid, jsonb)', 'execute') and not has_function_privilege('authenticated', 'public.set_profile(uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.profile_by_handle(text, integer)', 'execute') and not has_function_privilege('authenticated', 'public.profile_by_handle(text, integer)', 'execute'), null);

  raise exception 'RESULT %', r;
end
$do$;
