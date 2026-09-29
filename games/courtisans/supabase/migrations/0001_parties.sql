create table if not exists public.parties (
  code text primary key,
  hote_id text not null,
  statut text not null default 'lobby' check (statut in ('lobby', 'jeu', 'fin')),
  joueurs jsonb not null default '[]'::jsonb,
  etat jsonb,
  rejouer text[] not null default '{}',
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parties_updated_at_idx on public.parties (updated_at);

-- Game state holds hidden information: only the server (service role) may read or write it.
alter table public.parties enable row level security;
