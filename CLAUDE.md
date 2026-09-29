# Play Game Online · monorepo

Tous les jeux de société en ligne d'oré dans un seul dépôt (`aurelienlouvel/play-game-online`), un workspace pnpm.

## Structure
- `template/` — le template de jeu (voir `template/CLAUDE.md` pour l'architecture : moteur, lobby, temps réel Supabase, 3D, /setup, /status)
- `games/<jeu>/` — un jeu = `apps/web` (Next.js), `apps/studio` (Sanity), `packages/engine` (moteur pur TS).
- `games/<jeu>/assets/` — sources (PDF, PSD, visuels HD), ignorées par git
- `packages/` — code partagé par tous les jeux (voir ci-dessous)
- `scripts/` — `new-game.sh`, `go-live.sh`, `run.sh`

## Paquets partagés (`packages/`)
Une modification ici profite à tous les jeux qui les utilisent au prochain déploiement.
- `@pgo/engine-kit` — contrat moteur ↔ web (`GameDefinition`, `Results`…), options de partie (`defaultOptions`, `normalizeOptions`), `EngineError`, `createRng` / `shuffle`. Le moteur d'un jeu le ré-exporte : `export * from "@pgo/engine-kit"`
- `@pgo/ui` — composants shadcn + `cn` : `@pgo/ui/game/<comp>` (thème du jeu), `@pgo/ui/admin/<comp>` (preset luma de /setup et /status), `@pgo/ui/utils`
- `@pgo/studio-kit` — schémas Sanity communs (`settings`, `interface`, `rules`, `texts`, `localeString`…) et `createStudioConfig({ title, projectId, gameTypes })` ; `@pgo/studio-kit/constants` (langues, `FONT_CHOICES`) importable côté web
- `@pgo/site` — référencement : `createMetadata`, `createViewport`, `createRobots`, `createSitemap`, `createManifest`, `gameJsonLd` à partir d'un `SiteConfig` (`lib/site.ts` du jeu)
- Utiliser un paquet dans un jeu : l'ajouter aux `dependencies` (`"@pgo/ui": "workspace:*"`) et à `transpilePackages` dans `next.config.ts` ; pour Tailwind, `@source` vers `packages/ui/src` dans `globals.css`
- `@pgo/core` — socle commun des jeux : serveur (`server/*` : parties Supabase avec verrou de version, joueur, admin, stats, tâches), `lib/*` (api, realtime, settings, rules, i18n), composants (accueil, lobby, contexte de partie, fin de partie, partage, /setup, /status), pages (`pages/game|setup|status`) et routes API (`routes/api/**/route.ts`)
  - Le jeu branche son code via deux alias déclarés dans `next.config.ts` (`turbopack.resolveAlias`) **et** `tsconfig.json` (`paths`) : `@pgo/binding` → `src/binding.ts` (moteur `GAME` + types, constantes de `lib/site.ts`) et `@pgo/binding-ui` → `src/binding-ui.ts` (`Logo`, `Game` = plateau, `captureGamePhoto`)
  - Les fichiers de `app/` sont de simples ré-exports (`export { POST } from "@pgo/core/routes/api/games/[code]/join/route"`) ; les configs de segment (`dynamic`, `revalidate`) restent écrites en toutes lettres dans l'app (Next ne les lit pas à travers un ré-export)
  - Tailwind : `@source` vers `packages/core` dans `globals.css`
  - Utilisé par : template (et donc tout jeu créé avec `new-game`)

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
