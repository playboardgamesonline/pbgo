-- Votes « jouer à la place du joueur absent » : `<empreinte de l'état>:<joueur>`, périmés dès que la partie avance.
alter table public.games add column if not exists takeover_votes text[] not null default '{}';
