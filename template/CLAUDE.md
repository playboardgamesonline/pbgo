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
  - `src/index.ts` — shared by the server and the client: engine `GAME`, site constants (`src/lib/site.ts`); optional `SOUNDS`, `I18N`, `DEFAULT_SKIN`, `UI_THEME`, `SETTINGS_DEFAULTS`, `ERROR_MESSAGES`, `REACTIONS`, `STUDIO_URL`
  - `src/ui.tsx` — client components: `Logo`, `Game` (the board, loaded with the first game so the home page does not pull in three.js)
  - `src/server.ts` — server only: everything of `index.ts` plus the optional `loadSetupData` (data given to `GAME.setup`), `loadGameData` (`data` prop of the board), `ROUTES` (the game's own API routes, `/api/<slug>/games/<code>/<route>`), `SEO`
  - `src/runtime.tsx` — the game's client runtime (`styles.css`, fonts, `BindingProvider`), mounted by the `[game]` layout of apps/web for this game only
  - `src/lib/site.ts` — `SLUG`, `asset()` (URL of a file of `apps/web/public/<slug>`), name, tagline, description, keywords, author, contact
  - `src/components/game` — the board (`game.tsx`: table, announcements, debug)
  - `src/components/game3d` — react-three-fiber scene (`layout.ts` computes the poses, `scene.tsx` moves each card to its pose, `card3d.tsx`, textures, aura, crown, photo for sharing)
- `packages/engine` — `@template/engine`, pure TypeScript engine (no UI), tested with Vitest; re-exports `@pbgo/engine-kit`
  - `@pbgo/engine-kit` (every helper is documented in `packages/engine-kit/README.md`): `GameDefinition<State, Action, View>` (`setup`, `apply`, `view`, `isOver`, `options`, `clientActions`, `waitingFor`, `autoPlayFor`, `debug`), declarative game options (`number` / `choice` / `boolean`, `defaultOptions`, `normalizeOptions`), `EngineError`
    - Turns (engine contract v2): `waitingFor(state)` = the players the game waits for (several on a simultaneous step), `autoPlayFor(state, playerId)` = plays for one of them; `activePlayer` and `autoPlay` are `@deprecated`. Read them through `waitingPlayers`, `currentPlayer`, `canPlayFor`, `playFor`, `playOn`, never call the hooks directly
    - Simultaneous step: `Submissions<T>`, `openSubmissions`, `submit`, `pendingSubmissions(submissions, seatIds)`, `allSubmitted`, `submittedFlags`, `revealSubmissions(submissions, seatIds)`
    - Card games, seeded and pure: `createSaveableRng` / `restoreRng` / `shuffle` / `sideSeed` (a stream carried from one action to the next), `issueIds` / `reissueId` (numeric opaque card ids; a card that goes back into hiding gets a new one), `draw` / `peek` / `insertAt` / `reshuffleDiscard` / `drawWithReshuffle` / `deal` (piles, top first), `viewLog` (a log filtered per viewer), `roundsOutcome` / `sumRounds` / `ranks` (scores over rounds until a target)
    - Lean state (every game): the state holds ids and numbers only, no display data, no derived values, no log
  - `src/demo/` is the demo game (with a simultaneous step: the secret bids of the `bids` option); `src/index.ts` exports `GAME` = the active game
- `apps/studio` — `template-studio`, Sanity Studio built with `createStudioConfig` of `@pbgo/studio-kit` (shared singletons `settings`, `interface`, `audio`, `texts`, no rules document); only `schemaTypes/game.ts` is the game's own (the images of the table, in tabs: add a tab per family). The forms follow the rules of the skill `game-sanity-create` (`.claude/skills/`), kept for the whole Studio by `studio-forms.test.ts` (`pnpm --filter template-studio test`; `pnpm new-game` copies it into the new game)
- Everything else (home, lobby, game page, chat, game over, sharing, admin, API routes) comes from `@pbgo/core` and is the same for every game

## Assets
Files in `apps/web/public/<slug>/` (served at `/<slug>/...`), named in English `UPPER_SNAKE_CASE` (e.g. `cards/BACK.webp`), folders in lowercase English. Build their URLs with `asset()` from `src/lib/site.ts`.

## Admin UI
- `/gamemaster` (every game's admin, `/gamemaster/<slug>/...`) uses the PBGO platform design system (black and white, dark only, Geist, shadcn preset `beEgoY8u` adapted), scoped by the `.platform` class. The reference of every token and component is `/design` (apps/web)
- Components live in the shared package `@pbgo/ui/platform/*` (`packages/ui/src/platform`), the game's in `@pbgo/ui/game/*`. To add one: `pnpm dlx shadcn@latest add <comp>`, move it to `packages/ui/src/platform` (or `game`), replace the `@/lib/utils` imports with `../utils`, and keep it dark-only and token-only (no `dark:` variant, no colour, font or size of its own; see "Design system" in the root `CLAUDE.md`)
- The home page, the lobby and the board keep the game's theme (colors and fonts set in Admin › Visual)

## In-game UI
Ticker, announcements, takeover pill, chat, players strip, seat label and game over are shared: same markup and logic for every game (`@pbgo/core/components/game`), drawn in the game's own look, never the platform's. The ticker, takeover pill, chat and toolbar take the game's skin; the announcements, the seat label and the game over are tuned by `UI_THEME`.
- Through `UI_THEME` (optional, exported by `src/index.ts`, type `UiTheme` of `@pbgo/core/lib/binding`): `motion` (`"calm"` by default, `"lively"` adds confetti, springs and the emoji burst), `announcement` (`font`, `color`, `outline`, `shadow`, `veil`, `rule`, `confetti`), `seat` (`shape`, `ring`, `font`, `name`), `gameOver` (`surface`, `border`, `radius`, `ink`, `accent`, `frame`). CSS values, `var(--…)` works
- The template's look is "paper & ink", a universe of its own next to Courtisans' banquet: `src/lib/ui-theme.ts` (the in-game UI), `THEME` of `src/lib/skin.ts` (cream on ink, vermilion accent: the skin tokens the rest of the UI reads) and `src/styles.css` (fonts). The 3D floor follows `surfaceDark`. Colours saved in the gamemaster (Sanity `settings`) override these code defaults; a new game replaces the three files with its own palette
- Never fork or restyle one of these components, and never override their CSS from the game: ask for a field in `UiTheme` instead
- The board's own overlays use the variant `short` (`@media (max-height: 30rem)`, keyed on height) for a phone held sideways, and `useMotion()` (`@pbgo/core/lib/use-motion`) before any `motion/react` animation: reduced motion means fades only
- New player-facing labels of the shared UI are `UI_TEXTS` keys of `@pbgo/studio-kit`, translated in the four languages, never text in a component
- A player's name on the board is the shared seat label: `SeatLabel` in the DOM, `SeatAvatarMesh` (`src/components/game3d/seat-avatar-mesh.tsx`) in the 3D scene, with `imageUrl` for an account picture later (PLT-13)
- The reference is `/design` › In-game UI: the template and Courtisans side by side (seat label, players strip, the four announcements, game over)

## Tech stack
- Next.js 16 (App Router, React 19), Tailwind 4, shadcn/ui, motion, sonner
- 3D: three + @react-three/fiber + drei, leva settings (debug panel `Shift+D`)
- Realtime: Supabase (Postgres + Realtime broadcast), authoritative logic on the server (Next.js API routes of apps/web)
- Sanity (standalone studio `apps/studio`) for texts and media; the rules are a link to the publisher's PDF, per language, in `settings` (Gamemaster › Mechanics)
- Vitest for the engine · pnpm workspaces · Vercel

## Adapting to a new game
1. `pnpm new-game <slug>` (or `pnpm add-game`, which asks the name and the rules PDFs and also creates the Sanity project and Studio; the skill `game-new` runs it for the owner): copies this folder, renames the packages and registers the game in `packages/games`
2. Write the engine in `packages/engine/src/<game>/` (types, `GameDefinition`, tests), then `export { myGame as GAME }` in `src/index.ts`
3. Declare the game options in `options`: the lobby renders them on its own
4. Implement `waitingFor` and `autoPlayFor` (see "Turns and absent players" below), and the error messages of your own codes in `ERROR_MESSAGES` of `src/lib/site.ts`
5. Set the defaults (`src/lib/site.ts`, `DEFAULT_SKIN`, `SETTINGS_DEFAULTS`), then tune the rest in `/gamemaster/<slug>`; adapt `game3d/scene.tsx`, `layout.ts` and `game/game.tsx`
6. Adapt `src/takeover.test.ts` to the new engine: it plays a whole game where players are absent and the others take over (`pnpm --filter @pbgo-game/<slug> test`)
7. Extend the glossary above

## Turns and absent players
- `waitingFor(state)`: ids of the players the game waits for, in seat order, no duplicates; one player per classic turn, several on a simultaneous step, none when the game is over. **Public**: the server sends it to every viewer, so never drop a player from it when that would reveal something hidden
- `autoPlayFor(state, playerId)`: completes the current step of that one player. Legal, deterministic (seeded streams only, no `Math.random` or `Date.now`), `EngineError("NOT_WAITING")` if they are not waiting. The server uses it for an absent player
- Absent player (core): after `settings.turnTimeout` without a move, the present players vote per absent player (`POST /api/<slug>/games/<code>/takeover`, `StalledTurn`); a player is played for once every other member seen in the last 75 s voted for them. The game has nothing else to write
- Simultaneous step (see the secret bids of `src/demo/game.ts`): `Submissions<T>` in the state, resolved inside the `apply` of the last answer, `waitingFor` = `pendingSubmissions(submissions, seatIds)`, the view only says who answered (`submittedFlags`). The state is `jsonb`: never take an order from the keys of an object, take it from an array (`state.players`)
- Board: `<Ticker waitingFor={game.waitingFor} …/>` and `<StalledTurn onUpdate={onUpdate} />`; a player can leave `waitingFor` without acting (someone played for them), so the board follows the view. On a simultaneous step the ticker lists every seat on its own (`PlayersStrip`: done, waiting, away), so the board does not draw a "who has played" list
- Details and rationale: `template/docs/GAME_GUIDE.md` (section 2)

## Supabase (realtime)
- One Supabase project for every game: table `games` with a `game` column (the slug), primary key `(game, code)`; RLS on without policies, only the server (secret key) reads and writes it
- `state` = the engine's full state (secret); clients only get `GAME.view(state, playerId)` through `GET /api/<slug>/games/<code>`
- After each write, the server broadcasts `update` on `game:<slug>:<code>`; the client refetches
- Player identity = httpOnly cookie `<slug>_player`
- Presence: the server writes a per-player last-seen timestamp (`games.seen`, throttled) on reads and writes; the takeover only counts members seen in the last 75 s
- Routes: `POST /api/<slug>/games`, `GET /api/<slug>/games/<code>`, `POST .../join|leave|options|start|action|replay|takeover|chat|debug`

## Sanity
- The game's project id is in the `@pbgo/games` registry (`sanityProjectId`), the dataset is `production`
- Admin writes use `SANITY_API_WRITE_TOKEN_<SLUG>` (`6-nimmt` → `SANITY_API_WRITE_TOKEN_6_NIMMT`), set in `apps/web/.env.local` and on Vercel
- The game's own content types: schemas in `apps/studio/schemaTypes`, queries in `src/sanity/`, then `pnpm --filter <slug>-studio typegen` (writes `src/sanity/types.ts`)
- Cards that come in kinds are one document type per kind (a list of its own in the Studio, `collections` of `sanity.config.ts`), never one type with a `kind` field; the `key` is the simplest name within the kind, ids are `<category>-card-<key>`. See "Language & naming" of `docs/GAME_GUIDE.md`

## Principles
- The server is the only source of truth; each player only gets a filtered view
- The game's rules live in the engine only
- `debug` (START / NEXT TURN / END) is off in production unless `DEBUG_GAMES=1`

## Commits
Gitmoji format: `<emoji>(<slug>): <description>`

Commit often, one commit per significant feature.
