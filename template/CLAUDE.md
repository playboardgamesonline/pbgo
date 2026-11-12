# Play Board Games Online · Template

Shared base of the online board games. `pnpm new-game <slug>` copies this folder to `games/<slug>`. The demo game "La Plus Haute" (a minimal trick-taking game) shows the engine ↔ web contract; a new game replaces it.

The template is itself a game of the single app `apps/web`: `@pbgo-game/template`, served at `/template` (not live, so playable outside production only).

## Code conventions
- **All code is in English**, the game's vocabulary included: functions, variables, types, files, folders, API routes, URLs, SQL tables and columns, storage keys, error codes, comments.
- **Multilingual by design**: only player-facing texts are in French (or another language), and a game's texts live in Sanity only (`localeString` / `localeText` fields): no copy in the code, and a text reads the language asked, then English (the default language and the fallback), then `[missing: <key>]`. Only the platform's own labels (`UI_TEXTS` and their translations in `@pbgo/studio-kit`) are in code. Never a French word in an identifier.
- Few comments, explicit names.
- Game glossary (FR → EN), to extend for each new game:
  - partie → `game` · joueur → `player` · pseudo → `nickname` · hôte → `host` · moi → `me`
  - manche → `round` · tour → `turn` · pli → `trick` · main → `hand` · paquet/pioche → `deck` · carte → `card`
  - vue → `view` · état → `state` · résultats → `results` · vainqueur → `winner` · journal → `log`
  - règles → `rules` · réglages → `settings` · annonce → `announcement` · partage → `sharing` · tâche → `task`

## Structure
- `package.json` — `@pbgo-game/template`, the binding package that `@pbgo/games` loads on demand
  - `src/index.ts` — shared by the server and the client: engine `GAME`, site constants (`src/lib/site.ts`); optional `SOUNDS`, `DEFAULT_SKIN`, `UI_THEME`, `SETTINGS_DEFAULTS`, `ERROR_CODES`, `REACTIONS`, `STUDIO_URL`
  - `src/ui.tsx` — client components: `Logo`, `Game` (the board, loaded with the first game so the screens around it do not pull in three.js)
  - `src/server.ts` — server only: everything of `index.ts` plus the optional `loadSetupData` (data given to `GAME.setup`), `loadGameData` (`data` prop of the board), `ROUTES` (the game's own API routes, `/api/<slug>/games/<code>/<route>`), `SEO`
  - `src/runtime.tsx` — the game's client runtime (`styles.css`, fonts, `BindingProvider`), mounted by the `[game]` layout of apps/web for this game only
  - `src/lib/site.ts` — `SLUG`, name, keywords, author, contact, `ERROR_CODES` (no tagline, no description: those are texts, they live in Sanity)
  - `src/components/game` — the board (`game.tsx`: table, announcements, debug)
  - `src/components/board` — react-three-fiber scene on the shared tools of `@pbgo/table` (`layout.ts` builds the layouts of the hand, of the opponents' cards and of the middle of the table with the shared layout helpers, `scene.tsx` sets the `Table` with its surface (a colour and a felt) and places the cards with `Zone`, `bids.tsx` asks and shows the bids of the simultaneous step with bid cards, `camera.ts` holds the settings of the camera and of the share photo (the `Table` makes their debug knobs), `textures.ts` paints the faces and `glows.ts` names the glows the cards wear, both handed to the shared `Card`; the seats are the shared `PlayerSeat`)
- `packages/engine` — `@template/engine`, pure TypeScript engine (no UI), tested with Vitest; re-exports `@pbgo/engine-kit`
  - `@pbgo/engine-kit` (every helper is documented in `packages/engine-kit/README.md`): `GameDefinition<State, Action, View>` (`setup`, `apply`, `view`, `isOver`, `options`, `clientActions`, `waitingFor`, `autoPlayFor`, `debug`, and `step` / `autoPlayStep` / `setupStep` for a game that says what its moves did: the demo does, and its history is the log of the table, `useGameLog`), declarative game options (`number` / `choice` / `boolean`, `defaultOptions`, `normalizeOptions`), `EngineError`
    - Turns (engine contract v2): `waitingFor(state)` = the players the game waits for (several on a simultaneous step), `autoPlayFor(state, playerId)` = plays for one of them; `activePlayer` and `autoPlay` are `@deprecated`. Read them through `waitingPlayers`, `currentPlayer`, `canPlayFor`, `playFor`, `playOn`, never call the hooks directly
    - Simultaneous step: `Submissions<T>`, `openSubmissions`, `submit`, `pendingSubmissions(submissions, seatIds)`, `allSubmitted`, `submittedFlags`, `revealSubmissions(submissions, seatIds)`
    - Card games, seeded and pure: `createSaveableRng` / `restoreRng` / `shuffle` / `sideSeed` (a stream carried from one action to the next), `issueIds` / `reissueId` (numeric opaque card ids; a card that goes back into hiding gets a new one), `draw` / `peek` / `insertAt` / `reshuffleDiscard` / `drawWithReshuffle` / `deal` (piles, top first), `viewLog` (a log filtered per viewer), `roundsOutcome` / `sumRounds` / `ranks` (scores over rounds until a target)
    - Lean state (every game): the state holds ids and numbers only, no display data, no derived values, no log
  - `src/demo/` is the demo game (with a simultaneous step: the secret bids of the `bids` option); `src/index.ts` exports `GAME` = the active game
- `apps/studio` — `template-studio`, Sanity Studio built with `createStudioConfig` of `@pbgo/studio-kit` (shared singletons `settings`, `interface`, `audio`, `texts`, no rules document); only `schemaTypes/game.ts` is the game's own (the images of the table, in tabs: add a tab per family). The forms follow the rules of the skill `game-sanity-create` (`.claude/skills/`), kept for the whole Studio by `studio-forms.test.ts` (`pnpm --filter template-studio test`; `pnpm new-game` copies it into the new game)
- Everything else (the table page, chat, game over, sharing, admin, API routes) comes from `@pbgo/core` and is the same for every game. A table is opened, joined and started on the platform's page of the game, `/game/<slug>` (`/template` shows it; in development every game has one, live or not)

## Assets
Pictures and sounds live in the game's Sanity project, never in the repo: `apps/web/public` holds the platform's own files only (`favicon.ico`), and `registry.test.ts` fails on any other file there, so a game has no folder in it and no `asset()`. Sources (PDF, PSD, HD visuals) go in `games/<slug>/assets/`, ignored by git.

## Admin UI
- `/gamemaster` (every game's admin, `/gamemaster/<slug>/...`) uses the PBGO platform design system (black and white, dark only, Geist, shadcn preset `beEgoY8u` adapted), scoped by the `.platform` class. The reference of every token and component is the design docs, `/docs/design` (`docs/design/` at the repo root)
- Components live in the shared package `@pbgo/ui/platform/*` (`packages/ui/src/platform`), the game's in `@pbgo/ui/game/*`. To add one: `pnpm dlx shadcn@latest add <comp>`, move it to `packages/ui/src/platform` (or `game`), replace the `@/lib/utils` imports with `../utils`, and keep it dark-only and token-only (no `dark:` variant, no colour, font or size of its own; see `docs/design/01-guidelines/01-principles.md` at the repo root)
- The board and the screens around it keep the game's theme (colors and fonts set in Admin › Visual)

## In-game UI
Ticker, announcements, takeover pill, chat, players list, menu of the game, seat label and game over are shared: same markup and logic for every game (`@pbgo/core/components/game`). The announcements, the takeover pill, the seat label and the end screen (`GameOverCard`: the podium, how it ended for the player, "Continue" and "Rematch") are the table's: drawn in the game's own look and tuned by `UI_THEME`. The ticker, the list of the players with their scores and the chat are around the table: drawn in the game's look from its skin, with no group of `UI_THEME`; they read the view (`standings` for the scores). The menu of the game is in the social dock, the one island of the platform's look.
- Through `UI_THEME` (optional, exported by `src/index.ts`, type `UiTheme` of `@pbgo/core/lib/binding`): `motion` (`"calm"` by default, `"lively"` adds confetti, springs and the emoji burst), `announcement` (`font`, `color`, `outline`, `shadow`, `veil`, `rule`, `confetti`), `seat` (`shape`, `ring`, `font`, `name`), `gameOver` (`surface`, `border`, `radius`, `ink`, `accent`; `frame` is no longer read). CSS values, `var(--…)` works
- The template's look is "paper & ink", a universe of its own next to Courtisans' banquet: `src/lib/ui-theme.ts` (the in-game UI), `THEME` of `src/lib/skin.ts` (cream on ink, vermilion accent: the skin tokens the rest of the UI reads) and `src/styles.css` (fonts). The table is the felt of `board/textures.ts` (`MAT_COLOR`, `matTexture`). Colours saved in the gamemaster (Sanity `settings`) override these code defaults; a new game replaces the three files with its own palette
- Never fork or restyle one of these components, and never override their CSS from the game: ask for a field in `UiTheme` instead
- The board is drawn behind the platform's start screen (PLT-107): `BoardProps` gives it `held` (hold the opening, the camera's entrance and the first announcement, until it turns false), `onLoaded` (call it once the board is drawn and its pictures are in: the player is then ready once they have pressed the button of the screen too) and `onProgress` (how far it is, 0 to 1, for the collective bar). A board on the shared `Table` passes `held` and `onLoaded` to it, and one that loads pictures without suspending calls `onLoaded` and `onProgress` itself
- The board's own overlays use the variant `short` (`@media (max-height: 30rem)`, keyed on height) for a phone held sideways, and `useMotion()` (`@pbgo/core/lib/use-motion`) before any `motion/react` animation: reduced motion means fades only
- New player-facing labels of the shared UI are `UI_TEXTS` keys of `@pbgo/studio-kit`, written in English (`ENGLISH_ONLY_TEXTS`) until the language pass translates them, never text in a component
- A player's name on the board is the shared seat label: `SeatLabel` in the DOM, `PlayerSeat` of `@pbgo/table` on the table (it paints the same avatar with `SeatAvatarMesh`), with `imageUrl` for an account picture later (PLT-13)
- The reference is `/docs/design/in-game` (`docs/design/04-in-game/` at the repo root): the template and Courtisans side by side (seat label, the five announcements, the end screen)

## Tech stack
- Next.js 16 (App Router, React 19), Tailwind 4, shadcn/ui, motion, sonner
- Table: three + @react-three/fiber + drei, the table and the cards are the shared `Table` and `Card` of `@pbgo/table`, leva settings (debug panel `Shift+D` or `?debug`, never on the production deployment)
- Realtime: Supabase (Postgres + Realtime broadcast), authoritative logic on the server (Next.js API routes of apps/web)
- Sanity (standalone studio `apps/studio`) for texts and media; the rules are a link to the publisher's PDF, per language, in `settings` (Gamemaster › Mechanics)
- Vitest for the engine · pnpm workspaces · Vercel

## Adapting to a new game
Every job has a skill (`.claude/skills/README.md`: `game-new`, `engine-rules`, `engine-board`, `game-go-live`), and `pnpm check:game <slug>` says how far a game has got.
1. `pnpm new-game <slug>` (or `pnpm add-game`, which asks the name and the rules PDFs and also creates the Sanity project and Studio; the skill `game-new` runs it for the owner): copies this folder, renames the packages and registers the game in `packages/games`
2. Write the engine in `packages/engine/src/<game>/` (types, `GameDefinition`, tests), then `export { myGame as GAME }` in `src/index.ts`
3. Declare the game options in `options`: the lobby renders them on its own. They name no text: their words (and those of the lines of the score, `scoreLines`) are written in the game's Sanity, Copy › Options
4. Implement `waitingFor` and `autoPlayFor` (see "Turns and absent players" below), and list the codes of your own errors in `ERROR_CODES` of `src/lib/site.ts` (the shared ones, `SHARED_ERROR_CODES` of the kit, are worded by the platform and stay out; `src/error-codes.test.ts` checks it): their messages, like every text of the game (description, victory phrases), are written in Sanity (Gamemaster › Copy), never in the code
5. Set the defaults (`src/lib/site.ts`, `DEFAULT_SKIN`, `SETTINGS_DEFAULTS`: names, colours, player colours, never a text), then tune the rest in `/gamemaster/<slug>`; Launch › Content lists the texts Sanity does not hold yet; adapt `board/scene.tsx`, `camera.ts`, `layout.ts`, `textures.ts`, `glows.ts` and `game/game.tsx` (the canvas, the camera and its entrance, the endless table, the share photo, the card itself and the placing of cards in a zone are `@pbgo/table`'s: a game gives the `Table` its camera settings, a `Zone` a layout (built with the shared helpers `fan`, `row`, `pile`, `grid`, `seats`, or by hand) and its cards two textures, a size and glows, and never copies them)
6. Adapt `src/takeover.test.ts` to the new engine: it plays a whole game where players are absent and the others take over (`pnpm --filter @pbgo-game/<slug> test`). Keep `src/conformance.test.ts` green too: it plays the engine the way the server does and fails with the rule of the contract that is broken; give it the `secretsFor` of the game (what a seat must never see of the others)
7. Extend the glossary above
8. Check the board in a real browser with `pnpm check:board <slug>` (it needs `pnpm dev`): add the game's `check-board.config.mjs`, how its seats play and what the viewer presses and where (`games/flip-7/check-board.config.mjs` is a model, `docs/scripts.md` has the keys); without it the tool checks only the platform's parts

## Turns and absent players
- `waitingFor(state)`: ids of the players the game waits for, in seat order, no duplicates; one player per classic turn, several on a simultaneous step, none when the game is over. **Public**: the server sends it to every viewer, so never drop a player from it when that would reveal something hidden
- `autoPlayFor(state, playerId, at?)`: completes the current step of that one player. Legal, deterministic (seeded streams only, no `Math.random` or `Date.now`), `EngineError("NOT_WAITING")` if they are not waiting. The server uses it for an absent player, and `at` is the time it plays it at
- Absent player (core): after `settings.turnTimeout` without a move, the present players vote per absent player (`POST /api/<slug>/games/<code>/takeover`, `StalledTurn`); a player is played for once every other member seen in the last 75 s voted for them. The game has nothing else to write
- Clock (the demo's option `turnSeconds`): the state keeps the clock of the step as a `Timer` (`startTimer(at, seconds)`), `begin(state, at)` starts the first one when the table goes live, `nextDeadline(state)` says when the game needs the clock next and the system action to play then (`systemAction("timeout", at)`, never in `clientActions`), and the view gives the length of a step (`timer: { seconds }`). Each action carries the time the server plays it at (`at`), an engine never reads a clock, and the server plays the deadline on the first request that looks at the table, at the time it was due. The board draws `<Timer endsAt={deadlineAt} seconds={view.timer.seconds} …/>` from `BoardProps.deadlineAt` (`board/scene.tsx`, `CLOCK` of `board/layout.ts`). Details: `docs/engine/02-components/20-timers.md`
- The bids are asked and shown on the table with bid cards of the game's own look (`board/bids.tsx`, `bidRowPose` and `bidPose` of `board/layout.ts`, `bidFaceTexture` of `board/textures.ts`): a row across the middle, the card pressed goes to the viewer's seat, the others lie face down at their seats until everybody has bid. `BidPanel` of `game/game.tsx` is the way with the keyboard, out of sight until reached with Tab
- Simultaneous step (see the secret bids of `src/demo/game.ts`): `Submissions<T>` in the state, resolved inside the `apply` of the last answer, `waitingFor` = `pendingSubmissions(submissions, seatIds)`, the view only says who answered (`submittedFlags`). The state is `jsonb`: never take an order from the keys of an object, take it from an array (`state.players`)
- Board: `<Ticker waitingFor={game.waitingFor} …/>` and `<StalledTurn onUpdate={onUpdate} />`; a player can leave `waitingFor` without acting (someone played for them), so the board follows the view. On a simultaneous step the list of the players at the top right lights the rows of those the game waits for and dims those who are away, so the board does not draw a "who has played" list
- Details and rationale: `template/docs/GAME_GUIDE.md` (section 2)

## Supabase (realtime)
- One Supabase project for every game: table `games` with a `game` column (the slug), primary key `(game, code)`; RLS on without policies, only the server (secret key) reads and writes it
- `state` = the engine's full state (secret); clients only get `GAME.view(state, playerId)` through `GET /api/<slug>/games/<code>`
- After each write, the server broadcasts `update` on `game:<slug>:<code>`; the client refetches
- Player identity = httpOnly cookie `<slug>_player`, which holds a secret that only the server reads; the player id of the engine, the views and the table (`PlayerInfo.id`, `playerId`, `meId`) is a hash of it, public and safe to put in the state (`@pbgo/core/server/player-id`)
- Presence: the server writes a per-player last-seen timestamp (`games.seen`, throttled) on reads and writes; the takeover only counts members seen in the last 75 s
- Routes: `POST /api/<slug>/games`, `GET /api/<slug>/games/<code>`, `POST .../join|leave|options|start|ready|action|replay|takeover|tick|chat|debug`

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
