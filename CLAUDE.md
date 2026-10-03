# Play Game Online · monorepo

Tous les jeux de société en ligne d'oré dans un seul dépôt (`aurelienlouvel/play-board-games-online`), un workspace pnpm.

Migrer vers un autre compte : voir `MIGRATION.md`.

## Structure
- `template/` — le template de jeu (voir `template/CLAUDE.md` pour l'architecture : moteur, lobby, temps réel Supabase, 3D, admin /admin)
- `games/<jeu>/` — un jeu = `apps/web` (Next.js), `apps/studio` (Sanity), `packages/engine` (moteur pur TS).
- `games/<jeu>/assets/` — sources (PDF, PSD, visuels HD), ignorées par git
- `packages/` — code partagé par tous les jeux (voir ci-dessous)
- `scripts/` — `new-game.sh`, `go-live.sh`, `run.sh`

## Paquets partagés (`packages/`)
Une modification ici profite à tous les jeux qui les utilisent au prochain déploiement.
- `@pbgo/engine-kit` — contrat moteur ↔ web (`GameDefinition`, `Results`…), options de partie (`defaultOptions`, `normalizeOptions`), `EngineError`, `createRng` / `shuffle`. Le moteur d'un jeu le ré-exporte : `export * from "@pbgo/engine-kit"`
- `@pbgo/ui` — composants shadcn + `cn` : `@pbgo/ui/game/<comp>` (thème du jeu), `@pbgo/ui/admin/<comp>` (preset luma de l'admin /admin), `@pbgo/ui/utils`
- `@pbgo/studio-kit` — schémas Sanity communs (`settings`, `interface`, `rules`, `texts` via `createTexts(extra)`, `localeString`…) et `createStudioConfig({ title, projectId, gameTypes })` (un type du jeu de même nom remplace le commun) ; `@pbgo/studio-kit/constants` (langues, `FONT_CHOICES`) importable côté web
- `@pbgo/site` — référencement : `createMetadata`, `createViewport`, `createRobots`, `createSitemap`, `createManifest`, `gameJsonLd` à partir d'un `SiteConfig` (`lib/site.ts` du jeu)
  - **`noindex` par défaut** : tant que `INDEXABLE` (jeux sur `@pbgo/core` : `export const INDEXABLE` dans `lib/site.ts`, transmis à `createRobotsMeta`, `createRobots`, `createSitemap`) ou `SiteConfig.indexable` (jeux « coquille ») n'est pas `true`, les pages portent `noindex`, le sitemap est vide et robots.txt n'annonce pas de sitemap (l'exploration reste permise, sinon les moteurs ne liraient pas le `noindex`). Passer à `true` à la mise en ligne du jeu, avec la liste `pnpm vercel:ignore-builds <jeux en ligne>` : un projet hors liste ne se reconstruit pas, donc ne reçoit un changement qu'après un déploiement manuel. Seul Courtisans est indexable.
- Utiliser un paquet dans un jeu : l'ajouter aux `dependencies` (`"@pbgo/ui": "workspace:*"`) et à `transpilePackages` dans `next.config.ts` ; pour Tailwind, `@source` vers `packages/ui/src` dans `globals.css`
- `@pbgo/core` — socle commun des jeux : serveur (`server/*` : parties Supabase avec verrou de version, joueur, admin, stats, tâches), `lib/*` (api, realtime, settings, rules, i18n), composants (accueil, lobby, contexte de partie, fin de partie, partage, admin), pages (`pages/game|admin|preview`, `setup`/`status` = redirections) et routes API (`routes/api/**/route.ts`)
  - Le jeu branche son code via trois alias déclarés dans `next.config.ts` (`turbopack.resolveAlias`) **et** `tsconfig.json` (`paths`) :
    - `@pbgo/binding` → `src/binding.ts` : moteur (`GAME`, types), constantes de `lib/site.ts` ; facultatif : `SOUNDS`, `DEFAULT_SKIN`, `SETTINGS_DEFAULTS`, `ERROR_MESSAGES` (textes des erreurs du moteur), `SANITY_PROJECT_ID`
    - `@pbgo/binding-ui` → `src/binding-ui.ts` : `Logo`, `Game` (plateau), `captureGamePhoto` ; facultatif : `RulesButton` (règles propres au jeu)
    - `@pbgo/binding-server` → `src/binding-server.ts` (serveur uniquement), tout facultatif : `loadSetupData` (données de `GAME.setup`), `loadGameData` (prop `data` du plateau), `loadRules`
  - Écrans et partie standard (repris de Courtisans) : `Screen` (accueil, invitation, lobby), `GameHud` + `Ticker` + `groupTurns` + `useAnnouncements` (partie), `GameOver` (`renderDetail` pour le détail des points), son (`lib/sound.ts`, `SoundButton`, `SoundEngine`), `DesktopOnly`, panneau debug leva — le tout monté par `AppShell` dans le layout
  - Habillage (`lib/skin.ts`, `loadSkin`, `useSkin`, `useText`) : Sanity `interface` (décor haut/bas, personnage, motif, picto de l'hôte, couleurs des joueurs, ordinateur uniquement) + `texts` (intro de l'accueil, phrases de victoire, libellés d'interface `UI_TEXTS` de `@pbgo/studio-kit/constants`) ; valeurs par défaut du jeu dans `DEFAULT_SKIN`
  - Les fichiers de `app/` sont de simples ré-exports (`export { POST } from "@pbgo/core/routes/api/games/[code]/join/route"`) ; les configs de segment (`dynamic`, `revalidate`) restent écrites en toutes lettres dans l'app (Next ne les lit pas à travers un ré-export)
  - Joueur absent : après `settings.turnTimeout` (60 s par défaut, réglable dans Admin › Mechanics) sans écriture, `StalledTurn` propose aux autres de jouer à sa place (route `/takeover`, qui utilise `GAME.autoPlay` ou `GAME.debug.turn` et `GAME.activePlayer`)
  - Écritures concurrentes : `updateGame` réessaie jusqu'à 8 fois avec une attente aléatoire croissante
  - Tailwind : `@source` vers `packages/core` dans `globals.css` ; police d'ambiance (annonces, intro) : variable CSS `--font-accent`
  - Utilisé par : template (et donc tout jeu créé avec `new-game`), Courtisans

## Commandes (depuis la racine)
- `pnpm install` — une seule fois pour tout le monorepo
- `pnpm dev <jeu>` / `pnpm dev:studio <jeu>` — ex. `pnpm dev skull-king`
- `pnpm --filter <jeu>-web build` · `pnpm --filter @<jeu>/engine test`
- `pnpm new-game <jeu>` — copie `template/` dans `games/<jeu>` et renomme les paquets
- `pnpm go-live <jeu>` — projet Sanity + studio, projet Vercel relié au monorepo (root `games/<jeu>/apps/web`) + domaine `play-<jeu>-online.vercel.app`, variables d'env

## Nommage des paquets
`<jeu>-web`, `<jeu>-studio`, `@<jeu>/engine` (template : `template-web`, `template-studio`, `@game/engine`). Toujours cibler un paquet avec `--filter`, jamais `--filter web`.

## Déploiement
- Un projet Vercel par jeu, tous reliés à ce dépôt ; chaque projet a son root directory (`games/<jeu>/apps/web`) et ne se reconstruit que si ses fichiers changent
- Un projet Sanity par jeu (`<jeu>.sanity.studio`), un projet Supabase par jeu ; secrets dans `apps/web/.env.local` et sur Vercel, jamais commités
- Push sur `main` = mise en production des jeux touchés

## Faire évoluer le socle
Les jeux créés depuis le template en sont une copie : une amélioration faite dans `template/` se reporte dans les jeux concernés (même chemin de fichier) ; à terme, le code commun sortira dans `packages/` partagés.

## Commits
Identité git : `oré <louvel.aurelien.perso@gmail.com>` (compte GitHub/Vercel du projet) — jamais l'adresse pro, sinon Vercel bloque le déploiement.
Gitmoji `<emoji>(<scope>): <description>` · scopes : `<jeu>`, `template`, `repo` (ex. `✨(skull-king): …`, `🔧(repo): …`)

## Langues (FR / EN / ES / DE)

- Langues : `LANGUAGES` dans `packages/studio-kit/src/constants.ts` (source unique, alimente aussi les champs Sanity `localeString`). Ajouter une langue = l'ajouter là, puis les traductions ci-dessous (TypeScript signale ce qui manque).
- Langue du visiteur : cookie `pbgo-locale` (sélecteur dans la barre d'outils), sinon `Accept-Language` (langue non gérée : anglais ; pas d'en-tête : français). Même URL pour tous ; `getLocale()` (`lib/locale-server.ts`) lit cookie et en-têtes, donc les pages sont rendues à la demande (données Sanity toujours en cache 60 s).
- Textes communs : français dans `UI_TEXTS`, traductions par défaut dans `packages/studio-kit/src/translations.ts` (libellés + erreurs). Un texte saisi dans l'admin (Copy) passe avant, langue par langue ; sans saisie dans la langue, la traduction du code s'applique (jamais le français de Sanity).
- Un jeu fournit ses textes non français via l'export facultatif `I18N` de `@pbgo/binding` (`skin`, `description`, `authors`, `errors`) ; Courtisans y ajoute `lib/i18n.ts` (plateau, missions, familles, rôles) et `lib/i18n-rules.ts` (règles).
- Identité (description, « un jeu de »), PDF des règles et Copy s'éditent par langue dans l'admin ; le nom du jeu et le suffixe d'onglet sont communs.
- Règles : Sanity dans la langue, sinon Sanity en français, sinon règles par défaut de la langue.

## Admin (`/admin`, tout en anglais)
- Barre latérale (`lib/admin-nav.ts`) : **Setup** (Identity, Mechanics, Visual, Audio, Copy) · **Tasks** (Launch, Backlog, Bugs, Feedback) · **Monitoring** (Games, Audience, Health). Une seule route par app : `app/(admin)/admin/[[...section]]/page.tsx` → `@pbgo/core/pages/admin`.
- Données Setup : `server/settings.ts` (`readAdminData`, `saveSection(section, values)`, `uploadAsset(slot, file)`), routes `PUT/GET/POST /api/admin/settings` et `/api/admin/upload/[slot]`. Documents Sanity : `settings` (Identity, Mechanics, couleurs et polices), `interface` (images de Visual, couleurs des joueurs, desktopOnly), `audio` (musiques, ambiance, effets, volumes), `texts` (Copy, dont `errorMessages`).
- Conversions à l'envoi (`server/convert.ts`) : images → WebP (SVG gardé), favicon → PNG 512, image de partage → JPG 1200×630, polices TTF/OTF → WOFF2 (wawoff2). Sons : MP3, 4 Mo max.
- Aperçus : iframe sur `/preview/home` et `/preview/game` (admin seulement, partie fictive), brouillon envoyé par `postMessage` (`lib/preview.ts`, `components/preview-bridge.tsx`) ; les appels API y sont neutralisés.
- Favicon / image de partage : `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx` → `@pbgo/core/metadata/images` (fichier envoyé dans Identity, sinon généré depuis le logo / l'habillage).
- Sons : `lib/sound-config.ts` (types, sons déclarés par le jeu), `lib/audio-server.ts` (`loadAudio` fusionne Sanity `audio`), passé à `AppShell` (`sounds`). Admin › Audio › « Import into Sanity » envoie les fichiers de /public/sounds.
- Joueur absent : `POST /api/games/[code]/takeover` = vote à l'unanimité des autres joueurs (colonne `games.takeover_votes`, entrées `<empreinte de l'état>:<joueur>`, périmées dès qu'un coup est joué) ; migration `…_takeover_votes.sql` à appliquer sur chaque schéma de jeu (sinon les lectures de `games` échouent).
- Tasks : table `tasks` (colonnes `type` backlog|bug et `priority`), table `feedback` (bouton « Donner votre avis » du jeu, `POST /api/feedback`) — migration `…_admin_tasks_feedback.sql`. Launch = liste vérifiée (`server/launch.ts`).
- Options du moteur : défauts et options masquées réglés dans Mechanics (`settings.options`, `gameOptions()` dans `lib/settings.ts`).

## Nouveau jeu en une commande

`pnpm add-game <slug> [--push]` enchaîne new-game, go-live (Sanity, Vercel, domaine, studio) et setup-env en mode automatique : schéma Supabase du jeu créé dans le projet partagé, migrations appliquées, schéma exposé, token Sanity créé, compte admin et variables poussés sur Vercel.

Le mode automatique s'active si `~/.config/pbgo/secrets.env` existe (hors repo, `chmod 600`) :

```
ADMIN_LOGIN=...
ADMIN_PASSWORD=...
SUPABASE_ACCESS_TOKEN=...
SUPABASE_PROJECT_REF=...
```

Un seul projet Supabase pour tous les jeux : un schéma Postgres par jeu (`NEXT_PUBLIC_SUPABASE_SCHEMA`, `public` pour Courtisans, `g_<jeu>` pour les autres). Sans `SUPABASE_PROJECT_REF`, le projet « pbgo » est trouvé ou créé.

Facultatifs : `SUPABASE_ORG_ID`, `SUPABASE_REGION` (création du projet partagé), `VERCEL_TOKEN`, `VERCEL_TEAM_ID`. Ne jamais mettre ces valeurs dans le repo.

## Supabase partagé : état

Projet partagé : celui de Courtisans (`SUPABASE_PROJECT_REF`). Courtisans reste dans le schéma `public` ; les autres jeux ont chacun leur schéma `g_<jeu>` (déjà créé, tables games, tasks, feedback, exposé à l'API). Chaque jeu a `scripts/setup-env.sh` : `pnpm setup-env <jeu>` ou `pnpm setup-env --all` renseigne URL, clés, schéma, admin et pousse les variables sur Vercel. L'ancien projet `play-game-online-template` n'est plus utilisé par les jeux.

## Interface de partie (chat, menu, couronne, fin)

- Menu des réglages (`components/toolbar.tsx`) : un bouton à droite du logo (en haut à droite de l'accueil) ouvre règles, son, feedback et langue.
- Chat (`components/game/chat.tsx`, monté par `GameHud`) : diffusion temps réel Supabase sans stockage, pseudos dans la couleur du joueur, fondu des anciens messages.
- Couronne du tour : à gauche du pseudo du joueur actif, sans déplacement. Template : `game3d/crown.tsx` (`TurnCrown`, icône `hostIcon` de l'habillage ou couronne dessinée) ; Courtisans : `CrownMark` avec son pictogramme.
- Missions de Courtisans : posées face cachée à droite de chaque plateau (`missionRestPose` dans `layout.ts`, réglages `MISSION_REST`), retournées au clic.
- Fin de partie : tableau centré, lien « masquer / afficher » souligné au-dessus du bouton REJOUER centré en bas.
