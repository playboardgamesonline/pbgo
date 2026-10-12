# Play Board Games Online · monorepo

oré's online board games in one repository (`playboardgamesonline/playboardgamesonline`), a pnpm workspace served by **one Next.js app** on `playboardgamesonline.app`: the hub at `/`, each game at `/<slug>`.

Moving the project to another account: see `MIGRATION.md`.

## Structure
- `apps/web/` — `web`, the only Next.js app (hub + every game). Vercel project `playboardgamesonline`, root directory `apps/web`
- `games/<slug>/` — one game = packages only, no app of its own:
  - `src/` — the binding package `@pbgo-game/<slug>`: site constants, engine binding, board, server loaders, sounds, defaults, i18n, skin
  - `packages/engine` — `@<slug>/engine`, the pure TypeScript engine (no UI), tested with Vitest
  - `apps/studio` — `<slug>-studio`, the game's Sanity Studio
  - `assets/` — sources (PDF, PSD, HD visuals), git-ignored
- `template/` — the game template, itself a game (`@pbgo-game/template`, demo "La Plus Haute", served at `/template`). See `template/CLAUDE.md` and `template/docs/GAME_GUIDE.md`
- `packages/` — shared code (below)
- `supabase/migrations/` — schema of the single Supabase project
- `scripts/` — `new-game.sh`, `go-live.sh`, `add-game.sh`, `setup-env.sh` (helpers in `lib.sh`), `run.sh`, `check-catalog.mjs`

## Routes (`apps/web/src/app`)
| URL | File | |
| --- | --- | --- |
| `/` | `(hub)/page.tsx` | hub: the live games of the registry |
| `/legal` | `(hub)/legal/page.tsx` | legal notice |
| `/design` | `(hub)/design/page.tsx` | design system reference: every token and component (noindex, not in the sitemap) |
| `/<slug>` | `[game]/page.tsx` | game home ("coming soon" when the game is not playable here) |
| `/<slug>/game/<code>` | `[game]/game/[code]/page.tsx` | table (lobby, board, game over) |
| `/<slug>/admin/...` | `[game]/admin/[[...section]]/page.tsx` | the game's admin |
| `/<slug>/preview/home\|game` | `[game]/preview/[kind]/page.tsx` | admin previews (iframe) |
| `/<slug>/icons/favicon\|apple`, `/<slug>/manifest.webmanifest`, `/<slug>/opengraph-image/share` | `[game]/...` | the game's metadata files |
| `/api/<slug>/games/...`, `/api/<slug>/admin/...`, `/api/<slug>/feedback`, `/api/<slug>/tasks/...` | `api/[game]/...` | the game's API |
| `/api/admin/login\|logout`, `/api/media` | `api/...` | shared: one admin session for every game, Sanity media proxy |
| `/robots.txt`, `/sitemap.xml` | `robots.ts`, `sitemap.ts` | site-wide |
| `/favicon.ico` | `public/favicon.ico` | the hub's icon: a static file answers before `[game]`, so `favicon.ico` is never read as a slug. Not `app/favicon.ico`: Next adds that one to the head of every page, game pages included, next to their own `/<slug>/icons/*` |

- The hub (`(hub)/layout.tsx`) and the games (`[game]/layout.tsx`) have separate root layouts; `global-not-found.tsx` answers any URL that matches no route. Links from the hub to a game are plain `<a>` (full page load).
- Route files are thin wrappers: pages call `@pbgo/core/pages/*` with the game (`gameOf` / `playableGameOf` from `apps/web/src/lib/game.ts`), API routes wrap the `@pbgo/core/routes/api/**` handler with `gameRoute()` from `@pbgo/games`. Segment configs (`dynamic`, `revalidate`) stay written out in the app (Next does not read them through a re-export).
- 404: a URL that matches no route (`/x/a/b/c`, `/<slug>/not-a-page`) gets `global-not-found.tsx`, rendered on the server. A page that calls `notFound()` (`gameOf` / `playableGameOf`: unknown slug, missing table, admin section or preview) gets `[game]/not-found.tsx` (`GameNotFound`): the game's own 404 for a slug of the registry, the site's 404 for any other slug. Next 16.4 answers a page's `notFound()` with status 404 and `noindex` but renders the not-found UI on the client (the server HTML has an empty body).
- The `[game]` layout is a root layout, so it must not call `notFound()` itself: nothing sits above it to catch the error and Next answers with its own default 404 page. For an unknown slug it renders a bare `<html>` shell and each page's `gameOf` answers 404. `dynamicParams = false` is not enforced on these dynamic pages.
- A game that is not playable here (no engine, or not live in production) keeps its home page ("coming soon"); its table, admin, previews and API answer 404 (`GAME_NOT_FOUND`).
- A game's public files live in `apps/web/public/<slug>/` (URL `/<slug>/...`); build their URLs with `asset()` of the game's `src/lib/site.ts`. Paths derive from the slug: no base path, no `withBase()`.
- `api`, `legal` and `design` are routes of `apps/web`, so none of them can be a game slug (`registry.test.ts`, `pnpm new-game`)

## Games registry (`packages/games`, `@pbgo/games`)
- `src/registry.ts` — `GAMES`, pure data read by the hub, the sitemap, the router, `next.config.ts` and the scripts: `slug`, `name`, `tagline`, `players`, `duration` (minutes), `visual` (cover art of the hub card, a public path under `/<slug>/`), `sanityProjectId`, `live` (playable in production; every game stays playable outside production), `indexable` (sitemap, no `noindex`)
- `src/index.ts` (server) — `LOADERS`: slug → `() => import("@pbgo-game/<slug>/server")`; `getGame`, `getPlayableGame`, `gameRoute`
- `src/runtime.tsx` (client) — `RUNTIMES`: slug → `dynamic(() => import("@pbgo-game/<slug>/runtime"))`, mounted by the `[game]` layout
- Code splitting: a page loads only its game's code; the hub loads none (no three.js). Never import a game package statically from shared code.
- Adding a game = one `@pbgo-game/<slug>` package + one entry in `GAMES`, `LOADERS` and `RUNTIMES` + the dependency in `packages/games/package.json` (`pnpm new-game` does all of it)

## A game's binding package (`@pbgo-game/<slug>`)
Contract types in `@pbgo/core/lib/binding` (`GameBinding`, `UiBinding`, `ServerBinding`):
- `.` (`src/index.ts`, isomorphic) — `SLUG`, `NAME`, `TAGLINE`, `DESCRIPTION`, `AUTHOR`, `CONTACT`… (from `src/lib/site.ts`), the engine `GAME` (absent: not playable yet); optional `SOUNDS`, `I18N`, `DEFAULT_SKIN`, `SETTINGS_DEFAULTS`, `ERROR_MESSAGES`, `REACTIONS`, `STUDIO_URL`
- `./ui` (`src/ui.tsx`, client) — `Logo`, `Game` (the board, loaded lazily so the home page does not pull in three.js)
- `./server` (`src/server.ts`, server only) — everything of `.` plus optional `loadSetupData` (data for `GAME.setup`), `loadGameData` (`data` prop of the board), `ROUTES` (the game's own routes, `/api/<slug>/games/<code>/<route>`), `SEO`
- `./runtime` (`src/runtime.tsx`, client) — the game's styles and fonts and `BindingProvider`
- `./styles.css` — the game's Tailwind entry: imports `@pbgo/core/styles/game.css` (theme tokens, `@source` to `packages/core` and `packages/ui`), then `@source "."` and the game's own tokens and fonts
- Core never imports a game: pages and API handlers receive the `GameModule`, client components read it with `useBinding()`

## Shared packages (`packages/`)
A change here reaches every game on the next deployment.
- `@pbgo/core` — the shared base: server (`server/*`: Supabase games with a version lock, players, admin, stats, tasks, rate limiting), `lib/*` (binding contract, api, realtime, settings, rules, i18n, skin, sound, site URLs), components (home, lobby, game context, HUD, chat, game over, sharing, admin, toolbar), pages (`pages/home|game|admin|preview`), route handlers (`routes/api/**/route.ts`), metadata images
  - Standard screens and game flow (from Courtisans): `Screen` (home, invitation, lobby), `GameHud` + `Ticker` + `groupTurns` + `useAnnouncements`, `GameOver` (`renderDetail` for the score detail), sound (`lib/sound.ts`, `SoundButton`, `SoundEngine`), `DesktopOnly`, leva debug panel, all mounted by `AppShell` in the `[game]` layout
  - `DesktopOnly`: full-screen wall under 900 px on game pages only (`/<slug>/game/…`, admin preview included); the home and public pages stay readable on mobile (SEO), with `DesktopNotice` and no table creation from a narrow screen
  - Skin (`lib/skin.ts`, `loadSkin`, `useSkin`, `useText`): Sanity `interface` (top/bottom art, character, pattern, host icon, player colors, desktop only) + `texts` (home intro, victory lines, `UI_TEXTS` labels of `@pbgo/studio-kit/constants`); a game's defaults in `DEFAULT_SKIN`
  - Who the game waits for (engine contract v2): `GAME.waitingFor(state)` = the players the game waits for (several on a simultaneous step), `GAME.autoPlayFor(state, playerId)` = plays the current step for one of them. Core reads them only through the `@pbgo/engine-kit` helpers `waitingPlayers`, `canPlayFor`, `playFor`; the legacy `activePlayer` / `autoPlay` still work (`@deprecated`). `waitingFor` is public: `PublicGame.waitingFor`, next to `present` (members seen in the last 75 s) and `takeovers` (per waiting player: required voters and votes so far)
  - Absent player: after `settings.turnTimeout` (60 s by default, Admin › Mechanics) without a write, `StalledTurn` offers the present players to vote, per absent player (`/takeover`, which plays with `playFor`); the opening of Courtisans (missions to read) is an ordinary takeover too. Rules in `server/takeover.ts` (pure, tested): a player is played for once every member seen in the last 75 s, other than them, has voted for them; an absent player never blocks
  - Concurrent writes: `updateGame` retries up to 8 times with a growing random wait
  - Accent font (announcements, intro): CSS variable `--font-accent`
- `@pbgo/games` — the registry (above)
- `@pbgo/engine-kit` — engine ↔ web contract (`GameDefinition` with `waitingFor` / `autoPlayFor`, `Results`…), turn helpers (`waitingPlayers`, `currentPlayer`, `canPlayFor`, `playFor`, `playOn`), game options (`defaultOptions`, `normalizeOptions`), `EngineError`. A game's engine re-exports it: `export * from "@pbgo/engine-kit"`
  - Building blocks of the card games, pure, seeded and tested, each documented in `packages/engine-kit/README.md`: `rng` (`createSaveableRng` / `restoreRng` carry a stream from one action to the next, `shuffle`, `sideSeed`), `ids` (numeric opaque card ids, `reissueId` when a card goes back into hiding), `deck` (`draw`, `peek`, `insertAt`, `reshuffleDiscard`, `drawWithReshuffle`, `deal`), `log` (`viewLog`: entries filtered per viewer), `rounds` (`roundsOutcome`, `sumRounds`, `ranks`: scores until a target), `simultaneous` (`Submissions<T>`, `openSubmissions`, `submit`, `pendingSubmissions(submissions, seatIds)`, `allSubmitted`, `submittedFlags`, `revealSubmissions`)
  - Lean state, for every game (PLT-45): the state holds ids and numbers only, no display data, no derived values, no log
  - The state is stored as `jsonb`, which does not keep the order of the keys: an order (seats, turns) always comes from an array of the state, never from `Object.keys`
- `@pbgo/ui` — shadcn components + `cn`: `@pbgo/ui/game/<comp>` (game theme), `@pbgo/ui/platform/<comp>` (platform theme: hub, account, legal, admin, 404), `@pbgo/ui/styles/platform.css` (platform tokens), `@pbgo/ui/theme` (`PLATFORM_THEME_COLOR`), `@pbgo/ui/utils`. See Design system
- `@pbgo/studio-kit` — shared Sanity schemas (`settings`, `interface`, `rules`, `texts` via `createTexts(extra)`, `localeString`…) and `createStudioConfig({ title, projectId, gameTypes })` (a game type with the same name replaces the shared one); `@pbgo/studio-kit/constants` (languages, `FONT_CHOICES`) importable on the web side
- `@pbgo/tsconfig`, `@pbgo/eslint-config` — shared TypeScript and ESLint configs
- Every external dependency comes from the pnpm catalog (`catalog:` in `package.json`, versions in `pnpm-workspace.yaml`); `pnpm check:catalog` enforces it
- A new workspace package used by apps/web goes into `transpilePackages` (`apps/web/next.config.ts`; game packages are added from the registry)

## Design system (`@pbgo/ui`)
Black and white, dark theme only, Geist Sans in semibold with tight line-height and letter-spacing. No accent colour, no gradient: game art is the only colour on the platform. Every token and component is shown on the internal page `/design` (`(hub)/design/page.tsx`, noindex, not in the sitemap): it is the reference, check it before building a screen.
- Two layers share the token names (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--radius`, `--font-body`…):
  - Platform layer (hub, account, legal, admin, 404): values in `packages/ui/src/styles/platform.css`, scoped to the class `.platform`. The class sits on `<html>` (hub and 404, through `PlatformDocument`), on the admin wrapper and on the root of every portal (select, dropdown, dialog, sheet, tooltip, toast), which React renders outside the wrapper. Components: `@pbgo/ui/platform/*`
  - Game layer: the `:root` values of `packages/core/styles/game.css`, overridden at runtime by the game's Sanity skin (inline style on `<html>`, `themeStyle()`). Components: `@pbgo/ui/game/*`. A game changes its look by changing token values, never a component
- Boundary: the platform never sets a value on `:root` and a game never sets one on `.platform`. In `platform.css`, `@theme` only defines new names (`shadow-surface|float|overlay`, `duration-fast|base|slow`, `ease-standard`, `bg-scrim`, `max-w-page|reading`, `px-gutter`, `py-section`); a name Tailwind already has (type-scale line-heights, `--tracking-tight`, `--default-transition-*`, `--font-weight-*`) gets its platform value inside `.platform`, or every game would inherit it
- Palette: Tailwind's `neutral` scale (chroma 0) and `destructive`, nothing else. One font weight (600): `font-medium`, `font-bold`… resolve to it, so don't write them. Depth: `shadow-surface|float|overlay` and `ring-1 ring-foreground/10`. Motion: `duration-fast|base|slow`, `ease-standard`. Shapes: `rounded-*`, scaled from `--radius`
- `PLATFORM_THEME_COLOR` (`@pbgo/ui/theme`) is the browser colour of platform pages; `theme.test.ts` keeps it equal to `--background`. `platform.test.ts` rejects `dark:`, palette and hard-coded colours, arbitrary sizes and the old `admin` names in `packages/ui/src/platform/*`
- A new component: `pnpm dlx shadcn@latest add <comp>` (preset `beEgoY8u`), move it to `packages/ui/src/platform`, import `cn` from `../utils`, make it dark-only and token-only, show it on `/design`, then use it

## Commands (from the root)
- `pnpm install` — once for the whole monorepo
- `pnpm dev` — apps/web on http://localhost:3100 (hub + every game; `pnpm dev <slug>` prints its URL)
- `pnpm dev:studio <slug>` — the game's Sanity Studio
- `pnpm build` (= `pnpm --filter web build`) · `pnpm typecheck` · `pnpm test` · `pnpm lint` · `pnpm check:catalog`
- `pnpm --filter @<slug>/engine test` · `pnpm --filter @pbgo/core test`
- `pnpm new-game <slug>` — `games/<slug>` from `template/`, registered in `packages/games` (not live)
- `pnpm go-live <slug>` — Sanity side: project, public dataset, CORS, studio deployed, project id written in the registry, write token in `apps/web/.env.local`
- `pnpm add-game <slug> [--push]` — new-game + go-live + setup-env; `--push` commits and pushes a branch for a pull request
- `pnpm setup-env [--no-push | --check]` — fills `apps/web/.env.local` and pushes the variables to the Vercel project `playboardgamesonline`; aborts, touching neither, when a Supabase value is missing or a project can't be used (see Environment)

## Package names
`@pbgo-game/<slug>` (binding), `@<slug>/engine`, `<slug>-studio` (template: `@pbgo-game/template`, `@template/engine`, `template-studio`). Always target a package with `--filter`.

## Deployment
- One Vercel project, `playboardgamesonline` (root directory `apps/web`), owns the domain `playboardgamesonline.app`. Push to `main` = production; every pull request gets a preview
- A game reaches production when `live: true` in the registry; `indexable: true` lets search engines in. Only Courtisans is live and indexable
- `robots.txt` disallows `/api/`, `/*/admin`, `/*/preview`, `/*/game/`; the sitemap lists the hub and the indexable games; non-indexable game pages carry `noindex`

## Environment (`apps/web/.env.example`)
- Local values in `apps/web/.env.local`, never committed; on Vercel, on the project `playboardgamesonline`. `pnpm setup-env` fills both from `~/.config/pbgo/secrets.env` (outside the repo, `chmod 600`)
- The secrets file holds `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` (production) and `SUPABASE_PREVIEW_PROJECT_REF` (`pbgo-preview`), all three required: `pnpm setup-env` refuses to run without them. The production project's keys go to the Vercel Production target only; `apps/web/.env.local` and the Vercel Preview and Development targets get the preview project's keys, never production ones. A project that is unreachable, whose keys can't be read, or that still has the one-project-per-game schema (`public.games` without a `game` column) stops the run before anything is written or sent. `--check` only validates the three values
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` · `ADMIN_LOGIN`, `ADMIN_PASSWORD` (one admin account for every game) · optional `VERCEL_TOKEN`, `VERCEL_TEAM_ID` (Admin › Audience and Health), `NEXT_PUBLIC_SITE_URL`, `DEBUG_GAMES=1`
- `SANITY_API_WRITE_TOKEN_<SLUG>` per game, slug upper-cased with `-` → `_` (`6-nimmt` → `SANITY_API_WRITE_TOKEN_6_NIMMT`); without it, that game's admin is read-only

## Sanity
- One Sanity project per game (`sanityProjectId` in the registry), dataset `production`, studio `<slug>-studio` deployed to `<host>.sanity.studio`
- The studio reads its project id from `apps/studio/.env` (`SANITY_STUDIO_PROJECT_ID`, see `.env.example`) or from `sanity.cli.ts`
- A game's own content types: schemas in `apps/studio/schemaTypes`, queries in the binding's `src/sanity/`, then `pnpm --filter <slug>-studio typegen`
- Media proxy `GET /api/media?url=` (shared by every game; fonts, sounds, SVG) only serves `https://cdn.sanity.io/(images|files)/<projectId>/…` where `<projectId>` is the `sanityProjectId` of a game of the registry (`sanityAssetUrl` in `packages/core/sanity/media.ts`, which also refuses `%` in the path and fetches the normalized URL). Core never imports the games: `apps/web/src/app/api/media/route.ts` passes the ids to `mediaRoute()`

## Supabase
- One project for every game (production), plus `pbgo-preview` for local development and Vercel previews. Schema: `supabase/migrations` (`games`, `tasks`, `feedback`, each with a `game` column = the slug; RLS on without policies, only the server reads and writes)
- Realtime is broadcast only: after each write the server sends `update` on `game:<slug>:<code>`, clients refetch their view (`GET /api/<slug>/games/<code>`)
- Player identity: httpOnly cookie `<slug>_player`
- Presence: `games.seen` (jsonb, player id → last time the server saw them), written by the RPC `touch_game_player` (migration `0002_presence.sql`) on reads and writes of a table, at most every 15 s per player (`server/presence.ts`, after the response); it touches neither `version` nor `updated_at`. The takeover only counts the members seen in the last 75 s

## Languages (FR / EN / ES / DE)
- `LANGUAGES` in `packages/studio-kit/src/constants.ts` is the single source (it also feeds the Sanity `localeString` fields). Adding a language = add it there, then the translations below (TypeScript flags what is missing)
- Visitor language: cookie `pbgo-locale` (selector in the toolbar), else `Accept-Language` (unsupported language: English; no header: French). Same URL for everyone; `getLocale()` (`lib/locale-server.ts`) reads cookie and headers, so pages render on demand (Sanity data still cached 60 s)
- Shared texts: French in `UI_TEXTS`, default translations in `packages/studio-kit/src/translations.ts` (labels + errors). A text typed in the admin (Copy) wins, language by language; without one in that language, the code's translation applies (never Sanity's French)
- A game provides its non-French texts through the optional `I18N` of its binding (`skin`, `description`, `authors`, `errors`); Courtisans adds `src/lib/i18n.ts` (board, missions, families, roles) and `src/lib/i18n-rules.ts` (rules)
- Rules: Sanity in the language, else Sanity in French, else the default rules of the language

## Admin (`/<slug>/admin`, all in English)
- Sidebar (`lib/admin-nav.ts`): **Setup** (Identity, Mechanics, Visual, Audio, Copy) · **Tasks** (Launch, Backlog, Bugs, Feedback) · **Monitoring** (Games, Audience, Health)
- Setup data: `server/settings.ts` (`readAdminData`, `saveSection(section, values)`, `uploadAsset(slot, file)`), routes `/api/<slug>/admin/settings` and `/api/<slug>/admin/upload/[slot]`. Sanity documents: `settings` (Identity, Mechanics, colors and fonts), `interface` (Visual images, player colors, desktopOnly), `audio` (music, ambience, effects, volumes), `texts` (Copy, including `errorMessages`)
- Upload conversions (`server/convert.ts`): images → WebP (SVG kept), favicon → PNG 512, share image → JPG 1200×630, TTF/OTF fonts → WOFF2. Sounds: MP3, 4 MB max
- Previews: iframe on `/<slug>/preview/home` and `/<slug>/preview/game` (admin only, fake game), draft sent by `postMessage` (`lib/preview.ts`, `components/preview-bridge.tsx`); API calls are neutralized there
- Favicon and share image: `app/[game]/icons/*/route.ts`, `app/[game]/opengraph-image.tsx` → `@pbgo/core/metadata/images` (file uploaded in Identity, else generated from the logo and skin)
- Sounds: `lib/sound-config.ts` (types, sounds declared by the game), `lib/audio-server.ts` (`loadAudio` merges Sanity `audio`); files in `apps/web/public/<slug>/sounds`, Admin › Audio › "Import into Sanity" uploads them
- Absent player: `POST /api/<slug>/games/<code>/takeover` = per-player votes `(voter, target)` of the present players, kept in `games.takeover_votes` as `<state fingerprint>:<voter>:<target>` (stale as soon as a move is played, no custom route in any game)
- Tasks: table `tasks` (`type` backlog|bug, `priority`), table `feedback` (the game's feedback button, `POST /api/<slug>/feedback`). Launch = checklist checked against the site (`server/launch.ts`)
- Game options: defaults and hidden options set in Mechanics (`settings.options`, `gameOptions()` in `lib/settings.ts`)

## Rate limiting
- Every mutating game route (create, join, leave, options, start, action, replay, takeover) and `POST /api/<slug>/feedback` start with `await rateLimit(game.slug, request, "<rule>")` (`server/rate-limit.ts`). Limits live in `RATE_LIMITS` (`server/rate-limiter.ts`): per player cookie when present, else per IP (create: always per IP), never per table, plus a per-IP ceiling across routes. Over the limit: 429 `RATE_LIMITED` + `Retry-After`. The chat route has its own per-player token bucket
- `POST /api/admin/login` belongs to no game: it starts with `await rateLimit(null, request, "adminLogin")`, 5 attempts per 10 minutes per IP, counted before the credentials are checked (the right password is refused too once the limit is reached)
- Counters are in memory, per function instance; to share them, implement `RateLimitStore` and call `setRateLimitStore()`. A new mutating route of a game (`ROUTES`) must call `rateLimit` too

## Game UI
- Settings menu (`components/toolbar.tsx`): a button next to the logo opens rules, sound, feedback and language
- Chat (`components/game/chat.tsx`, mounted by `GameHud`): Supabase realtime broadcast without storage; sent through `POST /api/<slug>/games/<code>/chat` (author = player cookie, member of the game, ≤ 200 characters or a known reaction), the server broadcasts (`lib/chat.ts`), clients only listen
- Turn crown left of the active player's nickname (template: `game3d/crown.tsx`; Courtisans: `CrownMark`)
- Game over: centered table, "hide / show" link above the centered PLAY AGAIN button

## Rules of work
- English everywhere: code, comments, docs, commits, PRs. Only player-facing texts are in other languages (Sanity, `I18N`, a game's defaults)
- Platform UI (hub, account, legal, admin, 404) uses only `@pbgo/ui` tokens and components, never a hard-coded colour, font or spacing; a new component goes into `@pbgo/ui` first (see Design system)
- Branch named after the Linear issue (`plt-<n>-<topic>`); the PR description references the issue ID; never merge your own PR
- Never commit secrets or env files (`.env*` except `.env.example`, `.vercel`, `.sanity-project-id` are git-ignored)

## Commits
Git identity: `oré ˖ ࣪⊹) <hey@aurelienlouvel.space>` (GitHub account `aurelienlouvel`), never the work address, or Vercel blocks the deployment. Set it once per clone, in the repo-local config, so commits need no `-c` flags: `git config user.name "oré ˖ ࣪⊹)"` and `git config user.email "hey@aurelienlouvel.space"`
Gitmoji `<emoji>(<scope>): <description>` · scopes: `<slug>`, `template`, `core`, `repo` (e.g. `✨(skull-king): …`, `🔧(repo): …`)
