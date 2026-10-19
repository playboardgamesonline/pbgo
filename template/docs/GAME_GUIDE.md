# Game guide · Online board game on the PBGO base

How to build a new multiplayer online board game on this monorepo, starting from the template (`template/`, demo game "La Plus Haute"). It is written for **Oré** (project owner, designer) and **Claude** (the AI that codes). Each section says **who does what**.

> Legend: 👤 = done by Oré · 🤖 = done by the AI · ⭐ = mandatory checkpoint (the AI stops and waits for Oré's feedback)

---

## 1. Stack

| Layer | Tech | Role |
|---|---|---|
| Monorepo | **pnpm** workspaces, shared catalog of versions | one repo, one app, one package per game |
| Front | **Next.js 16** (App Router, React 19, TypeScript), the single app `apps/web` | hub, game pages, lobby, board, API routes |
| UI | **Tailwind CSS 4**, **shadcn/ui** (Radix), **motion**, **sonner** (toasts), icons **lucide-react** + **Hugeicons** | DOM interface |
| 3D | **three**, **@react-three/fiber**, **@react-three/drei**, **maath** (easing) | 3D board |
| Debug | **leva** (settings panels, custom tabs) | live settings, copyable |
| Engine | **pure TypeScript** + **Vitest** (`packages/engine` of the game) | game rules, no UI dependency |
| Realtime / DB | **Supabase** (Postgres + Realtime), one project for every game | games storage + update broadcast |
| CMS | **Sanity**, one project and one standalone studio per game (`apps/studio`) | images, texts, rules, cards |
| Hosting | **Vercel**, one project (`pbgo`, root `apps/web`), deployed from GitHub `main` | production + previews |

⚠️ Next.js 16 has breaking changes: the AI reads `apps/web/node_modules/next/dist/docs/` before coding (see `apps/web/AGENTS.md`).

---

## 2. Architecture (the principles every game keeps)

1. **The engine is the only source of the rules.** Everything that is a rule (setup, turn, legal actions, score, end) lives in `packages/engine`, in pure TypeScript, tested. It implements the `GameDefinition<State, Action, View>` contract (`setup`, `apply`, `view`, `isOver`, `options`, `clientActions`, `waitingFor`, `autoPlayFor`, `debug`). The front and the server only call `GAME`.
2. **Authoritative server.** The client only sends *intents* (`POST /api/<slug>/games/<code>/action`). The server loads the state, calls the engine, saves, broadcasts.
3. **View filtered per player.** The full state (`State`) is secret (hands, hidden cards). Each player only gets `GAME.view(state, playerId)` through `GET /api/<slug>/games/<code>`.
4. **"Ping + refetch" realtime.** After each write (optimistic lock on `version`), the server broadcasts `update` on the Supabase channel `game:<slug>:<code>`; clients refetch their view. No sensitive data in the channel.
5. **Identity without an account.** httpOnly cookie (`<slug>_player`) = player id. Nickname kept in the local profile (`<slug>:profile`).
6. **Declarative game options.** The game declares `options` (`number` / `choice` / `boolean`); the lobby renders them and the host edits them (`POST /api/<slug>/games/<code>/options`, values passed through `normalizeOptions`).
7. **Content in Sanity, defaults in the code.** The site works with an empty Sanity project (default rules, skin and texts); Sanity overrides them.
8. **3D = presentation only.** `layout.ts` computes *poses* (position / rotation) for each card from the view; `scene.tsx` animates each object to its pose. Same React key = same object ⇒ real moves (hand → table).
9. **DOM UI over the 3D** (header, log, announcements, game over, rules). The ticker, players strip, announcements, takeover pill, chat, seat label and game over are the shared in-game UI: written once, drawn in the game's own look, tuned through `UI_THEME` (see "In-game UI" below).
10. **Code split per game.** The hub loads no game code; a game's pages load only that game (`@pbgo/games` imports each binding on demand), and its board (three.js) only on the game page.
11. **The engine says who the game waits for.** `waitingFor(state)` lists the players the game waits for (one on a classic turn, several on a simultaneous step) and `autoPlayFor(state, playerId)` plays for one of them when they are absent. See below.
12. **Lean state.** The state holds ids and numbers only: no display data (names, texts, labels, image paths: the catalogue and Sanity have them, the client draws them), no derived values (totals, leaders, pile sizes: compute them), no log (what happened is not what the next move needs). The seeded helpers of the engine-kit for the card games (`rng`, `ids`, `deck`, `log`, `rounds`) are built for it; see `packages/engine-kit/README.md`.

### Who the game waits for: turns, simultaneous steps, absent players

`waitingFor(state)` returns the ids of the players the server waits for, in seat order, without duplicates: one player on a classic turn, **several on a simultaneous step** (secret bids, everybody reads their missions, simultaneous card choice…), nobody when the game is over (or when the engine itself is waiting, e.g. for a deadline). `autoPlayFor(state, playerId)` completes the current step of ONE waiting player. They replace `activePlayer` and `autoPlay`, which still work but are `@deprecated`.

- **Read them through the helpers of `@pbgo/engine-kit`**, never call the hooks directly: `waitingPlayers(GAME, state)`, `currentPlayer`, `canPlayFor`, `playFor(GAME, state, playerId)`, `playOn` (plays until the end, for tests). They keep an engine written for the previous contract working.
- **`waitingFor` is public information**: the server sends it to every viewer (`PublicGame.waitingFor`), and the ticker, its players strip and the takeover prompt display it. It must never reveal something hidden. Do not drop a player from it when that would tell something (a player who may still respond to an action stays listed until the window closes).
- **`autoPlayFor` is deterministic and always legal**: seeded streams only (never `Math.random` or `Date.now`, a replay must stay exact), afterwards the player is no longer waiting for THAT step (they may be waiting for the next one), and `EngineError("NOT_WAITING")` when they are not in `waitingFor(state)`. It is a fallback to keep the table moving, not an AI: the simplest legal play (the demo plays its first card, and announces the average number of tricks).
- **Absent players** are handled by `@pbgo/core`, nothing else to write in the game: after `settings.turnTimeout` without a move, the other players can vote to play for the players the game waits for (`POST /api/<slug>/games/<code>/takeover`, `StalledTurn` on the board). A vote is `(voter, target)`. The required voters for a target are the members seen at the table in the last 75 s, other than the target, so an absent player never blocks. The server then plays with `playFor`.
- **Board**: `Ticker` takes `waitingFor={game.waitingFor}` (the "Your turn" line is shown when I am among them), `StalledTurn` only needs `onUpdate`. A player may leave `waitingFor` without having acted (somebody played for them): the board must be driven by the view, not by what the player did. When `waitingFor` holds two players or more, the ticker lists every seat itself (`PlayersStrip`: done, waiting, away), so the board draws no "who has played" list.

#### A simultaneous step (`simultaneous.ts` of the engine-kit)

The demo's secret bids at the start of each round are the reference (`packages/engine/src/demo/game.ts`, the `bids` option; board: `BidPanel` in `src/components/game/game.tsx`, which only draws the bid itself: the ticker already shows who has answered).

- **State**: `Submissions<T>` (`bids: Submissions<number>`), built with `openSubmissions(seatIds)` when the step opens; the value is `null` until the player answers. Only ids and numbers, nothing derived.
- **`apply`**: store the answer with `submit(submissions, playerId, value)`; as soon as `allSubmitted(submissions)` is true, resolve the step **inside the same action** (the state never sits between two phases), reading the answers in seat order with `revealSubmissions(submissions, seatIds)`. Letting the players change their answer until the last one arrives is a rule choice (the demo does, and `submit` replaces an answer); a game whose answers are final refuses the second one itself.
- **`waitingFor`**: `pendingSubmissions(submissions, seatIds)` with the seat list taken from the game's own array of players.
- **View**: `submittedFlags(submissions)` tells WHO has answered, never WHAT before the step is resolved. A player sees their own answer (`me.bid`).
- **`autoPlayFor`**: the answer for that player only, so that when several players are absent they are played one after the other, each by its own vote.
- ⚠️ **Key order**: `games.state` is `jsonb`, and Postgres does not keep the order of the keys of an object. A list that depends on the order (who is pending, who plays next) is built from an array of the state (`state.players`), never from `Object.keys(submissions)`.
- Test it: `src/takeover.test.ts` plays a 3-player game where two players are absent at the simultaneous step and the third finishes the game alone (engine `playFor` + the pure voting rules of `@pbgo/core/server/takeover`). When the demo engine is replaced, adapt it to the new game's simultaneous step (or its turns); a game with no simultaneous step still keeps the turn-by-turn version.

### In-game UI: shared logic, per-game look

The ticker, the players strip, the seat label, the announcements (start, round, your turn, victory), the takeover pill, the chat and the game-over panel are written once, in `@pbgo/core/components/game`, and every game gets them. They are drawn in the game's own look, never the platform's black and white: the game's skin (colours, title and accent fonts from the gamemaster) is what they read, and the game's art stays the hero. A game never copies or restyles them. It adjusts the look through ONE optional export of its binding.

- **`UI_THEME`** (`src/index.ts`, type `UiTheme` of `@pbgo/core/lib/binding`), four optional groups of plain CSS values (so `var(--accent-game)` works), each defaulting to the look the games had before they could tune it (`lib/ui-theme.ts`), drawn with the game's skin tokens:
  - `motion`: `"calm"` (fades and short slides) or `"lively"` (also confetti, springs and the emoji burst)
  - `announcement`: `font`, `color`, `outline` (null for none), `shadow`, `veil`, `rule` (the two hairlines, null for none), `confetti` (`{ color, shape: "star" | "dot" }`, null for none)
  - `seat`: `shape` (`"disc"` or `"square"`), `ring`, `font`, `name` (the nickname in the seat colour, or in the ink around it)
  - `gameOver`: `surface` (any CSS background: a colour, a gradient, a texture), `border`, `radius`, `ink`, `accent`, `frame` (the polaroid of the share thumbnail)
  Courtisans keeps its banquet in `games/courtisans/src/lib/ui-theme.ts`; the template is "paper & ink" in `src/lib/ui-theme.ts`, with the palette in `src/lib/skin.ts`. When the contract lacks something, add a field to `UiTheme` (every game gets it) instead of overriding the CSS.
- **How it works**: `announcementTheme()`, `seatTheme()` and `gameOverTheme()` (`lib/ui-theme.ts`, pure) lay the theme over the defaults field by field. The announcements, the game over and the strip are pure views that take props (`announcement-view.tsx`, `game-over-panel.tsx`, `players-strip-view.tsx`) wrapped by connected components, which is how `/design` draws the very same markup. Never put `.platform` on the in-game UI.
- **Seat label**: a player is named one way, avatar + nickname + seat colour (`SeatLabel` in the DOM, `SeatAvatarMesh` on the 3D table, both in the game's `UI_THEME.seat`). The board uses it for every nickname it draws; the avatar is generated until accounts exist (PLT-13), then `imageUrl` replaces it.
- **The strip**: when `waitingFor` holds two players or more, the ticker lists every seat under its main line: colour dot and name; done (muted ✓), still waited for (full contrast), away (dimmed: not seen in the last 75 s); me marked. Beyond 8 seats it shrinks to "n/N ready" with the full list on hover or tap. A one-player turn shows no strip. The logic is `pendingSeats()` (`lib/pending-seats.ts`, pure and tested).
- **Small screens**: the variant `short` (`@media (max-height: 30rem)`) is keyed on the HEIGHT, because a phone held sideways (844×390) is wide but short. The HUD switches to its compact layout: history behind a toggle, smaller announcements, chat collapsed to an icon, scrollable game over, takeover pill stacked next to the logo, safe-area insets. Use it in the board's own overlays too. The `DesktopOnly` wall still hides game pages under 900 px: to check the board at 844×390, hide the wall with CSS injected in the browser, never in the code.
- **Motion**: any `motion/react` animation reads `useMotion()` (`"reduced" | "calm" | "lively"`); `GameHud` already mounts `MotionConfig reducedMotion="user"`. Reduced motion always wins over the theme: fades of 150 ms at most, no confetti, emoji burst, spring or looping effect. CSS transitions use `duration-*`, `ease-standard` and `motion-reduce:transition-none`.
- **Texts**: every label of the shared UI is a `UI_TEXTS` key (`@pbgo/studio-kit`), translated in fr / en / es / de (the strip uses `players`, `playersReady`, `seatDone`, `seatWaiting`, `seatAway`, the ticker `history`). No copy hard-coded in a shared component.
- **Debug**: Shift+D, TRANSITION tab: the announcement presets (`start`, `round`, `turn`, `victory`: duration, sound, scrim, sizes, banner, confetti). Nothing else of the in-game UI is tunable there.
- **Reference**: `/design` › In-game UI draws the seat label, the players strip, the four announcements (replay, hold, reduce motion) and the game over (one winner, a tie) in the look of two games side by side. Card and table motion is not part of it.

---

## 3. Files

```
apps/web/                          # 🌐 the only Next.js app (hub + every game)
├─ public/<slug>/                  # the game's static files, served at /<slug>/...
└─ src/app/
   ├─ (hub)/                       # / (hub), /legal
   ├─ [game]/                      # /<slug> (home), /<slug>/game/<code>, /<slug>/preview/<kind> (the admin lives at /gamemaster/<slug>)
   └─ api/[game]/…                 # /api/<slug>/games/…, tasks, feedback, admin (handlers of @pbgo/core)
packages/
├─ core/                           # everything shared: server, lib, components, pages, route handlers
├─ games/                          # registry slug → metadata + on-demand import of each binding
├─ engine-kit/, ui/, studio-kit/, site/, tsconfig/, eslint-config/
games/<slug>/                      # one game
├─ CLAUDE.md                       # project rules for the AI (FR → EN glossary of the game included)
├─ package.json                    # @pbgo-game/<slug>, the binding package
├─ src/
│  ├─ index.ts                     # GAME, site constants, SOUNDS, I18N, DEFAULT_SKIN, UI_THEME… (server + client)
│  ├─ ui.tsx                       # Logo, Game (board, loaded on demand)
│  ├─ server.ts                    # loadSetupData, loadGameData, ROUTES, SEO (server only)
│  ├─ runtime.tsx                  # styles, fonts, BindingProvider (client)
│  ├─ lib/site.ts                  # SLUG, asset(), name, description…
│  └─ components/game, game3d/     # board and 3D scene
├─ packages/engine/src/            # 🧠 ENGINE (pure TS): <game>/ (types, game, tests) and index.ts (export … as GAME)
└─ apps/studio/                    # 🗂 SANITY STUDIO (shared singletons + the game's own types)
supabase/migrations/               # the shared schema (table games with a game column, tasks, feedback)
```

---

## 4. Conventions

### Language & naming
- **All code is in English**, the game's vocabulary included: functions, variables, types, files, folders, API routes, URLs, SQL tables and columns, storage keys, error codes (`playCard`, `PlayerView`, `updateGame`, `CARD_SETTINGS`, `components/game/game-over.tsx`, `/api/<slug>/games/<code>/join`, table `games`, `GAME_NOT_FOUND`).
- For a new game, write a **FR → EN glossary** of the game's words in its `CLAUDE.md` (e.g. Courtisans: courtisan → `courtier`, famille → `family`, domaine → `domain`, pioche → `deck`, lumière / disgrâce → `light` / `disgrace`) so the AI always uses the same names.
- **Multilingual by design**: only player-facing texts are in French (or another language). They live in Sanity (`localeString` / `localeText`), in the game's `I18N` export or in its defaults. Never a French word in an identifier.
- **Few comments**, in English; explicit names.
- **Sanity 100 % English** (types, ids, fields, titles). Deterministic ids: `family-butterfly`, `role-spy`, `courtier-noble-hare`. The `key` field holds the engine key (`butterfly`, `spy`).

### Assets (`apps/web/public/<slug>/`)
- Lowercase English folders: `home/`, `cards/`, `pictograms/`, `rules/`, `sounds/`, `textures/`.
- English `UPPER_SNAKE_CASE` files: `cards/SPY_HARE.webp`, `home/QUEEN.webp`, `sounds/HOVER.mp3`, `pictograms/PICTOGRAM_ARROW_UP.svg`.
- Formats: `.webp` for images, `.svg` for pictograms, `.mp3` for sounds.
- URLs built with `asset()` from `src/lib/site.ts` (`asset("/cards/BACK.webp")` → `/<slug>/cards/BACK.webp`).

### Commits
- Gitmoji: `<emoji>(<slug>): <description>`; `core`, `web` or `repo` for shared code.
- Frequent commits, one per significant feature.

### Debug
- Panel **Shift+D** (or `?debug`). Tabs `GAME / SCENE / AUDIO / TRANSITION` + FPS counter.
- **Every visual parameter is tunable** (`useSettings(folder, mutableObject, fields)`) with a **Copy values** button: Oré tunes live, then pastes the JSON to the AI, which turns it into the defaults.
- Phase buttons (START / NEXT TURN / END) call `POST /api/<slug>/games/<code>/debug` (off in production unless `DEBUG_GAMES=1`).

---

## 5. Who does what

### 👤 Oré (human): what the AI cannot do
- **Accounts & secrets**: Supabase, Sanity, Vercel, GitHub; fill `apps/web/.env.local` and the Vercel variables. **Never paste a token in the chat**: put it in `.env.local`.
- **Sanity commands with Oré's account**:
  - `pnpm --filter <slug>-studio schema:deploy` (after a schema change)
  - `pnpm --filter <slug>-studio run deploy` (deploy the studio)
  - content migrations of the game, when it has some
- **Apply the Supabase SQL migrations** (`supabase/migrations/*.sql`) when they change: `pnpm setup-env` applies the pending ones to preview, then production. A PR that adds a migration says so in its description, and Oré runs `pnpm setup-env` right after merging it.
- **Provide the assets**: rules PDF, card images, pictograms (SVG), textures, fonts, sounds, named after the convention or dropped in `games/<slug>/assets/` (ignored by git) to be sorted.
- **Enter / check the content in Sanity** (texts, images).
- **Play for real with several people** (the AI tests with simulated data).
- **Search Console / domain / SEO** (ownership, DNS).

### 🤖 AI (Claude)
- Write and test the **engine** (rules + Vitest tests, full game simulations included).
- Sanity schemas, GROQ queries, `typegen`, idempotent content migration scripts.
- The game's binding: board, game data loaders, the game's own API routes when it needs some.
- 3D scene, animations, DOM UI, rules, game over, sharing.
- Expose **every visual setting in the debug panel** with "Copy values".
- Check each change: `pnpm typecheck`, `pnpm lint`, `pnpm --filter web build`, screenshots (headless 3D rendering is slow: screenshots check the layout, not the FPS).
- Commit (gitmoji); never commit `.env.local` or unrelated local changes.
- Never send Oré's email to a third-party service; never work around network blocks.

---

## 6. Steps for a new game (with ⭐ checkpoints)

| # | Step | Who | Output |
|---|---|---|---|
| 0 | Provide the rules PDF + raw assets + name of the game | 👤 | `games/<slug>/assets/` |
| 1 | Read the rules, write **`plan-v1.md`** (formalized rules, components, edge cases, hidden information, FR → EN glossary of the game's words) | 🤖 | plan |
| ⭐ | **Validate the interpretation of the rules** (the most critical point: a misread rule spreads everywhere) | 👤 | ok / fixes |
| 2 | `pnpm add-game <slug>` (copy of the template, registry entry, Sanity project, studio, write token), adapt `src/lib/site.ts` and `CLAUDE.md` (glossary) | 🤖 + 👤 (accounts) | clean package |
| 3 | **Engine**: types, setup, actions, scoring, filtered view, `waitingFor` / `autoPlayFor`, tests + simulation | 🤖 | green tests |
| ⭐ | Validate the engine through a summary of the coded rules (and, if possible, a simulated text game) | 👤 | ok |
| 4 | Sanity schemas + migration + seed (images extracted from the PDF if needed) | 🤖 | studio |
| 5 | `schema:deploy`, migration, studio deploy, check the content | 👤 | content online |
| 6 | Home + lobby (shared by `@pbgo/core`): adapt the skin (Admin › Visual, `DEFAULT_SKIN`) | 🤖 | screens |
| ⭐ | **Art direction**: mood, fonts, colors, home decor | 👤 | visual feedback |
| 7 | 3D board: layout, cards, hand, playable zones, targeting | 🤖 | playable game |
| ⭐ | **Playability / readability**: card size, camera, feedback, what is hidden | 👤 | feedback + copied settings JSON |
| 8 | Opening (animated setup), turn announcements | 🤖 | |
| 9 | Game over: scoring sequence, score table, replay, image sharing | 🤖 | |
| ⭐ | **Game over & sharing** (the emotional moment of the game) | 👤 | feedback |
| 10 | In-app rules (Sanity texts, illustrations), SEO, share image | 🤖 + 👤 (texts) | |
| 11 | **Real multiplayer test** (2 → max players, reconnection, leaving mid-game) | 👤 | reported bugs |
| 12 | Performance (FPS on an average machine), accessibility, mobile | 🤖 | |
| 13 | Sound (last) | 🤖 + 👤 (sounds) | |
| 14 | Go live: `live: true, indexable: true` in the `@pbgo/games` registry | 👤 | game on the hub |

### Giving feedback efficiently 👤
- **Annotated screenshot** + a short sentence ("smaller", "less saturated", "overlaps the border").
- The **"Copy values" JSON** of the debug panel once a setting is found → the AI turns it into the default.
- Say **which phase** (opening, turn, end) and **which state** (my turn / another player's turn).
- One feedback = one list of points: the AI handles them all, then sends a summary.

---

## 7. Shared (reused as is) vs specific to the game

**Shared (`@pbgo/core`, nothing to copy)**
- Server (Supabase, games with optimistic lock, player cookie, `handle` / `ApiError`, rate limiting), API routes `api/[game]/games/*`, `lib/api.ts`, `use-live-game.ts`, `realtime.ts`
- Home, lobby and game options (rendered from `GAME.options`), chat, absent players (per-player takeover votes, `StalledTurn`), game over, sharing
- The in-game UI (ticker, players strip, announcements, takeover pill, chat, game over): one look, tuned per game by `UI_THEME` only
- Debug: panel, tabs, `useSettings` (Copy values, FPS), START / NEXT TURN / END buttons
- Rules in tabs (Sanity singleton `rules` + code defaults)
- SEO (metadata, robots, sitemap, share image), `api/media` proxy, admin `/gamemaster/<slug>` (Setup, Tasks, Monitoring + Vercel Web Analytics)

**Specific (written per game, in `games/<slug>`)**
- `packages/engine/src/<game>/` (rules, view, options, `waitingFor` / `autoPlayFor`, debug) and the `GAME` export
- `layout.ts` (where the cards go), `scene.tsx` (zones, interactions), `textures.ts`, `game.tsx` (header, the game's announcements, the panel of a simultaneous step)
- `src/lib/site.ts` (with `ERROR_MESSAGES`, the player-facing text of the error codes the engine throws and core does not know), `DEFAULT_SKIN`, `UI_THEME` (optional), texts, assets, the game's own Sanity content types

---

## 8. Known pitfalls (to give to the AI)
- **Opening phase**: in Courtisans, the opening was first triggered on the client by "missions not read" while the engine started straight in the play phase. Check that UI triggers match the engine's real states (a bug found late because the simulated data did not reflect the engine) → **always generate mocks from the engine**.
- **Order in `jsonb`**: the state is stored as `jsonb`, which does not keep the order of the keys of an object (shortest key first, then alphabetical). Anything that depends on an order (seats, who is pending, who plays next) comes from an array, never from `Object.keys` of a record. A test that builds the state from `JSON.parse` of keys in database order catches it (see `game.test.ts` of the demo).
- **`waitingFor` is public**: it is shown to everybody. If knowing who is still pending reveals something hidden, keep the player in the list until the information is public anyway.
- **Sanity images in a CSS mask**: blocked cross-origin → go through `/api/media` (same origin). `next/image` only accepts the configured qualities (75 by default).
- **SVGs with a small intrinsic size** (24×24) as a 3D texture → blurry: rasterize them at 512 px before `CanvasTexture`.
- **React effects** depending on objects recreated on each render (filtered view, settings) → depend on a stable key (string), otherwise timers get cancelled in a loop.
- **Costly 2D canvas** (`shadowBlur` per frame) → pre-render the sprites.
- **WebGL capture**: `preserveDrawingBuffer: true` + a dedicated camera; hide the objects attached to the camera.
- **Nicknames in the board's HTML** (analytics): players who accepted cookies have their session recorded, with every input masked and the nicknames printed by core (`ph-mask`). A nickname the game prints itself in HTML (the 3D canvas is not recorded) needs the class `ph-mask`, and `ph-no-capture` as well when it sits inside a button or a link: a click is captured with the text of the element. Table codes never go into an event (`scrub.ts` removes them from addresses and titles).
- **The cookie bar under the board** (analytics): until a visitor answers, a one-line bar is docked to the bottom of the screen. It publishes its height as `--consent-h` on `<body>` (0px without a bar) and pads the page by it, so the game's own full-height or bottom-fixed elements must make room: `h-[calc(100dvh-var(--consent-h,0px))]` instead of `h-dvh`, `bottom-[var(--consent-h,0px)]` instead of `bottom-0`. Otherwise a button of the game sits under the bar until the visitor answers. `packages/core/components/consent-room.test.ts` scans `games/<slug>/src` and fails on a class that does not (one class string per line), so the miss shows up in `pnpm test`. A canvas that fills its parent follows on its own: it resizes when the bar appears or closes.
- **Booklet texts**: the AI rephrases them (copyright); Oré can paste the official text in Sanity directly.
- **Git locks**: if the AI cannot delete files in the folder, git may leave `.lock` files → allow deletion or remove them by hand.

---

## 9. Useful commands
```bash
pnpm install
pnpm dev                                   # apps/web on http://localhost:3100 (hub + every game)
pnpm dev:studio <slug>                     # the game's Sanity Studio
pnpm --filter @<slug>/engine test          # the game's engine tests
pnpm test && pnpm typecheck
pnpm --filter <slug>-studio typegen        # regenerates src/sanity/types.ts
pnpm --filter <slug>-studio schema:deploy
pnpm --filter <slug>-studio run deploy
```

### Environment variables (`apps/web/.env.local`, never committed)

`pnpm setup-env` applies the pending Supabase migrations, fills them (Supabase keys of the preview project from `~/.config/pbgo/secrets.env`, admin account and session secret, Sanity write tokens, reused when they exist) and pushes them to the Vercel project (the production project's keys to the Production target only).

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, one `SANITY_API_WRITE_TOKEN_<SLUG>` per game (Editor, for `/gamemaster/<slug>`), optional `NEXT_PUBLIC_SANITY_DATASET` (`production` by default), `VERCEL_TOKEN` and `VERCEL_TEAM_ID` (both or neither) for the stats of Admin › Monitoring, and `DEBUG_GAMES=1`.
