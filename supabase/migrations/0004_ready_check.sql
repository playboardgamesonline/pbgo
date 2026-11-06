-- The ready check (PLT-107): when the host starts a table it is `starting` for a minute or so, the players come to its board, load it and say they are ready;
-- once all of them have, the game is `playing`. Whoever is not ready when the time is up is unseated and the table goes back to `lobby` for the others.
--
-- `ready_at`: the time each player said they were ready (player id -> ISO time), empty outside `starting`. `ready_deadline`: when the check ends, null outside `starting`.
-- While `starting` the row already holds the game's `state` (set up when the host starts it, with the players seated then): a player's board is drawn from their view of it behind the
-- curtain, and an unseated player sends the table back to the lobby with `state` null again.

alter table public.games drop constraint if exists games_status_check;
alter table public.games add constraint games_status_check check (status in ('lobby', 'starting', 'playing', 'over'));

alter table public.games add column if not exists ready_at jsonb not null default '{}'::jsonb;
alter table public.games add column if not exists ready_deadline timestamptz;
