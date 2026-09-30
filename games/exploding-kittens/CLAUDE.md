# Play Game Online · Template

Base commune des jeux de société en ligne (`<slug>-online`). La démo « La Plus Haute » (jeu de plis minimal) montre le contrat moteur ↔ web ; on la remplace par le vrai jeu.

## Conventions de code
- **Tout le code est en anglais**, vocabulaire du jeu compris : fonctions, variables, types, fichiers, dossiers, routes API, URL, tables/colonnes SQL, clés de stockage, codes d'erreur, commentaires.
- **Prévu pour le multilingue** : seuls les textes affichés au joueur sont en français (Sanity `{ fr, en }` lus avec `translate()`, ou textes d'interface dans les composants en attendant des dictionnaires `fr` / `en`). Jamais de mot français dans un identifiant.
- Peu de commentaires, noms explicites.
- Glossaire du jeu (FR → EN), à compléter pour chaque nouveau jeu :
  - partie → `game` · joueur → `player` · pseudo → `nickname` · hôte → `host` · moi → `me`
  - manche → `round` · tour → `turn` · pli → `trick` · main → `hand` · paquet/pioche → `deck` · carte → `card`
  - vue → `view` · état → `state` · résultats → `results` · vainqueur → `winner` · journal → `log`
  - règles → `rules` · réglages → `settings` · annonce → `announcement` · partage → `sharing` · tâche → `task`

## UI admin
- L'admin `/admin` utilise le preset shadcn `b1VlJAwK` (style luma, neutral, Inter, Hugeicons), scopé par la classe `.admin` dans `globals.css`
- Composants dans le paquet partagé `@pbgo/ui/admin/*` (`packages/ui/src/admin`) ; ceux du jeu dans `@pbgo/ui/game/*`. Pour en ajouter : `pnpm dlx shadcn@latest add <comp>` puis déplacer dans `packages/ui/src/admin` (ou `game`) et remplacer les imports `@/lib/utils` par `../utils`
- L'accueil, le lobby et le jeu gardent le thème du jeu (couleurs et polices réglées dans /admin/visual)

## Assets
Fichiers dans `apps/web/public` nommés en anglais, `UPPER_SNAKE_CASE` (ex. `cards/BACK.webp`), dossiers en anglais minuscules.

## Stack technique
- Next.js 16 (App Router, React 19), Tailwind 4, shadcn/ui, motion, sonner
- 3D : three + @react-three/fiber + drei, réglages leva (panneau debug `Shift+D`)
- Temps réel : Supabase (Postgres + Realtime broadcast), logique autoritaire côté serveur (routes API Next.js)
- Sanity (studio autonome `apps/studio`) pour règles/textes/médias
- Vitest pour le moteur · pnpm workspaces · Vercel

## Structure
- `packages/engine` (`@exploding-kittens/engine`) — moteur pur TypeScript, sans UI ; ré-exporte `@pbgo/engine-kit` (paquet partagé à la racine du monorepo)
  - `@pbgo/engine-kit` : `GameDefinition<State, Action, View>` (`setup`, `apply`, `view`, `isOver`, `options`, `clientActions`, `debug`), options de partie déclaratives (`number` / `choice` / `boolean`, `defaultOptions`, `normalizeOptions`), `EngineError`, `createRng` / `shuffle`
  - `demo/` : le jeu démo ; `index.ts` exporte `GAME` = le jeu actif
- `apps/web/src`
  - `server/games.ts` : `createGame`, `newGame`, `updateGame` (verrou optimiste), `publicGame` ; routes `app/api/games/[code]/*`
  - `components/home` : accueil (`home.tsx`) et primitives d'écran (`screen.tsx`)
  - `components/lobby` : `lobby.tsx`, `game-options.tsx` (rendues depuis `GAME.options`, éditables par l'hôte)
  - `components/game` : `game-client.tsx` (lobby → jeu), `game.tsx` (table, annonces, debug), `game-over.tsx`, `sharing.ts`, `preview-sharing.tsx`
  - `components/game3d` : `scene.tsx`, poses (`layout.ts`), `card3d.tsx`, textures, annonces, debug leva
  - `app/(admin)/admin/[[...section]]` : admin (Setup, Tasks, Monitoring — voir le CLAUDE.md racine) ; `app/preview/[kind]` : aperçus de l'admin 
  - Admin protégé par `ADMIN_LOGIN` / `ADMIN_PASSWORD` (`server/admin.ts`), écriture Sanity via `SANITY_API_WRITE_TOKEN` (`server/settings.ts`)
  - `lib/settings.ts` / `lib/settings-server.ts` : réglages du site (titre, description, logo, min/max joueurs, thème, polices, règles PDF) lus depuis Sanity avec les valeurs par défaut de `lib/site.ts`, fournis aux composants client par `useSiteSettings()`
- `apps/studio` — Sanity Studio via `createStudioConfig` de `@pbgo/studio-kit` (singletons communs `settings`, `interface`, `rules`, `texts`) ; seul `schemaTypes/game.ts` est propre au jeu
- `supabase/migrations` — `0001_games.sql`, `0002_tasks.sql`

## Adapter à un nouveau jeu
1. Écrire le moteur dans `packages/engine/src/<game>/` (types, `GameDefinition`, tests) puis `export { myGame as GAME }` dans `index.ts`
2. Déclarer les options de partie dans `options` : le lobby les affiche seul
3. Adapter les valeurs par défaut (`lib/site.ts`, `DEFAULT_THEME` dans `lib/settings.ts`) puis régler le reste dans `/admin` ; adapter `game3d/scene.tsx`, `layout.ts` et `game/game.tsx`
4. Remplacer `__SANITY_PROJECT_ID__` / `__SANITY_STUDIO_HOST__` (fait par `setup-games.sh`)
5. Compléter le glossaire ci-dessus

## Supabase (temps réel)
- Table `games` (`code`, `host_id`, `status`, `players`, `options`, `state`, `replay`, `version`), RLS activée sans policy : seul le serveur (clé service role) la lit/écrit
- `state` = état complet du moteur (secret) ; les clients reçoivent uniquement `GAME.view(state, playerId)` via `GET /api/games/[code]`
- Après chaque écriture, le serveur diffuse `maj` sur `game:{code}` ; le client refetch
- Identité joueur = cookie httpOnly `<slug>_player`
- Routes : `POST /api/games`, `GET /api/games/[code]`, `POST .../join|leave|options|start|action|replay|debug`

## Variables d'environnement
- `pnpm go-live` (`scripts/go-live.sh`) met le repo en ligne (GitHub, Sanity, Vercel) puis lance `pnpm setup:env`
- Le projet Sanity du repo est lu depuis les variables d'env (`apps/studio/.env`, `NEXT_PUBLIC_SANITY_PROJECT_ID`) : ne pas remplacer les placeholders `__SANITY_*__` dans le template
- `pnpm setup:env` (`scripts/setup-env.sh`) les renseigne toutes (questions guidées, secrets masqués) : `.env.local` + Vercel. Ne jamais demander de secret dans le chat

## Principes
- Le serveur est la seule source de vérité ; chaque joueur ne reçoit qu'une vue filtrée
- Les règles du jeu vivent uniquement dans le moteur
- `debug` (START / NEXT TURN / END) désactivé en production sauf `DEBUG_GAMES=1`

## Commits
Format gitmoji : `<emoji>(<scope>): <description>`
Scopes : `nextjs` · `studio` · `engine`

Commiter souvent, à chaque feature significative.
