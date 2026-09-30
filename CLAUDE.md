# Play Game Online · monorepo

Tous les jeux de société en ligne d'oré dans un seul dépôt (`aurelienlouvel/play-game-online`), un workspace pnpm.

## Structure
- `template/` — le template de jeu (voir `template/CLAUDE.md` pour l'architecture : moteur, lobby, temps réel Supabase, 3D, admin /admin)
- `games/<jeu>/` — un jeu = `apps/web` (Next.js), `apps/studio` (Sanity), `packages/engine` (moteur pur TS).
- `games/<jeu>/assets/` — sources (PDF, PSD, visuels HD), ignorées par git
- `packages/` — code partagé par tous les jeux (voir ci-dessous)
- `scripts/` — `new-game.sh`, `go-live.sh`, `run.sh`

## Paquets partagés (`packages/`)
Une modification ici profite à tous les jeux qui les utilisent au prochain déploiement.
- `@pgo/engine-kit` — contrat moteur ↔ web (`GameDefinition`, `Results`…), options de partie (`defaultOptions`, `normalizeOptions`), `EngineError`, `createRng` / `shuffle`. Le moteur d'un jeu le ré-exporte : `export * from "@pgo/engine-kit"`
- `@pgo/ui` — composants shadcn + `cn` : `@pgo/ui/game/<comp>` (thème du jeu), `@pgo/ui/admin/<comp>` (preset luma de l'admin /admin), `@pgo/ui/utils`
- `@pgo/studio-kit` — schémas Sanity communs (`settings`, `interface`, `rules`, `texts` via `createTexts(extra)`, `localeString`…) et `createStudioConfig({ title, projectId, gameTypes })` (un type du jeu de même nom remplace le commun) ; `@pgo/studio-kit/constants` (langues, `FONT_CHOICES`) importable côté web
- `@pgo/site` — référencement : `createMetadata`, `createViewport`, `createRobots`, `createSitemap`, `createManifest`, `gameJsonLd` à partir d'un `SiteConfig` (`lib/site.ts` du jeu)
- Utiliser un paquet dans un jeu : l'ajouter aux `dependencies` (`"@pgo/ui": "workspace:*"`) et à `transpilePackages` dans `next.config.ts` ; pour Tailwind, `@source` vers `packages/ui/src` dans `globals.css`
- `@pgo/core` — socle commun des jeux : serveur (`server/*` : parties Supabase avec verrou de version, joueur, admin, stats, tâches), `lib/*` (api, realtime, settings, rules, i18n), composants (accueil, lobby, contexte de partie, fin de partie, partage, admin), pages (`pages/game|admin|preview`, `setup`/`status` = redirections) et routes API (`routes/api/**/route.ts`)
  - Le jeu branche son code via trois alias déclarés dans `next.config.ts` (`turbopack.resolveAlias`) **et** `tsconfig.json` (`paths`) :
    - `@pgo/binding` → `src/binding.ts` : moteur (`GAME`, types), constantes de `lib/site.ts` ; facultatif : `SOUNDS`, `DEFAULT_SKIN`, `SETTINGS_DEFAULTS`, `ERROR_MESSAGES` (textes des erreurs du moteur), `SANITY_PROJECT_ID`
    - `@pgo/binding-ui` → `src/binding-ui.ts` : `Logo`, `Game` (plateau), `captureGamePhoto` ; facultatif : `RulesButton` (règles propres au jeu)
    - `@pgo/binding-server` → `src/binding-server.ts` (serveur uniquement), tout facultatif : `loadSetupData` (données de `GAME.setup`), `loadGameData` (prop `data` du plateau), `loadRules`
  - Écrans et partie standard (repris de Courtisans) : `Screen` (accueil, invitation, lobby), `GameHud` + `Ticker` + `groupTurns` + `useAnnouncements` (partie), `GameOver` (`renderDetail` pour le détail des points), son (`lib/sound.ts`, `SoundButton`, `SoundEngine`), `DesktopOnly`, panneau debug leva — le tout monté par `AppShell` dans le layout
  - Habillage (`lib/skin.ts`, `loadSkin`, `useSkin`, `useText`) : Sanity `interface` (décor haut/bas, personnage, motif, picto de l'hôte, couleurs des joueurs, ordinateur uniquement) + `texts` (intro de l'accueil, phrases de victoire, libellés d'interface `UI_TEXTS` de `@pgo/studio-kit/constants`) ; valeurs par défaut du jeu dans `DEFAULT_SKIN`
  - Les fichiers de `app/` sont de simples ré-exports (`export { POST } from "@pgo/core/routes/api/games/[code]/join/route"`) ; les configs de segment (`dynamic`, `revalidate`) restent écrites en toutes lettres dans l'app (Next ne les lit pas à travers un ré-export)
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

## Admin (`/admin`, tout en anglais)
- Barre latérale (`lib/admin-nav.ts`) : **Setup** (Identity, Mechanics, Visual, Audio, Copy) · **Tasks** (Launch, Backlog, Bugs, Feedback) · **Monitoring** (Games, Audience, Health). Une seule route par app : `app/(admin)/admin/[[...section]]/page.tsx` → `@pgo/core/pages/admin`.
- Données Setup : `server/settings.ts` (`readAdminData`, `saveSection(section, values)`, `uploadAsset(slot, file)`), routes `PUT/GET/POST /api/admin/settings` et `/api/admin/upload/[slot]`. Documents Sanity : `settings` (Identity, Mechanics, couleurs et polices), `interface` (images de Visual, couleurs des joueurs, desktopOnly), `audio` (musiques, ambiance, effets, volumes), `texts` (Copy, dont `errorMessages`).
- Conversions à l'envoi (`server/convert.ts`) : images → WebP (SVG gardé), favicon → PNG 512, image de partage → JPG 1200×630, polices TTF/OTF → WOFF2 (wawoff2). Sons : MP3, 4 Mo max.
- Aperçus : iframe sur `/preview/home` et `/preview/game` (admin seulement, partie fictive), brouillon envoyé par `postMessage` (`lib/preview.ts`, `components/preview-bridge.tsx`) ; les appels API y sont neutralisés.
- Favicon / image de partage : `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx` → `@pgo/core/metadata/images` (fichier envoyé dans Identity, sinon généré depuis le logo / l'habillage).
- Sons : `lib/sound-config.ts` (types, sons déclarés par le jeu), `lib/audio-server.ts` (`loadAudio` fusionne Sanity `audio`), passé à `AppShell` (`sounds`). Admin › Audio › « Import into Sanity » envoie les fichiers de /public/sounds.
- Tasks : table `tasks` (colonnes `type` backlog|bug et `priority`), table `feedback` (bouton « Donner votre avis » du jeu, `POST /api/feedback`) — migration `…_admin_tasks_feedback.sql`. Launch = liste vérifiée (`server/launch.ts`).
- Options du moteur : défauts et options masquées réglés dans Mechanics (`settings.options`, `gameOptions()` dans `lib/settings.ts`).
