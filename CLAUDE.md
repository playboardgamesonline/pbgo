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
- Contenu initial : `scripts/extraire-cartes.py` (PNG depuis le PDF d'impression) puis `scripts/generer-seed-sanity.py` (dossier d'import `data.ndjson` + images) ; les missions non confirmées sont importées en brouillon
- Les missions publiées sont complétées par `MISSIONS_PROVISOIRES` tant qu'il y en a moins de 5 par couleur

## Supabase (temps réel)
- Table `parties` (migration dans `supabase/migrations`), RLS activée sans policy : seul le serveur (clé service role) la lit/écrit
- `etat` = `GameState` complet du moteur (secret) ; les clients reçoivent uniquement `vueJoueur` via `GET /api/parties/[code]`
- Après chaque écriture (verrou optimiste sur `version`), le serveur diffuse `maj` sur le canal `partie:{code}` ; le client refetch sa vue
- Identité joueur = cookie httpOnly `courtisans_joueur`
- Routes : `POST /api/parties`, `GET /api/parties/[code]`, `POST .../rejoindre|quitter|lancer|action|rejouer`

## Principes
- Le serveur est la seule source de vérité ; chaque joueur ne reçoit qu'une vue filtrée (mains, espions, missions cachés).
- Le plateau est rendu en 3D (react-three-fiber) dans `apps/web/src/components/jeu3d` : `disposition.ts` calcule les poses (tapis, piles, domaines, pioche, missions), `scene.tsx` anime chaque carte vers sa pose (même clé = même objet, donc vrai trajet main → tapis), l'interface (bandeau, journal, fin) reste en DOM par-dessus
- Les règles du jeu vivent uniquement dans `packages/engine`.

## Commits

Format gitmoji : `<emoji>(<scope>): <description>`
Scopes : `nextjs` · `studio`

Commiter souvent, à chaque feature significative, pour garder un historique.
