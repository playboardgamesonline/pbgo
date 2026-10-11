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
| Hosting | **Vercel**, one project (`playboardgamesonline`, root `apps/web`), deployed from GitHub `main` | production + previews |

⚠️ Next.js 16 has breaking changes: the AI reads `apps/web/node_modules/next/dist/docs/` before coding (see `apps/web/AGENTS.md`).

---

## 2. Architecture (the principles every game keeps)

1. **The engine is the only source of the rules.** Everything that is a rule (setup, turn, legal actions, score, end) lives in `packages/engine`, in pure TypeScript, tested. It implements the `GameDefinition<State, Action, View>` contract (`setup`, `apply`, `view`, `isOver`, `options`, `clientActions`, `debug`). The front and the server only call `GAME`.
2. **Authoritative server.** The client only sends *intents* (`POST /api/<slug>/games/<code>/action`). The server loads the state, calls the engine, saves, broadcasts.
3. **View filtered per player.** The full state (`State`) is secret (hands, hidden cards). Each player only gets `GAME.view(state, playerId)` through `GET /api/<slug>/games/<code>`.
4. **"Ping + refetch" realtime.** After each write (optimistic lock on `version`), the server broadcasts `update` on the Supabase channel `game:<slug>:<code>`; clients refetch their view. No sensitive data in the channel.
5. **Identity without an account.** httpOnly cookie (`<slug>_player`) = player id. Nickname kept in the local profile (`<slug>:profile`).
6. **Declarative game options.** The game declares `options` (`number` / `choice` / `boolean`); the lobby renders them and the host edits them (`POST /api/<slug>/games/<code>/options`, values passed through `normalizeOptions`).
7. **Content in Sanity, defaults in the code.** The site works with an empty Sanity project (default rules, skin and texts); Sanity overrides them.
8. **3D = presentation only.** `layout.ts` computes *poses* (position / rotation) for each card from the view; `scene.tsx` animates each object to its pose. Same React key = same object ⇒ real moves (hand → table).
9. **DOM UI over the 3D** (header, log, announcements, game over, rules).
10. **Code split per game.** The hub loads no game code; a game's pages load only that game (`@pbgo/games` imports each binding on demand), and its board (three.js) only on the game page.

---

## 3. Files

```
apps/web/                          # 🌐 the only Next.js app (hub + every game)
├─ public/<slug>/                  # the game's static files, served at /<slug>/...
└─ src/app/
   ├─ (hub)/                       # / (hub), /legal
   ├─ [game]/                      # /<slug> (home), /<slug>/game/<code>, /<slug>/admin, /<slug>/preview/<kind>
   └─ api/[game]/…                 # /api/<slug>/games/…, tasks, feedback, admin (handlers of @pbgo/core)
packages/
├─ core/                           # everything shared: server, lib, components, pages, route handlers
├─ games/                          # registry slug → metadata + on-demand import of each binding
├─ engine-kit/, ui/, studio-kit/, site/, tsconfig/, eslint-config/
games/<slug>/                      # one game
├─ CLAUDE.md                       # project rules for the AI (FR → EN glossary of the game included)
├─ package.json                    # @pbgo-game/<slug>, the binding package
├─ src/
│  ├─ index.ts                     # GAME, site constants, SOUNDS, I18N, DEFAULT_SKIN… (server + client)
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
- **Apply the Supabase SQL migrations** (`supabase/migrations/*.sql`) when they change.
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
| 3 | **Engine**: types, setup, actions, scoring, filtered view, tests + simulation | 🤖 | green tests |
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
- Home, lobby and game options (rendered from `GAME.options`), chat, stalled turn, game over, sharing
- Debug: panel, tabs, `useSettings` (Copy values, FPS), START / NEXT TURN / END buttons
- Rules in tabs (Sanity singleton `rules` + code defaults)
- SEO (metadata, robots, sitemap, share image), `api/media` proxy, admin `/<slug>/admin` (Setup, Tasks, Monitoring + Vercel Web Analytics)

**Specific (written per game, in `games/<slug>`)**
- `packages/engine/src/<game>/` (rules, view, options, debug) and the `GAME` export
- `layout.ts` (where the cards go), `scene.tsx` (zones, interactions), `textures.ts`, `game.tsx` (header, the game's announcements)
- `src/lib/site.ts`, `DEFAULT_SKIN`, texts, assets, the game's own Sanity content types

---

## 8. Known pitfalls (to give to the AI)
- **Opening phase**: in Courtisans, the opening was first triggered on the client by "missions not read" while the engine started straight in the play phase. Check that UI triggers match the engine's real states (a bug found late because the simulated data did not reflect the engine) → **always generate mocks from the engine**.
- **Sanity images in a CSS mask**: blocked cross-origin → go through `/api/media` (same origin). `next/image` only accepts the configured qualities (75 by default).
- **SVGs with a small intrinsic size** (24×24) as a 3D texture → blurry: rasterize them at 512 px before `CanvasTexture`.
- **React effects** depending on objects recreated on each render (filtered view, settings) → depend on a stable key (string), otherwise timers get cancelled in a loop.
- **Costly 2D canvas** (`shadowBlur` per frame) → pre-render the sprites.
- **WebGL capture**: `preserveDrawingBuffer: true` + a dedicated camera; hide the objects attached to the camera.
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

`pnpm setup-env` fills them (Supabase keys from `~/.config/pbgo/secrets.env`, admin account, Sanity write tokens) and pushes them to the Vercel project.

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_LOGIN`, `ADMIN_PASSWORD`, one `SANITY_API_WRITE_TOKEN_<SLUG>` per game (Editor, for `/<slug>/admin`), optional `NEXT_PUBLIC_SANITY_DATASET` (`production` by default), `VERCEL_TOKEN` (+ `VERCEL_TEAM_ID`) for the stats of Admin › Monitoring, and `DEBUG_GAMES=1`.
