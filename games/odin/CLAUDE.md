# Odin Online

Version en ligne du jeu de société **Odin**, sur le même modèle que Courtisans Online.

## Conventions de code
Code en anglais avec peu de commentaires
Mot "métier" en français

## Assets
Fichiers dans `apps/web/public` nommés en anglais, `EN_MAJUSCULES_AVEC_DES_TIRETS_DU_BAS` (ex. `LOGO.webp`, `cards/BACK.webp`, `sounds/HOVER.mp3`), dossiers en anglais minuscules.
Les sources (PDF, PSD, visuels HD) restent dans `../ASSETS`, hors du dépôt.

## Stack Technique
- Nextjs
- Sanity
- Package manager : **pnpm**
- UI : shadcn/ui, Tailwind CSS, motion (motion.dev)
- Temps réel : Supabase (Postgres + Realtime), logique autoritaire côté serveur (routes API Next.js)
- Déploiement : Vercel (auto depuis GitHub, root directory `apps/web`)

## Structure
- `apps/web` — front Next.js
- `apps/studio` — Sanity Studio
- `packages/engine` — moteur de jeu pur TypeScript (règles, tours, score), testé avec Vitest, sans dépendance UI

## Sanity
- Projet `2w4tgwae`, dataset `production`
- Studio autonome dans `apps/studio` (ne pas l'embarquer dans Next.js), déployé sur `odin-online.sanity.studio`
- Studio entièrement en anglais : singletons `interface`, `game`, `rules`, `texts` ; textes localisés via `localeString` / `localeText` / `localeStringList` (`{ fr, en }`), lus côté Next avec `traduire()` (`src/lib/i18n.ts`)
- `pnpm --filter studio schema:deploy` après chaque changement de schéma

## Site
- URL : `https://play-odin-online.vercel.app`
- Nom, titre et description dans `apps/web/src/lib/site.ts`
- Référencement : `layout.tsx` (métadonnées), `robots.ts`, `sitemap.ts`, `manifest.ts`, `icon.png`, `apple-icon.png`, `opengraph-image.png`

## Principes
- Le serveur est la seule source de vérité ; chaque joueur ne reçoit qu'une vue filtrée.
- Les règles du jeu vivent uniquement dans `packages/engine`.

## Commits

Format gitmoji : `<emoji>(<scope>): <description>`
Scopes : `nextjs` · `studio` · `engine`

Commiter souvent, à chaque feature significative, pour garder un historique.
