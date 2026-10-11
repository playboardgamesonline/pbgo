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
| `/<slug>` | `[game]/page.tsx` | game home ("coming soon" when the game is not playable here) |
| `/<slug>/game/<code>` | `[game]/game/[code]/page.tsx` | table (lobby, board, game over) |
| `/<slug>/admin/...` | `[game]/admin/[[...section]]/page.tsx` | the game's admin |
| `/<slug>/preview/home\|game` | `[game]/preview/[kind]/page.tsx` | admin previews (iframe) |
| `/<slug>/icons/favicon\|apple`, `/<slug>/manifest.webmanifest`, `/<slug>/opengraph-image/share` | `[game]/...` | the game's metadata files |
| `/api/<slug>/games/...`, `/api/<slug>/admin/...`, `/api/<slug>/feedback`, `/api/<slug>/tasks/...` | `api/[game]/...` | the game's API |
| `/api/admin/login\|logout`, `/api/media` | `api/...` | shared: one admin session for every game, Sanity media proxy |
| `/robots.txt`, `/sitemap.xml` | `robots.ts`, `sitemap.ts` | site-wide |

- The hub (`(hub)/layout.tsx`) and the games (`[game]/layout.tsx`) have separate root layouts; `global-not-found.tsx` answers any other URL. Links from the hub to a game are plain `<a>` (full page load).
- Route files are thin wrappers: pages call `@pbgo/core/pages/*` with the game (`gameOf` / `playableGameOf` from `apps/web/src/lib/game.ts`), API routes wrap the `@pbgo/core/routes/api/**` handler with `gameRoute()` from `@pbgo/games`. Segment configs (`dynamic`, `revalidate`) stay written out in the app (Next does not read them through a re-export).
- Unknown slug → 404. A game that is not playable here (no engine, or not live in production) keeps its home page ("coming soon"); its table, admin, previews and API answer 404 (`GAME_NOT_FOUND`).
- A game's public files live in `apps/web/public/<slug>/` (URL `/<slug>/...`); build their URLs with `asset()` of the game's `src/lib/site.ts`. Paths derive from the slug: no base path, no `withBase()`.

## Games registry (`packages/games`, `@pbgo/games`)
- `src/registry.ts` — `GAMES`, pure data read by the hub, the sitemap, the router, `next.config.ts` and the scripts: `slug`, `name`, `tagline`, `players`, `sanityProjectId`, `live` (playable in production; every game stays playable outside production), `indexable` (sitemap, no `noindex`)
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
  - Absent player: after `settings.turnTimeout` (60 s by default, Admin › Mechanics) without a write, `StalledTurn` offers the others to play for them (`/takeover`, which uses `GAME.autoPlay` or `GAME.debug.turn` and `GAME.activePlayer`)
  - Concurrent writes: `updateGame` retries up to 8 times with a growing random wait
  - Accent font (announcements, intro): CSS variable `--font-accent`
- `@pbgo/games` — the registry (above)
- `@pbgo/engine-kit` — engine ↔ web contract (`GameDefinition`, `Results`…), game options (`defaultOptions`, `normalizeOptions`), `EngineError`, `createRng` / `shuffle`. A game's engine re-exports it: `export * from "@pbgo/engine-kit"`
- `@pbgo/ui` — shadcn components + `cn`: `@pbgo/ui/game/<comp>` (game theme), `@pbgo/ui/admin/<comp>` (luma preset of the admin), `@pbgo/ui/utils`
- `@pbgo/studio-kit` — shared Sanity schemas (`settings`, `interface`, `rules`, `texts` via `createTexts(extra)`, `localeString`…) and `createStudioConfig({ title, projectId, gameTypes })` (a game type with the same name replaces the shared one); `@pbgo/studio-kit/constants` (languages, `FONT_CHOICES`) importable on the web side
- `@pbgo/tsconfig`, `@pbgo/eslint-config` — shared TypeScript and ESLint configs
- Every external dependency comes from the pnpm catalog (`catalog:` in `package.json`, versions in `pnpm-workspace.yaml`); `pnpm check:catalog` enforces it
- A new workspace package used by apps/web goes into `transpilePackages` (`apps/web/next.config.ts`; game packages are added from the registry)

## Commands (from the root)
- `pnpm install` — once for the whole monorepo
- `pnpm dev` — apps/web on http://localhost:3100 (hub + every game; `pnpm dev <slug>` prints its URL)
- `pnpm dev:studio <slug>` — the game's Sanity Studio
- `pnpm build` (= `pnpm --filter web build`) · `pnpm typecheck` · `pnpm test` · `pnpm lint` · `pnpm check:catalog`
- `pnpm --filter @<slug>/engine test` · `pnpm --filter @pbgo/core test`
- `pnpm new-game <slug>` — `games/<slug>` from `template/`, registered in `packages/games` (not live)
- `pnpm go-live <slug>` — Sanity side: project, public dataset, CORS, studio deployed, project id written in the registry, write token in `apps/web/.env.local`
- `pnpm add-game <slug> [--push]` — new-game + go-live + setup-env; `--push` commits and pushes a branch for a pull request
- `pnpm setup-env [--no-push]` — fills `apps/web/.env.local` and pushes the variables to the Vercel project `playboardgamesonline`

## Package names
`@pbgo-game/<slug>` (binding), `@<slug>/engine`, `<slug>-studio` (template: `@pbgo-game/template`, `@template/engine`, `template-studio`). Always target a package with `--filter`.

## Deployment
- One Vercel project, `playboardgamesonline` (root directory `apps/web`), owns the domain `playboardgamesonline.app`. Push to `main` = production; every pull request gets a preview
- A game reaches production when `live: true` in the registry; `indexable: true` lets search engines in. Only Courtisans is live and indexable
- `robots.txt` disallows `/api/`, `/*/admin`, `/*/preview`, `/*/game/`; the sitemap lists the hub and the indexable games; non-indexable game pages carry `noindex`

## Environment (`apps/web/.env.example`)
- Local values in `apps/web/.env.local`, never committed; on Vercel, on the project `playboardgamesonline`. `pnpm setup-env` fills both from `~/.config/pbgo/secrets.env` (outside the repo, `chmod 600`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` · `ADMIN_LOGIN`, `ADMIN_PASSWORD` (one admin account for every game) · optional `VERCEL_TOKEN`, `VERCEL_TEAM_ID` (Admin › Audience and Health), `NEXT_PUBLIC_SITE_URL`, `DEBUG_GAMES=1`
- `SANITY_API_WRITE_TOKEN_<SLUG>` per game, slug upper-cased with `-` → `_` (`6-nimmt` → `SANITY_API_WRITE_TOKEN_6_NIMMT`); without it, that game's admin is read-only

## Sanity
- One Sanity project per game (`sanityProjectId` in the registry), dataset `production`, studio `<slug>-studio` deployed to `<host>.sanity.studio`
- The studio reads its project id from `apps/studio/.env` (`SANITY_STUDIO_PROJECT_ID`, see `.env.example`) or from `sanity.cli.ts`
- A game's own content types: schemas in `apps/studio/schemaTypes`, queries in the binding's `src/sanity/`, then `pnpm --filter <slug>-studio typegen`

## Supabase
- One project for every game (production), plus `pbgo-preview` for local development and Vercel previews. Schema: `supabase/migrations` (`games`, `tasks`, `feedback`, each with a `game` column = the slug; RLS on without policies, only the server reads and writes)
- Realtime is broadcast only: after each write the server sends `update` on `game:<slug>:<code>`, clients refetch their view (`GET /api/<slug>/games/<code>`)
- Player identity: httpOnly cookie `<slug>_player`

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
- Absent player: `POST /api/<slug>/games/<code>/takeover` = unanimous vote of the other players (`games.takeover_votes`, stale as soon as a move is played)
- Tasks: table `tasks` (`type` backlog|bug, `priority`), table `feedback` (the game's feedback button, `POST /api/<slug>/feedback`). Launch = checklist checked against the site (`server/launch.ts`)
- Game options: defaults and hidden options set in Mechanics (`settings.options`, `gameOptions()` in `lib/settings.ts`)

## Rate limiting
- Every mutating game route (create, join, leave, options, start, action, replay, takeover, Courtisans `banquet`) and `POST /api/<slug>/feedback` start with `await rateLimit(game.slug, request, "<rule>")` (`server/rate-limit.ts`). Limits live in `RATE_LIMITS` (`server/rate-limiter.ts`): per player cookie when present, else per IP (create: always per IP), never per table, plus a per-IP ceiling across routes. Over the limit: 429 `RATE_LIMITED` + `Retry-After`. The chat route has its own per-player token bucket
- `POST /api/admin/login` belongs to no game: it starts with `await rateLimit(null, request, "adminLogin")`, 5 attempts per 10 minutes per IP, counted before the credentials are checked (the right password is refused too once the limit is reached)
- Counters are in memory, per function instance; to share them, implement `RateLimitStore` and call `setRateLimitStore()`. A new mutating route of a game (`ROUTES`) must call `rateLimit` too

## Game UI
- Settings menu (`components/toolbar.tsx`): a button next to the logo opens rules, sound, feedback and language
- Chat (`components/game/chat.tsx`, mounted by `GameHud`): Supabase realtime broadcast without storage; sent through `POST /api/<slug>/games/<code>/chat` (author = player cookie, member of the game, ≤ 200 characters or a known reaction), the server broadcasts (`lib/chat.ts`), clients only listen
- Turn crown left of the active player's nickname (template: `game3d/crown.tsx`; Courtisans: `CrownMark`)
- Game over: centered table, "hide / show" link above the centered PLAY AGAIN button

## Rules of work
- English everywhere: code, comments, docs, commits, PRs. Only player-facing texts are in other languages (Sanity, `I18N`, a game's defaults)
- Branch named after the Linear issue (`plt-<n>-<topic>`); the PR description references the issue ID; never merge your own PR
- Never commit secrets or env files (`.env*` except `.env.example`, `.vercel`, `.sanity-project-id` are git-ignored)

## Commits
Git identity: `oré <hey@aurelienlouvel.space>` (GitHub account `aurelienlouvel`), never the work address, or Vercel blocks the deployment.
Gitmoji `<emoji>(<scope>): <description>` · scopes: `<slug>`, `template`, `core`, `repo` (e.g. `✨(skull-king): …`, `🔧(repo): …`)
