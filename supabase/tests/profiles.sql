-- The profiles of the members, end to end (migrations 0015, 0018 and 0020): the nickname as a profile keeps it, the nickname an account starts with, the profile the database makes for every new account and the way it follows the account's picture and
-- choice to hide its games, the tags (random, free, unique whatever the case of the nickname), the change of nickname and tag and its refusals, the page's lookup by handle, the cascade, the seats that a deleted account leaves, the opponents
-- of a history, what a profile says of its member (pronouns, country, favourite games, bio: what the table and the writer accept and refuse, one field at a time and all at once), and who may call what.
--
-- Run it on `pbgo-preview` once the migrations are applied (the Supabase MCP's `execute_sql`, or the SQL editor). It is one `DO` block that ends with `RAISE EXCEPTION 'RESULT …'`: everything it writes is rolled back, and the
-- message is the answer. Every check prints `ok` or `FAIL` with what it saw; read the whole line. Never on production. It makes fixture rows in `auth.users` that the rollback takes back: it creates no account anywhere.
-- (To try a migration itself without applying it: put the statements of the migration right after the `begin` below, in this same block, the backfill's `DO` block of 0015 written as its loop: a block cannot be nested. 0018 has no `DO` block.)
-- A function that writes and a query that reads what it wrote cannot share a statement (the query keeps the snapshot it started with): each answer is taken into a variable first.
-- `pg_temp.sp` is `set_profile` for the pair alone: the tests of the nickname and the tag read as they did when that was all it took.

DO $do$
declare
  ua uuid := '00000000-0000-4000-8000-0000000000e1';
  ub uuid := '00000000-0000-4000-8000-0000000000e2';
  uc uuid := '00000000-0000-4000-8000-0000000000e3';
  ud uuid := '00000000-0000-4000-8000-0000000000e4';
  ue uuid := '00000000-0000-4000-8000-0000000000e5';
  uf uuid := '00000000-0000-4000-8000-0000000000e6';
  ug uuid := '00000000-0000-4000-8000-0000000000e7';
  uh uuid := '00000000-0000-4000-8000-0000000000e8';
  ui uuid := '00000000-0000-4000-8000-0000000000e9';
  uz uuid := '00000000-0000-4000-8000-0000000000ff';
  t0 timestamptz := '2026-11-01 10:00:00+00';
  hash_b text := repeat('b', 64);
  r text := '';
  s text;
  n integer;
  k integer;
  tag_a integer;
  tag_b integer;
  answer text;
  when_closed timestamptz;
  reopened boolean;
  made boolean;
  rid uuid;
begin
  -- A check: the line tells what it was and what the database said
  create function pg_temp.check_that(p_name text, p_ok boolean, p_saw text) returns text language sql as $f$
    select case when coalesce(p_ok, false) then 'ok ' || p_name || '; ' else 'FAIL ' || p_name || ' (saw ' || coalesce(p_saw, 'null') || '); ' end
  $f$;
  -- Whether a statement is refused with this state (23505 a pair that is taken, 23514 a check)
  create function pg_temp.refused_with(p_sql text, p_state text) returns boolean language plpgsql as $f$
  begin
    execute p_sql;
    return false;
  exception when others then
    return sqlstate = p_state;
  end
  $f$;
  -- The change of a nickname and a tag, the only thing `set_profile` did before 0018; a null stays a JSON null, which is not a nickname or a tag
  create function pg_temp.sp(p_user uuid, p_nickname text, p_tag integer) returns text language sql as $f$
    select public.set_profile(p_user, jsonb_build_object('nickname', p_nickname, 'tag', p_tag))
  $f$;
  -- What `set_profile` says of a change given as text (a JSON object)
  create function pg_temp.change(p_user uuid, p_json text) returns text language sql as $f$
    select public.set_profile(p_user, p_json::jsonb)
  $f$;

  -- 0. Every account that exists has a profile (the backfill of the migration, then the trigger on each new account)
  select count(*) into n from auth.users a where a.deleted_at is null and coalesce(a.is_anonymous, false) = false and not exists (select 1 from public.profiles p where p.user_id = a.id);
  r := r || pg_temp.check_that('every account that exists has a profile', n = 0, n::text || ' without');
  select count(*) into k from public.profiles;
  r := r || 'profiles before the fixtures: ' || k::text || '; ';

  -- 1. The nickname as a profile keeps it
  r := r || pg_temp.check_that('a plain nickname is kept', public.clean_nickname('Alex') = 'Alex', public.clean_nickname('Alex'));
  r := r || pg_temp.check_that('spaces are collapsed and trimmed', public.clean_nickname('  Marly   74 ') = 'Marly 74', public.clean_nickname('  Marly   74 '));
  r := r || pg_temp.check_that('#, / and \ go', public.clean_nickname('A#b/c\d') = 'Abcd', public.clean_nickname('A#b/c\d'));
  r := r || pg_temp.check_that('control characters go, a tab is not a space', public.clean_nickname(E'a\tb\nc') = 'abc', public.clean_nickname(E'a\tb\nc'));
  r := r || pg_temp.check_that('it is cut at 20 characters, as a person counts them', public.clean_nickname(repeat('🎲', 25)) = repeat('🎲', 20), public.clean_nickname(repeat('🎲', 25)));
  r := r || pg_temp.check_that('a cut that falls after a space leaves no space', public.clean_nickname('abcdefghijklmnopqrs tuvw') = 'abcdefghijklmnopqrs', public.clean_nickname('abcdefghijklmnopqrs tuvw'));
  r := r || pg_temp.check_that('nothing is left of blanks, of null, or of what is only #', public.clean_nickname('   ') = '' and public.clean_nickname(null) = '' and public.clean_nickname('###') = '', null);

  -- 2. The nickname an account starts with, in the order accountOf reads them
  r := r || pg_temp.check_that('the name the member chose comes first', public.profile_nickname_of('{"pbgo_nickname":"Chosen","full_name":"Provider"}', 'x@example.test') = 'Chosen', null);
  r := r || pg_temp.check_that('then the name Discord gives', public.profile_nickname_of('{"custom_claims":{"global_name":"Disco"},"full_name":"Login"}', null) = 'Disco', null);
  r := r || pg_temp.check_that('then full_name, name and user_name', public.profile_nickname_of('{"full_name":"Provider","name":"Other"}', null) = 'Provider' and public.profile_nickname_of('{"name":"Other"}', null) = 'Other' and public.profile_nickname_of('{"user_name":"login"}', null) = 'login', null);
  r := r || pg_temp.check_that('then the start of the address', public.profile_nickname_of('{}', 'ann@example.test') = 'ann', null);
  r := r || pg_temp.check_that('a name that cleans down to nothing is passed over', public.profile_nickname_of('{"pbgo_nickname":"###","full_name":"Ann"}', null) = 'Ann', null);
  r := r || pg_temp.check_that('the address that stands in for none is no name', public.profile_nickname_of('{}', '765@external.pbgo.invalid') = 'Player' and public.profile_nickname_of('{}', null) = 'Player', null);
  r := r || pg_temp.check_that('the picture is an https address', public.profile_picture_of('{"avatar_url":"https://example.com/a.png"}') = 'https://example.com/a.png' and public.profile_picture_of('{"picture":"https://example.com/p.png"}') = 'https://example.com/p.png', null);
  r := r || pg_temp.check_that('an address that is not https, or is too long, is no picture', public.profile_picture_of('{"avatar_url":"http://example.com/a.png"}') is null and public.profile_picture_of(jsonb_build_object('avatar_url', 'https://example.com/' || repeat('a', 2100))) is null and public.profile_picture_of(null) is null, null);

  -- 3. A new account has a profile, made by the database whatever way it came in
  -- The Auth server dates an account when it makes it (the column has no default), so the fixture gives its date
  insert into auth.users (id, email, raw_user_meta_data, created_at) values (ua, 'ann@example.test', '{"full_name":"Ann","avatar_url":"https://example.com/ann.png"}', t0 - interval '3 days');
  insert into auth.users (id, email, raw_user_meta_data) values (ub, 'ann2@example.test', '{"full_name":"ANN"}');
  insert into auth.users (id, is_anonymous) values (uc, true);
  insert into auth.users (id, email, raw_user_meta_data) values (ud, 'dee@example.test', '{"full_name":"Dee","pbgo_hide_history":true}');
  insert into auth.users (id, email, raw_user_meta_data) values (ue, 'eve@example.test', '{"full_name":"Eve","pbgo_hide_history":"true","avatar_url":"http://example.com/e.png"}');
  insert into auth.users (id) values (uf);
  r := r || pg_temp.check_that('an account has a profile with the name its provider gives', (select nickname = 'Ann' and avatar_url = 'https://example.com/ann.png' and not hide_history from public.profiles where user_id = ua), (select nickname || '/' || coalesce(avatar_url, 'null') from public.profiles where user_id = ua));
  select tag into tag_a from public.profiles where user_id = ua;
  select tag into tag_b from public.profiles where user_id = ub;
  r := r || pg_temp.check_that('its tag is one of 1 to 9999', tag_a between 1 and 9999, tag_a::text);
  r := r || pg_temp.check_that('the same nickname in another case gets another tag', (select nickname = 'ANN' from public.profiles where user_id = ub) and tag_b <> tag_a, tag_a::text || '/' || tag_b::text);
  r := r || pg_temp.check_that('member since is when the account was made', (select p.created_at = au.created_at and p.created_at = t0 - interval '3 days' from public.profiles p join auth.users au on au.id = p.user_id where p.user_id = ua), (select p.created_at::text || ' / ' || coalesce(au.created_at::text, 'null') from public.profiles p join auth.users au on au.id = p.user_id where p.user_id = ua));
  r := r || pg_temp.check_that('an anonymous user has no profile', not exists (select 1 from public.profiles where user_id = uc), null);
  r := r || pg_temp.check_that('the choice to hide the games is read from the account, as a boolean only', (select hide_history from public.profiles where user_id = ud) and not (select hide_history from public.profiles where user_id = ue), null);
  r := r || pg_temp.check_that('an address that is not https is no picture', (select avatar_url is null from public.profiles where user_id = ue), null);
  r := r || pg_temp.check_that('an account with nothing to go by is Player', (select nickname = 'Player' from public.profiles where user_id = uf), null);
  insert into auth.users (id, email, raw_user_meta_data) select gen_random_uuid(), 'many' || g || '@example.test', '{"full_name":"Many"}' from generate_series(1, 40) g;
  select count(*), count(distinct tag) into n, k from public.profiles where lower(nickname) = 'many';
  r := r || pg_temp.check_that('forty members of one name all have their own tag', n = 40 and k = 40, n::text || '/' || k::text);

  -- 4. What the table refuses, whoever writes it
  r := r || pg_temp.check_that('a pair that is taken is refused, whatever the case', pg_temp.refused_with(format('insert into public.profiles (user_id, nickname, tag) values (%L, %L, %s)', uc, 'aNN', tag_a), '23505'), null);
  r := r || pg_temp.check_that('a # in a nickname is refused', pg_temp.refused_with(format('update public.profiles set nickname = %L where user_id = %L', 'A#1', ua), '23514'), null);
  r := r || pg_temp.check_that('a / in a nickname is refused', pg_temp.refused_with(format('update public.profiles set nickname = %L where user_id = %L', 'A/B', ua), '23514'), null);
  r := r || pg_temp.check_that('a \ in a nickname is refused', pg_temp.refused_with(format('update public.profiles set nickname = %L where user_id = %L', 'A\B', ua), '23514'), null);
  r := r || pg_temp.check_that('an empty, a padded or a 21 character nickname is refused', pg_temp.refused_with(format('update public.profiles set nickname = %L where user_id = %L', '', ua), '23514') and pg_temp.refused_with(format('update public.profiles set nickname = %L where user_id = %L', ' Ann', ua), '23514') and pg_temp.refused_with(format('update public.profiles set nickname = %L where user_id = %L', repeat('a', 21), ua), '23514'), null);
  r := r || pg_temp.check_that('a control character is refused', pg_temp.refused_with(format('update public.profiles set nickname = %L where user_id = %L', E'A\tB', ua), '23514'), null);
  r := r || pg_temp.check_that('a tag of 0 or 10000 is refused', pg_temp.refused_with(format('update public.profiles set tag = 0 where user_id = %L', ua), '23514') and pg_temp.refused_with(format('update public.profiles set tag = 10000 where user_id = %L', ua), '23514'), null);
  r := r || pg_temp.check_that('a picture that is not https is refused', pg_temp.refused_with(format('update public.profiles set avatar_url = %L where user_id = %L', 'http://example.com/a.png', ua), '23514'), null);

  -- 5. The tags that are free
  insert into auth.users (id, email) values (ug, 'g@example.test'), (uh, 'h@example.test'), (ui, 'i@example.test');
  answer := pg_temp.sp(ug, 'Tiny', 1) || pg_temp.sp(uh, 'Tiny', 2) || pg_temp.sp(ui, 'tiny', 3);
  r := r || pg_temp.check_that('three members took the three tags of a nickname', answer = 'okokok', answer);
  r := r || pg_temp.check_that('no tag is free when all are taken, whatever the case', public.free_tag('Tiny', 3) is null and public.free_tag('TINY', 3) is null, coalesce(public.free_tag('Tiny', 3)::text, 'null'));
  answer := pg_temp.sp(uh, 'Other', 2);
  r := r || pg_temp.check_that('the one that is free again is found, whatever the tries', (select bool_and(public.free_tag('Tiny', 3) = 2) from generate_series(1, 30)), coalesce(public.free_tag('Tiny', 3)::text, 'null'));
  r := r || pg_temp.check_that('a nickname nobody has gets a tag of 1 to 9999', (select bool_and(public.free_tag('Nobody') between 1 and 9999) from generate_series(1, 50)), null);

  -- 6. Changing the nickname and the tag
  answer := pg_temp.sp(ua, 'Annie', 42);
  r := r || pg_temp.check_that('a member changes their nickname and tag', answer = 'ok' and (select nickname = 'Annie' and tag = 42 from public.profiles where user_id = ua), answer);
  answer := pg_temp.sp(ub, 'annie', 42);
  r := r || pg_temp.check_that('a pair that another member has is taken, whatever the case', answer = 'taken' and (select nickname = 'ANN' and tag = tag_b from public.profiles where user_id = ub), answer);
  answer := pg_temp.sp(ua, 'ANNIE', 42);
  r := r || pg_temp.check_that('a member keeps their own pair, and may change its case', answer = 'ok' and (select nickname = 'ANNIE' from public.profiles where user_id = ua), answer);
  answer := pg_temp.sp(ub, 'Annie', 43);
  r := r || pg_temp.check_that('the same nickname with another tag is free', answer = 'ok', answer);
  answer := pg_temp.sp(ua, 'Zed', 7);
  answer := answer || pg_temp.sp(ub, 'Annie', 42);
  r := r || pg_temp.check_that('the pair a member leaves is free again', answer = 'okok', answer);
  r := r || pg_temp.check_that('an empty, padded, long, or forbidden nickname is invalid', pg_temp.sp(ua, '', 1) = 'invalid' and pg_temp.sp(ua, ' Zed', 1) = 'invalid' and pg_temp.sp(ua, repeat('a', 21), 1) = 'invalid' and pg_temp.sp(ua, 'A#1', 1) = 'invalid' and pg_temp.sp(ua, null, 1) = 'invalid', null);
  r := r || pg_temp.check_that('a tag out of 1 to 9999, or none, is invalid', pg_temp.sp(ua, 'Zed', 0) = 'invalid' and pg_temp.sp(ua, 'Zed', 10000) = 'invalid' and pg_temp.sp(ua, 'Zed', null) = 'invalid', null);
  r := r || pg_temp.check_that('an invalid change changes nothing', (select nickname = 'Zed' and tag = 7 from public.profiles where user_id = ua), null);
  r := r || pg_temp.check_that('an account with no profile is missing', pg_temp.sp(uc, 'Anon', 1) = 'missing' and pg_temp.sp(uz, 'Nobody', 1) = 'missing', null);

  -- 7. The page's lookup by handle: only an account that signed in has a page
  r := r || pg_temp.check_that('an account that never signed in has no page', (select count(*) from public.profile_by_handle('annie', 42)) = 0, null);
  update auth.users set last_sign_in_at = now() where id in (ua, ub);
  r := r || pg_temp.check_that('a profile is found by its handle, whatever the case', (select count(*) from public.profile_by_handle('annie', 42)) = 1 and (select user_id = ub from public.profile_by_handle('ANNIE', 42)), null);
  r := r || pg_temp.check_that('the lookup says what the page draws', (select nickname = 'Annie' and tag = 42 and avatar_url is null and not hide_history and created_at is not null and pronouns is null and country is null and favorite_games = '{}' and bio is null from public.profile_by_handle('Annie', 42)), null);
  update auth.users set last_sign_in_at = now() where id = ud;
  r := r || pg_temp.check_that('the lookup of a member who hides their games says so', (select hide_history from public.profile_by_handle('Dee', (select tag from public.profiles where user_id = ud))), null);
  r := r || pg_temp.check_that('the wrong tag, or a pair nobody has, finds nobody', (select count(*) from public.profile_by_handle('Annie', 41)) = 0 and (select count(*) from public.profile_by_handle('Nobody', 42)) = 0, null);
  r := r || pg_temp.check_that('a handle a member left finds nobody', (select count(*) from public.profile_by_handle('Ann', tag_a)) = 0, null);
  when_closed := public.close_account(ub, hash_b, now() + interval '7 days');
  r := r || pg_temp.check_that('the profile of a closed account is nobody to anyone', when_closed is not null and (select count(*) from public.profile_by_handle('Annie', 42)) = 0, null);
  reopened := public.reopen_account(ub, hash_b);
  r := r || pg_temp.check_that('it is back when the account is reopened', reopened and (select count(*) from public.profile_by_handle('Annie', 42)) = 1, null);

  -- 8. The profile follows the account's picture and its choice to hide the games, and not its name
  update auth.users set raw_user_meta_data = '{"full_name":"Ann","avatar_url":"https://example.com/new.png"}' where id = ua;
  r := r || pg_temp.check_that('a new picture of the provider reaches the profile', (select avatar_url = 'https://example.com/new.png' from public.profiles where user_id = ua), (select coalesce(avatar_url, 'null') from public.profiles where user_id = ua));
  r := r || pg_temp.check_that('the nickname and the tag are the profile''s, not the account''s', (select nickname = 'Zed' and tag = 7 from public.profiles where user_id = ua), (select nickname || '#' || tag::text from public.profiles where user_id = ua));
  update auth.users set raw_user_meta_data = raw_user_meta_data || '{"pbgo_hide_history":true}' where id = ua;
  r := r || pg_temp.check_that('hiding the games reaches the profile at once', (select hide_history from public.profiles where user_id = ua), null);
  update auth.users set raw_user_meta_data = raw_user_meta_data || '{"pbgo_hide_history":false,"pbgo_nickname":"Meta"}' where id = ua;
  r := r || pg_temp.check_that('showing them again does too, and a nickname written in the account changes nothing', (select not hide_history and nickname = 'Zed' from public.profiles where user_id = ua), (select nickname || '/' || hide_history::text from public.profiles where user_id = ua));
  update auth.users set raw_user_meta_data = '{"full_name":"Ann"}' where id = ua;
  r := r || pg_temp.check_that('a picture the provider took away is gone', (select avatar_url is null from public.profiles where user_id = ua), null);
  update auth.users set last_sign_in_at = now() where id = ua;
  r := r || pg_temp.check_that('an update that is not of the metadata leaves the profile alone', (select nickname = 'Zed' and tag = 7 from public.profiles where user_id = ua), null);
  delete from public.profiles where user_id = ua;
  update auth.users set raw_user_meta_data = '{"full_name":"Ann Again"}' where id = ua;
  r := r || pg_temp.check_that('an account that lost its profile gets one back the next time it is touched', (select nickname = 'Ann Again' from public.profiles where user_id = ua), (select count(*)::text from public.profiles where user_id = ua));
  update auth.users set raw_user_meta_data = '{"full_name":"Anon"}' where id = uc;
  r := r || pg_temp.check_that('an anonymous user still has none', not exists (select 1 from public.profiles where user_id = uc), null);

  -- 9. make_profile and the backfill, which is the same call for each account
  delete from public.profiles where user_id = ud;
  made := public.make_profile(ud, public.profile_nickname_of((select raw_user_meta_data from auth.users where id = ud), 'dee@example.test'), null, true, t0);
  r := r || pg_temp.check_that('a profile is made again from the account, with its date', made and (select nickname = 'Dee' and hide_history and created_at = t0 from public.profiles where user_id = ud), null);
  r := r || pg_temp.check_that('making it twice changes nothing', not public.make_profile(ud, 'Someone', null, false, now()) and (select nickname = 'Dee' from public.profiles where user_id = ud), null);

  -- 10. A table keeps the seat of a deleted account as a deleted player, with no tag either
  insert into public.games (game, code, host_id, status, players, member_ids, version, created_at, updated_at) values
    ('zz-test', 'P1AAAA', 'pa', 'lobby', '[{"id":"pa","nickname":"Ann","tag":42,"avatarUrl":"https://example.com/a.png"},{"id":"pg","nickname":"Guest"}]', jsonb_build_object('pa', ua::text), 1, t0, t0);

  -- 11. A history says who the opponents are, by account, so that the server can link to them
  insert into public.game_results (id, game, table_created_at, finished_at, ranked, rating_kind, player_count, engine_version) values
    (gen_random_uuid(), 'zz-test', t0, t0 + interval '10 minutes', false, 'elo', 3, 'test') returning id into rid;
  insert into public.game_participants (game_result_id, seat, user_id, display_name, rank, outcome, finished_at) values
    (rid, 0, ua, 'Zed', 1, 'win', t0 + interval '10 minutes'),
    (rid, 1, ub, 'Annie', 2, 'loss', t0 + interval '10 minutes'),
    (rid, 2, null, 'Guest', 3, 'loss', t0 + interval '10 minutes');
  r := r || pg_temp.check_that('a history names the account of each opponent, and none for a guest', (select opponents -> 0 ->> 'userId' = ub::text and opponents -> 0 ->> 'name' = 'Annie' and opponents -> 1 -> 'userId' = 'null'::jsonb and jsonb_array_length(opponents) = 2 from public.player_history(ua, 'zz-test', 10)), (select opponents::text from public.player_history(ua, 'zz-test', 10)));

  -- 12. The profile goes with the account, and so does the seat's name
  select tag into tag_a from public.profiles where user_id = ua;
  r := r || pg_temp.check_that('the page of a member is there until the account goes', (select count(*) from public.profile_by_handle('Ann Again', tag_a)) = 1, tag_a::text);
  delete from auth.users where id = ua;
  r := r || pg_temp.check_that('the profile goes with the account', not exists (select 1 from public.profiles where user_id = ua), null);
  r := r || pg_temp.check_that('a deleted member has no page', (select count(*) from public.profile_by_handle('Ann Again', tag_a)) = 0, null);
  r := r || pg_temp.check_that('the seat of the account is a deleted player with no picture and no tag', (select p ->> 'nickname' = 'Deleted player' and p ->> 'avatarUrl' is null and p ->> 'tag' is null from public.games g, jsonb_array_elements(g.players) p where g.game = 'zz-test' and g.code = 'P1AAAA' and p ->> 'id' = 'pa'), (select players::text from public.games where game = 'zz-test' and code = 'P1AAAA'));
  r := r || pg_temp.check_that('the other seat of that table is untouched', (select players -> 1 = '{"id":"pg","nickname":"Guest"}'::jsonb from public.games where game = 'zz-test' and code = 'P1AAAA'), null);
  r := r || pg_temp.check_that('the pair of a deleted account is free again', pg_temp.sp(ub, 'Zed', 7) = 'ok', null);
  select count(*) into n from public.profiles where user_id = ue;
  answer := public.erase_account(ue)::text;
  r := r || pg_temp.check_that('erasing an account takes its profile too', n = 1 and answer = 'true' and not exists (select 1 from public.profiles where user_id = ue), answer);

  -- 13. Nothing of ours may block the deletion of an account, and who may call what
  select count(*), string_agg(c.conrelid::regclass::text || ' ' || c.confdeltype::text, ', ') into n, s
  from pg_constraint c join pg_namespace ns on ns.oid = c.connamespace
  where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and ns.nspname = 'public' and c.confdeltype in ('a', 'r');
  r := r || pg_temp.check_that('no table of public holds an account with no action or restrict', n = 0, s);
  r := r || pg_temp.check_that('the profiles are for the server only', not has_table_privilege('anon', 'public.profiles', 'select') and not has_table_privilege('authenticated', 'public.profiles', 'select') and not has_table_privilege('authenticated', 'public.profiles', 'update') and has_table_privilege('service_role', 'public.profiles', 'select'), null);
  r := r || pg_temp.check_that('row level security is on', (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), null);
  r := r || pg_temp.check_that('no public role may call the functions', not has_function_privilege('anon', 'public.set_profile(uuid, jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.set_profile(uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.valid_favorite_games(text[])', 'execute')
    and not has_function_privilege('authenticated', 'public.valid_favorite_games(text[])', 'execute')
    and not has_function_privilege('anon', 'public.profile_by_handle(text, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.profile_by_handle(text, integer)', 'execute')
    and not has_function_privilege('anon', 'public.make_profile(uuid, text, text, boolean, timestamptz)', 'execute')
    and not has_function_privilege('anon', 'public.free_tag(text, integer)', 'execute')
    and not has_function_privilege('anon', 'public.clean_nickname(text)', 'execute')
    and not has_function_privilege('anon', 'public.player_history(uuid, text, integer)', 'execute'), null);
  r := r || pg_temp.check_that('the service role may', has_function_privilege('service_role', 'public.set_profile(uuid, jsonb)', 'execute') and has_function_privilege('service_role', 'public.valid_favorite_games(text[])', 'execute') and has_function_privilege('service_role', 'public.profile_by_handle(text, integer)', 'execute') and has_function_privilege('service_role', 'public.player_history(uuid, text, integer)', 'execute'), null);
  r := r || pg_temp.check_that('the writer of 0015 is gone: set_profile takes one object', to_regprocedure('public.set_profile(uuid, text, integer)') is null and to_regprocedure('public.set_profile(uuid, jsonb)') is not null, null);

  -- 14. What a profile says of its member (migration 0018): pronouns, country, favourite games, bio
  -- ua was deleted above and ub holds the pair Zed#7 after the changes of section 12: the fixtures here are ud (Dee, with a page), ug and uh
  update auth.users set last_sign_in_at = now() where id in (ug, uh);
  select tag into tag_a from public.profiles where user_id = ud;
  r := r || pg_temp.check_that('a profile says nothing of its member to begin with', (select pronouns is null and country is null and favorite_games = '{}' and bio is null from public.profiles where user_id = ud), null);
  r := r || pg_temp.check_that('the lookup says it, nothing in all four fields', (select pronouns is null and country is null and favorite_games = '{}' and bio is null from public.profile_by_handle('Dee', tag_a)), null);
  answer := pg_temp.change(ud, '{"pronouns":"they/them","country":"FR","favorite_games":["courtisans","flip-7","6-nimmt"],"bio":"I play late.\nCome and join!"}');
  r := r || pg_temp.check_that('all four fields are set in one change', answer = 'ok' and (select pronouns = 'they/them' and country = 'FR' and favorite_games = array['courtisans', 'flip-7', '6-nimmt'] and bio = E'I play late.\nCome and join!' and nickname = 'Dee' and tag = tag_a from public.profiles where user_id = ud), answer);
  r := r || pg_temp.check_that('the lookup says all four, the favourites in the order they were put', (select pronouns = 'they/them' and country = 'FR' and favorite_games = array['courtisans', 'flip-7', '6-nimmt'] and bio = E'I play late.\nCome and join!' from public.profile_by_handle('Dee', tag_a)), null);
  r := r || pg_temp.check_that('they are shown even when the games are hidden (Dee hides them)', (select hide_history and bio is not null from public.profile_by_handle('Dee', tag_a)), null);
  answer := pg_temp.change(ud, '{"bio":"Only the bio changes"}');
  r := r || pg_temp.check_that('a field that is not in the change is left as it is', answer = 'ok' and (select pronouns = 'they/them' and country = 'FR' and cardinality(favorite_games) = 3 and bio = 'Only the bio changes' and nickname = 'Dee' and tag = tag_a from public.profiles where user_id = ud), answer);
  answer := pg_temp.change(ud, '{"pronouns":"she/her","country":"fr"}');
  r := r || pg_temp.check_that('a country in lower case is not one', answer = 'invalid' and (select pronouns = 'they/them' and country = 'FR' from public.profiles where user_id = ud), answer);
  answer := pg_temp.change(ud, '{"country":"BE","favorite_games":["hanabi"]}');
  r := r || pg_temp.check_that('two fields change together and the others stay', answer = 'ok' and (select country = 'BE' and favorite_games = array['hanabi'] and pronouns = 'they/them' and bio = 'Only the bio changes' from public.profiles where user_id = ud), answer);
  r := r || pg_temp.check_that('each pronoun of the list is accepted', (select bool_and(pg_temp.change(ud, jsonb_build_object('pronouns', p)::text) = 'ok') from unnest(array['he/him', 'she/her', 'they/them', 'he/they', 'she/they', 'any', 'ask']) as p), null);
  r := r || pg_temp.check_that('a pronoun that is not on the list is invalid, an empty one too: the server sends null to clear', pg_temp.change(ud, '{"pronouns":"he/she"}') = 'invalid' and pg_temp.change(ud, '{"pronouns":""}') = 'invalid' and pg_temp.change(ud, '{"pronouns":"HE/HIM"}') = 'invalid' and pg_temp.change(ud, '{"pronouns":3}') = 'invalid', null);
  r := r || pg_temp.check_that('a country is two capital letters', pg_temp.change(ud, '{"country":"FRA"}') = 'invalid' and pg_temp.change(ud, '{"country":"F"}') = 'invalid' and pg_temp.change(ud, '{"country":"F1"}') = 'invalid' and pg_temp.change(ud, '{"country":""}') = 'invalid' and pg_temp.change(ud, '{"country":12}') = 'invalid', null);
  answer := pg_temp.change(ud, '{"pronouns":null,"country":null}');
  r := r || pg_temp.check_that('null clears the pronouns and the country', answer = 'ok' and (select pronouns is null and country is null from public.profiles where user_id = ud), answer);
  answer := pg_temp.change(ud, '{"favorite_games":null,"bio":null}');
  r := r || pg_temp.check_that('null clears the favourites to an empty list, and the bio', answer = 'ok' and (select favorite_games = '{}' and bio is null from public.profiles where user_id = ud), answer);
  answer := pg_temp.change(ud, '{"favorite_games":["a","b"]}') || pg_temp.change(ud, '{"favorite_games":[]}');
  r := r || pg_temp.check_that('an empty list of favourites is none', answer = 'okok' and (select favorite_games = '{}' from public.profiles where user_id = ud), answer);
  -- The favourites
  answer := pg_temp.change(ud, '{"favorite_games":["a","b","c","d","e"]}') || pg_temp.change(ud, '{"favorite_games":["a","b","c","d","e","f"]}');
  r := r || pg_temp.check_that('five favourites are accepted, six are not', answer = 'okinvalid' and (select cardinality(favorite_games) = 5 from public.profiles where user_id = ud), answer);
  r := r || pg_temp.check_that('a slug twice is invalid', pg_temp.change(ud, '{"favorite_games":["a","b","a"]}') = 'invalid', null);
  r := r || pg_temp.check_that('a slug has lowercase letters, digits and single dashes', pg_temp.change(ud, '{"favorite_games":["Flip-7"]}') = 'invalid' and pg_temp.change(ud, '{"favorite_games":["flip 7"]}') = 'invalid' and pg_temp.change(ud, '{"favorite_games":["flip--7"]}') = 'invalid' and pg_temp.change(ud, '{"favorite_games":["-flip"]}') = 'invalid' and pg_temp.change(ud, '{"favorite_games":[""]}') = 'invalid' and pg_temp.change(ud, '{"favorite_games":["a/b"]}') = 'invalid', null);
  r := r || pg_temp.check_that('a slug is 48 characters at most', pg_temp.change(ud, jsonb_build_object('favorite_games', jsonb_build_array(repeat('a', 48)))::text) = 'ok' and pg_temp.change(ud, jsonb_build_object('favorite_games', jsonb_build_array(repeat('a', 49)))::text) = 'invalid', null);
  r := r || pg_temp.check_that('the favourites are a list of texts', pg_temp.change(ud, '{"favorite_games":"flip-7"}') = 'invalid' and pg_temp.change(ud, '{"favorite_games":[7]}') = 'invalid' and pg_temp.change(ud, '{"favorite_games":[null]}') = 'invalid' and pg_temp.change(ud, '{"favorite_games":[["a"]]}') = 'invalid' and pg_temp.change(ud, '{"favorite_games":{"a":1}}') = 'invalid', null);
  r := r || pg_temp.check_that('a refused list changes nothing', (select cardinality(favorite_games) = 1 and favorite_games[1] = repeat('a', 48) from public.profiles where user_id = ud), (select favorite_games::text from public.profiles where user_id = ud));
  r := r || pg_temp.check_that('the table says the same whoever writes it', pg_temp.refused_with(format('update public.profiles set favorite_games = %L where user_id = %L', '{a,b,a}', ud), '23514')
    and pg_temp.refused_with(format('update public.profiles set favorite_games = %L where user_id = %L', '{a,b,c,d,e,f}', ud), '23514')
    and pg_temp.refused_with(format('update public.profiles set favorite_games = %L where user_id = %L', '{{a,b},{c,d}}', ud), '23514')
    and pg_temp.refused_with(format('update public.profiles set favorite_games = %L where user_id = %L', '{NULL}', ud), '23514')
    and pg_temp.refused_with(format('update public.profiles set favorite_games = null where user_id = %L', ud), '23502')
    and pg_temp.refused_with(format('update public.profiles set pronouns = %L where user_id = %L', 'it/its', ud), '23514')
    and pg_temp.refused_with(format('update public.profiles set country = %L where user_id = %L', 'fr', ud), '23514'), null);
  -- The bio
  r := r || pg_temp.check_that('a bio of 200 characters is accepted, 201 is not', pg_temp.change(ud, jsonb_build_object('bio', repeat('b', 200))::text) = 'ok' and pg_temp.change(ud, jsonb_build_object('bio', repeat('b', 201))::text) = 'invalid', null);
  r := r || pg_temp.check_that('characters are counted as a person counts them: 200 emoji fit', pg_temp.change(ud, jsonb_build_object('bio', repeat('🎲', 200))::text) = 'ok' and pg_temp.change(ud, jsonb_build_object('bio', repeat('🎲', 201))::text) = 'invalid', null);
  r := r || pg_temp.check_that('three line breaks are accepted, four are not', pg_temp.change(ud, jsonb_build_object('bio', E'a\nb\nc\nd')::text) = 'ok' and pg_temp.change(ud, jsonb_build_object('bio', E'a\nb\nc\nd\ne')::text) = 'invalid', null);
  r := r || pg_temp.check_that('an empty bio, or one with something around it, is invalid: the server sends null to clear', pg_temp.change(ud, '{"bio":""}') = 'invalid' and pg_temp.change(ud, '{"bio":" hi"}') = 'invalid' and pg_temp.change(ud, '{"bio":"hi "}') = 'invalid' and pg_temp.change(ud, '{"bio":"hi\n"}') = 'invalid' and pg_temp.change(ud, '{"bio":"\nhi"}') = 'invalid' and pg_temp.change(ud, '{"bio":"   "}') = 'invalid', null);
  r := r || pg_temp.check_that('a control character but the line break is invalid: a tab, a carriage return, a bell, a C1 control, the Unicode line and paragraph separators',pg_temp.change(ud, '{"bio":"a\tb"}') = 'invalid' and pg_temp.change(ud, '{"bio":"a\rb"}') = 'invalid' and pg_temp.change(ud, '{"bio":"a\u0007b"}') = 'invalid' and pg_temp.change(ud, '{"bio":"a\u0085b"}') = 'invalid' and pg_temp.change(ud, '{"bio":"a\u007fb"}') = 'invalid' and pg_temp.change(ud, '{"bio":"a\u2028b"}') = 'invalid' and pg_temp.change(ud, '{"bio":"a\u2029b"}') = 'invalid', null);
  answer := pg_temp.change(ud, '{"bio":"<b>hi</b> & <script>alert(1)</script>"}');
  r := r || pg_temp.check_that('text that looks like HTML is only text: it is kept as it is, and never read as markup by the pages', answer = 'ok' and (select bio = '<b>hi</b> & <script>alert(1)</script>' from public.profiles where user_id = ud), answer);
  r := r || pg_temp.check_that('the bio is text', pg_temp.change(ud, '{"bio":12}') = 'invalid' and pg_temp.change(ud, '{"bio":["a"]}') = 'invalid' and pg_temp.change(ud, '{"bio":true}') = 'invalid', null);
  r := r || pg_temp.check_that('the table says the same whoever writes it', pg_temp.refused_with(format('update public.profiles set bio = %L where user_id = %L', '', ud), '23514')
    and pg_temp.refused_with(format('update public.profiles set bio = %L where user_id = %L', repeat('b', 201), ud), '23514')
    and pg_temp.refused_with(format('update public.profiles set bio = %L where user_id = %L', E'a\tb', ud), '23514')
    and pg_temp.refused_with(format('update public.profiles set bio = %L where user_id = %L', E'a\nb\nc\nd\ne', ud), '23514')
    and pg_temp.refused_with(format('update public.profiles set bio = %L where user_id = %L', E' a', ud), '23514'), null);
  -- What the writer refuses as a whole
  r := r || pg_temp.check_that('nothing to change, a key it does not know, or something that is not an object is invalid', pg_temp.change(ud, '{}') = 'invalid' and pg_temp.change(ud, '{"mood":"happy"}') = 'invalid' and pg_temp.change(ud, '{"bio":"ok","mood":"happy"}') = 'invalid' and pg_temp.change(ud, '[]') = 'invalid' and pg_temp.change(ud, '"bio"') = 'invalid' and pg_temp.change(ud, 'null') = 'invalid' and public.set_profile(ud, null) = 'invalid', null);
  r := r || pg_temp.check_that('a nickname and a tag are as they were: a number is no nickname, a text is no tag', pg_temp.change(ud, '{"nickname":7}') = 'invalid' and pg_temp.change(ud, '{"tag":"7"}') = 'invalid' and pg_temp.change(ud, '{"tag":4.5}') = 'invalid' and pg_temp.change(ud, '{"tag":0}') = 'invalid' and pg_temp.change(ud, '{"tag":10000}') = 'invalid' and pg_temp.change(ud, '{"nickname":""}') = 'invalid' and pg_temp.change(ud, '{"nickname":"A#1"}') = 'invalid', null);
  r := r || pg_temp.check_that('an account with no profile is missing, whatever it asks', pg_temp.change(uc, '{"bio":"hi"}') = 'missing' and pg_temp.change(uz, '{"pronouns":"any"}') = 'missing', null);
  -- The pair, with the fields
  answer := pg_temp.sp(ug, 'Pair', 5) || pg_temp.sp(uh, 'Pair', 6);
  r := r || pg_temp.check_that('two members hold two pairs of one name', answer = 'okok', answer);
  answer := pg_temp.change(uh, '{"nickname":"pair","tag":5,"bio":"I want the pair of Pair#5"}');
  r := r || pg_temp.check_that('a pair that is taken changes nothing else: the change is whole or it is nothing', answer = 'taken' and (select nickname = 'Pair' and tag = 6 and bio is null from public.profiles where user_id = uh), answer);
  answer := pg_temp.change(uh, '{"tag":7,"bio":"Pair#7 now"}');
  r := r || pg_temp.check_that('the tag alone changes with the bio, the nickname stays', answer = 'ok' and (select nickname = 'Pair' and tag = 7 and bio = 'Pair#7 now' from public.profiles where user_id = uh), answer);
  answer := pg_temp.change(uh, '{"nickname":"Pairs"}');
  r := r || pg_temp.check_that('the nickname alone changes, the tag stays', answer = 'ok' and (select nickname = 'Pairs' and tag = 7 from public.profiles where user_id = uh), answer);
  r := r || pg_temp.check_that('a member who signed in has a page that says what they filled in', (select bio = 'Pair#7 now' from public.profile_by_handle('Pairs', 7)), null);
  r := r || pg_temp.check_that('the lookup of the friends still finds a member through it: dropping and making profile_by_handle again broke nothing that reads it (0017)', public.friend_target('Pairs', 7) = uh, coalesce(public.friend_target('Pairs', 7)::text, 'null'));
  when_closed := public.close_account(uh, repeat('c', 64), now() + interval '7 days');
  r := r || pg_temp.check_that('a closed account says nothing of its member to anybody', when_closed is not null and (select count(*) from public.profile_by_handle('Pairs', 7)) = 0, null);
  -- It goes with the account
  select count(*) into n from public.profiles where user_id = ug and bio is null;
  update public.profiles set bio = 'Gone with the account', pronouns = 'any', country = 'US', favorite_games = array['x'] where user_id = ug;
  r := r || pg_temp.check_that('a page says the fields of a member who has not hidden their games either', (select bio = 'Gone with the account' and not hide_history from public.profile_by_handle('Pair', 5)), null);
  delete from auth.users where id = ug;
  r := r || pg_temp.check_that('the four fields go with the account', n = 1 and not exists (select 1 from public.profiles where user_id = ug) and (select count(*) from public.profile_by_handle('Pair', 5)) = 0, null);

  -- 15. The city (migration 0020): a city comes with its country, which has to be the profile's own, and goes with it
  answer := pg_temp.change(ud, '{"country":null,"city":null}');
  answer := answer || pg_temp.change(ud, '{"city":{"id":2996944,"name":"Lyon","country":"FR"}}');
  r := r || pg_temp.check_that('a profile with no country refuses a city', answer = 'okinvalid' and (select city_id is null and city_name is null and city_country is null from public.profiles where user_id = ud), answer);
  answer := pg_temp.change(ud, '{"country":"FR","city":{"id":2996944,"name":"Lyon","country":"FR"}}');
  r := r || pg_temp.check_that('a city is set with its country in one change', answer = 'ok' and (select city_id = 2996944 and city_name = 'Lyon' and city_country = 'FR' and country = 'FR' from public.profiles where user_id = ud), answer);
  r := r || pg_temp.check_that('the lookup says the city, whatever else is hidden', (select city_id = 2996944 and city_name = 'Lyon' and city_country = 'FR' and country = 'FR' from public.profile_by_handle('Dee', tag_a)), null);
  answer := pg_temp.change(ud, '{"bio":"The city stays"}');
  r := r || pg_temp.check_that('a change that does not say the city leaves it as it is', answer = 'ok' and (select city_id = 2996944 and bio = 'The city stays' from public.profiles where user_id = ud), answer);
  answer := pg_temp.change(ud, '{"country":"BE"}') || pg_temp.change(ud, '{"country":null}');
  r := r || pg_temp.check_that('the country cannot change or go while its city stays', answer = 'invalidinvalid' and (select country = 'FR' and city_country = 'FR' from public.profiles where user_id = ud), answer);
  answer := pg_temp.change(ud, '{"country":"BE","city":null}');
  r := r || pg_temp.check_that('the country changes with the city taken away', answer = 'ok' and (select country = 'BE' and city_id is null and city_name is null and city_country is null from public.profiles where user_id = ud), answer);
  answer := pg_temp.change(ud, '{"city":{"id":2996944,"name":"Lyon","country":"FR"}}');
  r := r || pg_temp.check_that('a city of another country than the profile says is refused', answer = 'invalid' and (select city_id is null from public.profiles where user_id = ud), answer);
  answer := pg_temp.change(ud, '{"country":"FR","city":{"id":2996944,"name":"Lyon","country":"FR"}}') || pg_temp.change(ud, '{"country":null,"city":null}');
  r := r || pg_temp.check_that('null takes the city and the country away together', answer = 'okok' and (select country is null and city_id is null and city_name is null and city_country is null from public.profiles where user_id = ud), answer);
  answer := pg_temp.change(ud, '{"country":"FR"}');
  r := r || pg_temp.check_that('the shapes below are tried with a country in place, so that only the city is wrong', answer = 'ok', answer);
  r := r || pg_temp.check_that('a city id is a whole number from 1 to 9 digits', pg_temp.change(ud, '{"city":{"id":0,"name":"Lyon","country":"FR"}}') = 'invalid' and pg_temp.change(ud, '{"city":{"id":-5,"name":"Lyon","country":"FR"}}') = 'invalid' and pg_temp.change(ud, '{"city":{"id":1.5,"name":"Lyon","country":"FR"}}') = 'invalid' and pg_temp.change(ud, '{"city":{"id":"5","name":"Lyon","country":"FR"}}') = 'invalid' and pg_temp.change(ud, '{"city":{"id":1234567890,"name":"Lyon","country":"FR"}}') = 'invalid' and pg_temp.change(ud, '{"city":{"id":null,"name":"Lyon","country":"FR"}}') = 'invalid', null);
  r := r || pg_temp.check_that('a city name is 1 to 100 characters with nothing around it and no control character', pg_temp.change(ud, '{"city":{"id":5,"name":"","country":"FR"}}') = 'invalid' and pg_temp.change(ud, '{"city":{"id":5,"name":" Lyon","country":"FR"}}') = 'invalid' and pg_temp.change(ud, '{"city":{"id":5,"name":"Lyon ","country":"FR"}}') = 'invalid' and pg_temp.change(ud, jsonb_build_object('city', jsonb_build_object('id', 5, 'name', repeat('a', 101), 'country', 'FR'))::text) = 'invalid' and pg_temp.change(ud, '{"city":{"id":5,"name":"Ly\u0007on","country":"FR"}}') = 'invalid' and pg_temp.change(ud, '{"city":{"id":5,"name":"Ly\u2028on","country":"FR"}}') = 'invalid', null);
  r := r || pg_temp.check_that('a city is an object with its three keys, of the right kinds, and no other', pg_temp.change(ud, '{"city":{"id":5,"name":"Lyon"}}') = 'invalid' and pg_temp.change(ud, '{"city":{"id":5,"country":"FR"}}') = 'invalid' and pg_temp.change(ud, '{"city":{"name":"Lyon","country":"FR"}}') = 'invalid' and pg_temp.change(ud, '{"city":{"id":5,"name":"Lyon","country":"FR","pop":1}}') = 'invalid' and pg_temp.change(ud, '{"city":{"id":5,"name":"Lyon","country":"fr"}}') = 'invalid' and pg_temp.change(ud, '{"city":{"id":5,"name":"Lyon","country":"FRA"}}') = 'invalid' and pg_temp.change(ud, '{"city":{"id":5,"name":7,"country":"FR"}}') = 'invalid' and pg_temp.change(ud, '{"city":"Lyon"}') = 'invalid' and pg_temp.change(ud, '{"city":7}') = 'invalid' and pg_temp.change(ud, '{"city":[]}') = 'invalid' and pg_temp.change(ud, '{"city":{}}') = 'invalid', null);
  r := r || pg_temp.check_that('a refused city changes nothing', (select city_id is null and country = 'FR' from public.profiles where user_id = ud), null);
  r := r || pg_temp.check_that('the table says the same whoever writes it: the three are all set or all empty, and the country is the profile''s', pg_temp.refused_with(format('update public.profiles set city_id = 5 where user_id = %L', ud), '23514')
    and pg_temp.refused_with(format('update public.profiles set city_id = 5, city_name = %L where user_id = %L', 'Lyon', ud), '23514')
    and pg_temp.refused_with(format('update public.profiles set city_id = 5, city_name = %L, city_country = %L where user_id = %L', 'Lyon', 'BE', ud), '23514')
    and pg_temp.refused_with(format('update public.profiles set city_id = 0, city_name = %L, city_country = %L where user_id = %L', 'Lyon', 'FR', ud), '23514')
    and pg_temp.refused_with(format('update public.profiles set city_name = %L where user_id = %L', 'Lyon', ud), '23514'), null);

  raise exception 'RESULT %', r;
end
$do$;
