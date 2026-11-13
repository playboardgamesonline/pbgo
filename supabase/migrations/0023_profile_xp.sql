-- The experience of a member (XP), on their profile: a whole number, 0 for everybody to begin with, and the only thing the platform stores of a level. The level is worked out from it (`levelOf` of @pbgo/accounts), so that the
-- table of levels can change without a migration and a level can never disagree with the points. Every visitor sees the level as a badge on a profile; only the member sees the points, as a gauge.
--
-- Nothing awards XP yet: the column is the place for it. Whatever does will add to it on the server (service role), like the other columns of `profiles`; the table keeps the shape (a whole number, never negative).
-- No function changes: the profile pages read the column apart from the identity, as they read the details (0018), and a database without this migration answers as for a member with 0 XP.

alter table public.profiles add column if not exists xp integer not null default 0;

alter table public.profiles drop constraint if exists profiles_xp_check;
alter table public.profiles add constraint profiles_xp_check check (xp >= 0);
