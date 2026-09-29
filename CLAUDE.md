# Play Game Online · monorepo

Tous les jeux de société en ligne d'oré dans un seul dépôt (`aurelienlouvel/play-game-online`), un workspace pnpm.

## Structure
- `template/` — le template de jeu (voir `template/CLAUDE.md` pour l'architecture : moteur, lobby, temps réel Supabase, 3D, /setup, /status)
- `games/<jeu>/` — un jeu = `apps/web` (Next.js), `apps/studio` (Sanity), `packages/engine` (moteur pur TS). Exception : `games/hanabi` (app Next à la racine + `studio/`)
- `games/<jeu>/assets/` — sources (PDF, PSD, visuels HD), ignorées par git
- `scripts/` — `new-game.sh`, `go-live.sh`, `run.sh`

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
