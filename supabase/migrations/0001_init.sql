-- One Supabase project for every game of playboardgamesonline.app: each row carries its game in `game`
-- (the slug of packages/games/src/registry.ts), and every query filters on it.
-- Read and written by the server only (service role): row level security on, no policy.

create table if not exists public.games (
  game text not null check (game ~ '^[a-z0-9-]+$'),
  code text not null,
  host_id text not null,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'over')),
  players jsonb not null default '[]'::jsonb,
  options jsonb not null default '{}'::jsonb,
  -- Engine state: it holds hidden information (hands, decks), so it never leaves the server as is
  state jsonb,
  replay text[] not null default '{}',
  -- Votes to play for an absent player: `<state fingerprint>:<player>`, stale as soon as the game moves on
  takeover_votes text[] not null default '{}',
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game, code)
);

create index if not exists games_game_created_at_idx on public.games (game, created_at desc);
create index if not exists games_updated_at_idx on public.games (updated_at);

alter table public.games enable row level security;

-- Admin › Tasks (Backlog, Bugs) of each game
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game ~ '^[a-z0-9-]+$'),
  text text not null,
  category text not null default 'General',
  type text not null default 'backlog' check (type in ('backlog', 'bug')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  done boolean not null default false,
  sort_order double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_game_category_sort_order_idx on public.tasks (game, category, sort_order);
create index if not exists tasks_game_type_done_idx on public.tasks (game, type, done);

alter table public.tasks enable row level security;

-- Admin › Feedback: the players' "Give feedback" button of each game
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game ~ '^[a-z0-9-]+$'),
  created_at timestamptz not null default now(),
  type text not null default 'review' check (type in ('review', 'bug', 'suggestion', 'other')),
  message text not null check (char_length(message) between 1 and 2000),
  email text check (email is null or char_length(email) <= 254),
  -- Path of the screenshot in the `feedback` bucket: `<game>/<uuid>.webp`
  screenshot text,
  -- HMAC of the sender's IP (send limits only, the IP itself is never stored)
  ip_hash text,
  nickname text,
  player_id text,
  game_code text,
  page text,
  user_agent text,
  status text not null default 'new' check (status in ('new', 'read', 'archived'))
);

create index if not exists feedback_game_status_created_at_idx on public.feedback (game, status, created_at desc);
create index if not exists feedback_game_player_created_at_idx on public.feedback (game, player_id, created_at desc);
create index if not exists feedback_ip_hash_created_at_idx on public.feedback (ip_hash, created_at desc);

alter table public.feedback enable row level security;

-- Feedback screenshots: private bucket (no public URL), WebP only, 3 MB at most, server only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback', 'feedback', false, 3145728, array['image/webp'])
on conflict (id) do nothing;
