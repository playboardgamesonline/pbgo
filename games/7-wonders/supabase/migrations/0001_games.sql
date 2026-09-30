create table if not exists public.games (
  code text primary key,
  host_id text not null,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'over')),
  players jsonb not null default '[]'::jsonb,
  options jsonb not null default '{}'::jsonb,
  state jsonb,
  replay text[] not null default '{}',
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists games_updated_at_idx on public.games (updated_at);

-- Game state holds hidden information: only the server (service role) may read or write it.
alter table public.games enable row level security;
