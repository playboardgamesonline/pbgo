-- Who holds which account at the providers that the hub signs members in with itself (Steam; Epic Games later). Steam speaks OpenID 2.0 and gives a number, not an e-mail address, so it cannot be an identity of Supabase Auth:
-- the hub's own routes sign the member in (`/auth/steam`, `packages/accounts/src/external.ts`) and this table says which member holds which account there. The member is made with an address that can never receive mail and that nobody
-- guesses (`steam-<random>@external.pbgo.invalid`), which the pages never show.
--
-- One row per account at a provider (`subject`: the SteamID64, 17 digits), and at most one account of a provider per member. Written and read by the server only (service role), like the tables of the games: row level security
-- is on without policy, and the public roles have no grant. Deleted with the member (`on delete cascade`).
create table if not exists public.external_identities (
  provider text not null check (provider in ('steam', 'epic')),
  subject text not null check (length(subject) between 1 and 64 and (provider <> 'steam' or subject ~ '^[0-9]{17}$')),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider, subject),
  unique (provider, user_id)
);

alter table public.external_identities enable row level security;

revoke all on table public.external_identities from anon, authenticated;
grant select, insert, update, delete on table public.external_identities to service_role;
