-- Project to-do list (/setup, onglet « À faire »), read and written by the server only (service role).
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  category text not null default 'Général',
  done boolean not null default false,
  sort_order double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_category_sort_order_idx on public.tasks (category, sort_order);

alter table public.tasks enable row level security;
