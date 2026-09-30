-- Admin « Tasks » : types de tâches (Backlog / Bugs) avec priorité, et retours des joueurs (Feedback).
-- Lu et écrit par le serveur uniquement (service role) : RLS activé sans politique, comme games et tasks.

alter table public.tasks add column if not exists type text not null default 'backlog';
alter table public.tasks add column if not exists priority text not null default 'medium';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_type_check') then
    alter table public.tasks add constraint tasks_type_check check (type in ('backlog', 'bug'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_priority_check') then
    alter table public.tasks add constraint tasks_priority_check check (priority in ('high', 'medium', 'low'));
  end if;
end $$;

create index if not exists tasks_type_idx on public.tasks (type, done);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text not null check (char_length(message) between 1 and 2000),
  nickname text,
  player_id text,
  game_code text,
  page text,
  user_agent text,
  status text not null default 'new' check (status in ('new', 'read', 'archived'))
);

create index if not exists feedback_status_created_at_idx on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;
