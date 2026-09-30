-- Project to-do list (/to-do page), read and written by the server only (service role).
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

insert into public.tasks (text, category, sort_order) values
  ('Brancher un 2e jeu sur le template et remonter ici ce qui manque', 'Template', 1),
  ('Multilingue : sortir les textes UI des composants vers des dictionnaires fr / en', 'Template', 1.5),
  ('Options de partie spécifiques : ajouter les types manquants (liste de variantes, plage min/max, texte)', 'Template', 2),
  ('Écran d''accueil : habillage par jeu (décor, logo, intro) piloté par Sanity', 'Template', 3),
  ('Plateau 3D : extraire des briques réutilisables (main, pioche, défausse, zones joueurs)', 'Template', 4),
  ('Script de génération d''un nouveau jeu depuis le template (renommage, Sanity, Vercel)', 'Template', 5),
  ('Tester une vraie partie de bout en bout à 2, 3 et 6 joueurs', 'Fiabilité multijoueur', 1),
  ('Joueur qui quitte ou reste inactif en pleine partie : délai puis coup automatique ou exclusion', 'Fiabilité multijoueur', 2),
  ('Reconnexion / rafraîchissement en cours de partie + indicateur « déconnecté »', 'Fiabilité multijoueur', 3),
  ('Message clair si une action est refusée et resynchronisation automatique', 'Fiabilité multijoueur', 4),
  ('Mesurer les FPS sur un portable moyen (compteur du debug)', 'Performance', 1),
  ('Rendu 3D à la demande, limite de résolution, shaders allégés', 'Performance', 2),
  ('Ne pas charger le panneau de debug (leva) en production', 'Performance', 3),
  ('Décider : blocage propre du mobile ou version tablette / portrait', 'Mobile', 1),
  ('Zoom sur une carte au survol ou appui long', 'UX de jeu', 1),
  ('Première partie guidée (3-4 bulles d''aide)', 'UX de jeu', 2),
  ('Mode « moins d''animations » (ouverture et fin raccourcies)', 'UX de jeu', 3),
  ('Lobby : statut « prêt », exclusion par l''hôte, lien d''invitation plus visible', 'Lobby & social', 1),
  ('Mode spectateur, emotes / réactions', 'Lobby & social', 2),
  ('Tests de bout en bout (créer, rejoindre, jouer, fin, rejouer)', 'Qualité', 1),
  ('Limiter le nombre de requêtes sur l''API (rate limit)', 'Qualité', 2),
  ('Version anglaise (les champs Sanity sont déjà bilingues)', 'Qualité', 3),
  ('Accessibilité : contraste, clavier dans le lobby, les règles et les scores', 'Qualité', 4),
  ('Son : mixage, sons par action, musique de fin', 'Son (en dernier)', 1);
