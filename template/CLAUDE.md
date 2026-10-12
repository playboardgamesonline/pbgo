# Play Board Games Online · Template

Shared base of the online board games. `pnpm new-game <slug>` copies this folder to `games/<slug>`. The demo game "La Plus Haute" (a minimal trick-taking game) shows the engine ↔ web contract; a new game replaces it.

The template is itself a game of the single app `apps/web`: `@pbgo-game/template`, served at `/template` (not live, so playable outside production only).

## Code conventions
- **All code is in English**, the game's vocabulary included: functions, variables, types, files, folders, API routes, URLs, SQL tables and columns, storage keys, error codes, comments.
- **Multilingual by design**: only player-facing texts are in French (or another language). They live in Sanity (`localeString` / `localeText` fields), in `I18N` (see `@pbgo/core/lib/binding`) or in the game's defaults. Never a French word in an identifier.
- Few comments, explicit names.
- Game glossary (FR → EN), to extend for each new game:
  - partie → `game` · joueur → `player` · pseudo → `nickname` · hôte → `host` · moi → `me`
  - manche → `round` · tour → `turn` · pli → `trick` · main → `hand` · paquet/pioche → `deck` · carte → `card`
  - vue → `view` · état → `state` · résultats → `results` · vainqueur → `winner` · journal → `log`
  - règles → `rules` · réglages → `settings` · annonce → `announcement` · partage → `sharing` · tâche → `task`

## Structure
- `package.json` — `@pbgo-game/template`, the binding package that `@pbgo/games` loads on demand
  - `src/index.ts` — shared by the server and the client: engine `GAME`, site constants (`src/lib/site.ts`); optional `SOUNDS`, `I18N`, `DEFAULT_SKIN`, `SETTINGS_DEFAULTS`, `ERROR_MESSAGES`, `REACTIONS`, `STUDIO_URL`
  - `src/ui.tsx` — client components: `Logo`, `Game` (the board, loaded with the first game so the home page does not pull in three.js)
  - `src/server.ts` — server only: everything of `index.ts` plus the optional `loadSetupData` (data given to `GAME.setup`), `loadGameData` (`data` prop of the board), `ROUTES` (the game's own API routes, `/api/<slug>/games/<code>/<route>`), `SEO`
  - `src/runtime.tsx` — the game's client runtime (`styles.css`, fonts, `BindingProvider`), mounted by the `[game]` layout of apps/web for this game only
  - `src/lib/site.ts` — `SLUG`, `asset()` (URL of a file of `apps/web/public/<slug>`), name, tagline, description, keywords, author, contact
  - `src/components/game` — the board (`game.tsx`: table, announcements, debug)
  - `src/components/game3d` — react-three-fiber scene (`layout.ts` computes the poses, `scene.tsx` moves each card to its pose, `card3d.tsx`, textures, aura, crown, photo for sharing)
- `packages/engine` — `@template/engine`, pure TypeScript engine (no UI), tested with Vitest; re-exports `@pbgo/engine-kit`
  - `@pbgo/engine-kit`: `GameDefinition<State, Action, View>` (`setup`, `apply`, `view`, `isOver`, `options`, `clientActions`, `debug`), declarative game options (`number` / `choice` / `boolean`, `defaultOptions`, `normalizeOptions`), `EngineError`, `createRng` / `shuffle`
  - `src/demo/` is the demo game; `src/index.ts` exports `GAME` = the active game
- `apps/studio` — `template-studio`, Sanity Studio built with `createStudioConfig` of `@pbgo/studio-kit` (shared singletons `settings`, `interface`, `rules`, `texts`); only `schemaTypes/game.ts` is the game's own
- Everything else (home, lobby, game page, chat, game over, sharing, admin, API routes) comes from `@pbgo/core` and is the same for every game

## Assets
Files in `apps/web/public/<slug>/` (served at `/<slug>/...`), named in English `UPPER_SNAKE_CASE` (e.g. `cards/BACK.webp`), folders in lowercase English. Build their URLs with `asset()` from `src/lib/site.ts`.

## Admin UI
- `/<slug>/admin` uses the PBGO platform design system (black and white, dark only, Geist, shadcn preset `beEgoY8u` adapted), scoped by the `.platform` class. The reference of every token and component is `/design` (apps/web)
- Components live in the shared package `@pbgo/ui/platform/*` (`packages/ui/src/platform`), the game's in `@pbgo/ui/game/*`. To add one: `pnpm dlx shadcn@latest add <comp>`, move it to `packages/ui/src/platform` (or `game`), replace the `@/lib/utils` imports with `../utils`, and keep it dark-only and token-only (no `dark:` variant, no colour, font or size of its own; see "Design system" in the root `CLAUDE.md`)
- The home page, the lobby and the board keep the game's theme (colors and fonts set in Admin › Visual)

## Tech stack
- Next.js 16 (App Router, React 19), Tailwind 4, shadcn/ui, motion, sonner
- 3D: three + @react-three/fiber + drei, leva settings (debug panel `Shift+D`)
- Realtime: Supabase (Postgres + Realtime broadcast), authoritative logic on the server (Next.js API routes of apps/web)
- Sanity (standalone studio `apps/studio`) for rules, texts and media
- Vitest for the engine · pnpm workspaces · Vercel

## Adapting to a new game
1. `pnpm new-game <slug>` (or `pnpm add-game <slug>` to also create the Sanity project and studio): copies this folder, renames the packages and registers the game in `packages/games`
2. Write the engine in `packages/engine/src/<game>/` (types, `GameDefinition`, tests), then `export { myGame as GAME }` in `src/index.ts`
3. Declare the game options in `options`: the lobby renders them on its own
4. Set the defaults (`src/lib/site.ts`, `DEFAULT_SKIN`, `SETTINGS_DEFAULTS`), then tune the rest in `/<slug>/admin`; adapt `game3d/scene.tsx`, `layout.ts` and `game/game.tsx`
5. Extend the glossary above

## Supabase (realtime)
- One Supabase project for every game: table `games` with a `game` column (the slug), primary key `(game, code)`; RLS on without policies, only the server (secret key) reads and writes it
- `state` = the engine's full state (secret); clients only get `GAME.view(state, playerId)` through `GET /api/<slug>/games/<code>`
- After each write, the server broadcasts `update` on `game:<slug>:<code>`; the client refetches
- Player identity = httpOnly cookie `<slug>_player`
- Routes: `POST /api/<slug>/games`, `GET /api/<slug>/games/<code>`, `POST .../join|leave|options|start|action|replay|takeover|chat|debug`

## Sanity
- The game's project id is in the `@pbgo/games` registry (`sanityProjectId`), the dataset is `production`
- Admin writes use `SANITY_API_WRITE_TOKEN_<SLUG>` (`6-nimmt` → `SANITY_API_WRITE_TOKEN_6_NIMMT`), set in `apps/web/.env.local` and on Vercel
- The game's own content types: schemas in `apps/studio/schemaTypes`, queries in `src/sanity/`, then `pnpm --filter <slug>-studio typegen` (writes `src/sanity/types.ts`)

## Principles
- The server is the only source of truth; each player only gets a filtered view
- The game's rules live in the engine only
- `debug` (START / NEXT TURN / END) is off in production unless `DEBUG_GAMES=1`

## Commits
Gitmoji format: `<emoji>(<slug>): <description>`

Commit often, one commit per significant feature.
