# Courtisans Online

Version en ligne du jeu de société **Courtisans** (Catch Up Games).

## Conventions de code
Code en anglais avec peu de commentaires
Mot "métier" en français

Exemples de mots métier gardés en français : `courtisan`, `famille`, `role`, `mission`, `domaine`, `tableDeLaReine`, `lumiere`, `disgrace`, `noble`, `espion`, `assassin`, `garde`, `pioche`, `chateau`.

## Stack Technique
- Nextjs
- Sanity
- Package manager : **pnpm**
- UI : shadcn/ui, Tailwind CSS, motion (motion.dev)
- Temps réel : Supabase (Postgres + Realtime), logique autoritaire côté serveur (routes API Next.js)
- Déploiement : Vercel (auto depuis GitHub)

## Structure
- `apps/web` — front Next.js
- `apps/studio` — Sanity Studio (médias, familles, rôles, courtisans, missions)
- `packages/engine` — moteur de jeu pur TypeScript (règles, tours, score, missions), testé avec Vitest, sans dépendance UI. Réutilisable pour une V2 en react-three-fiber.

## Sanity
- Projet `2lo2f5sv`, dataset `production`
- Studio autonome dans `apps/studio` (ne pas l'embarquer dans Next.js)
- Types de documents : `reglages` (singleton), `famille`, `role`, `courtisan`, `mission`, `chateau` ; objet récursif `condition` (règle low code des missions, calqué sur `Condition` du moteur)
- Les champs `cle` de `famille` / `role` font le lien avec les clés du moteur
- Requêtes GROQ dans `apps/web/src/sanity/queries.ts` avec `defineQuery`, puis `pnpm --filter studio typegen` pour régénérer `apps/web/src/sanity/types.ts`
- `pnpm --filter studio schema:deploy` après chaque changement de schéma

## Principes
- Le serveur est la seule source de vérité ; chaque joueur ne reçoit qu'une vue filtrée (mains, espions, missions cachés).
- Le rendu du plateau passe par des « slots » de position pour pouvoir basculer en 3D plus tard.
- Les règles du jeu vivent uniquement dans `packages/engine`.

## Commits

Format gitmoji : `<emoji>(<scope>): <description>`
Scopes : `nextjs` · `studio`

Commiter souvent, à chaque feature significative, pour garder un historique.
