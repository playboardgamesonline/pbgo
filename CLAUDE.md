# Play Board Games Online · monorepo

oré's online board games in one repository (`playboardgamesonline/pbgo`), a pnpm workspace served by **one Next.js app** on `playboardgamesonline.app`: the hub at `/`, each game at `/<slug>`, and the back office of all of them (the gamemaster) at `/gamemaster`.

Moving the project to another account: see `MIGRATION.md`.

This file is a map: structure, routes, commands, rules of work. The detail of each area is in `docs/` (list at the end, Where to read more).

## Structure
- `apps/web/` — `web`, the only Next.js app (hub, every game and the gamemaster). Vercel project `pbgo`, root directory `apps/web`
- `games/<slug>/` — one game = packages only, no app of its own:
  - `src/` — the binding package `@pbgo-game/<slug>`: site constants, engine binding, board, server loaders, sounds, defaults, i18n, skin
  - `packages/engine` — `@<slug>/engine`, the pure TypeScript engine (no UI), tested with Vitest
  - `apps/studio` — `<slug>-studio`, the game's Sanity Studio
  - `content/` — the game's Sanity content as versioned code (its data and its config) and a seed script that writes drafts, run by the shared `@pbgo/content-kit` (Hanabi, Exploding Kittens and Flip 7, see `docs/content-pipeline.md`)
  - `assets/` — sources (PDF, PSD, HD visuals), git-ignored. The seed's art folder is outside the repo (Hanabi: `~/Companies/PBGO/assets/hanabi`) and is passed with an absolute `--art-dir`
- `template/` — the game template, itself a game (`@pbgo-game/template`, demo "La Plus Haute", served at `/template`). See `template/CLAUDE.md` and `template/docs/GAME_GUIDE.md`
- `platform/` — the platform's own Sanity project (the hub's catalog, articles, changelog, announcements), package `@pbgo/platform`: `apps/studio` (`platform-studio`, its Studio) and `content/` (the seed that imports the Notion Games rows). See `docs/platform-sanity.md`
- `packages/` — shared code (below)
- `docs/` — the detail behind this map, one file per area (see Where to read more), and `content-pipeline.md` (seeding a game's Sanity content)
- `supabase/migrations/` — schema of the single Supabase project
- `scripts/` — `new-game.sh`, `go-live.sh`, `add-game.sh`, `game-rules.sh`, `setup-env.sh` (helpers in `lib.sh`), `run.sh`, `check-catalog.mjs`
- `.claude/skills/` — the agents' skills by category (`game-`, `engine-`, `platform-`): the questions, rules and commands of a recurring job, written once. `README.md` lists them

## Routes (`apps/web/src/app`)
| URL | File | |
| --- | --- | --- |
| `/` | `(hub)/page.tsx` | hub: the title (two lines in sentence case, Geist at 720, in full white, `display-title`, some letters being a die, a heart, a coin and two cards, which play now and then and when the pointer comes onto one: `TitlePiece`), what the platform is under it (its figures in pills, the players online, the members and the games, and what is free: `Stats`, `Perks`), the glass search bar 64px under that, on the page's black, flat, then the sections of the platform with no visible title (popular games in a grid that fades out, tables and tournaments in progress, what's new), each with a button to the page of its tab |
| `/games` | `(hub)/games/page.tsx` | every game of the catalog in one list, under its title (`page-title`: 8rem, Geist at 720, -0.048em) and the search bar with its filters (the live games of the registry, then the games to come, with a "Coming soon" badge); each card opens `/game/<slug>` |
| `/game/<slug>` | `(hub)/game/[slug]/page.tsx` | a game's page on the hub: its head (description, credits, the picture of its card), a big zone to create a game, a link to `/<slug>` (half transparent when the game is not live), with the tables being created, then its tournaments, its rulebooks and the games recommended with it (its family first, then the games that look like it). Every game of the catalog has one; indexable when the game is (a live game: its registry flag; a game to come: a description in its game of the platform's Sanity project), else `noindex` and out of the sitemap (`docs/catalog.md`) |
| `/legal` | `(hub)/legal/page.tsx` | legal notice |
| `/design`, `/design/foundations`, `/design/components`, `/design/components/<controls\|navigation\|overlays\|surfaces\|social>`, `/design/in-game` | `(hub)/design/**` | design system reference, in pages by family with a side navigation (the list of the pages and of their sections is `_components/pages.ts`): the overview, the tokens, every component of the platform in five pages, then the shared in-game UI drawn in the look of two games side by side (noindex, not in the sitemap) |
| `/tables`, `/tournaments`, `/pricing`, `/about` | `(hub)/<tab>/page.tsx` | the other tabs of the hub's navbar (`/games` is the first; the logo is the home; the bar is the hub layout's, mounted once): `noindex` and out of the sitemap: all four have the head of `/games` (`ListPageHeader`: the title in `page-title`, then, for `/tables` and `/tournaments`, the search bar of what they will list, "Search tables...", with no filters yet; `/pricing` and `/about` have the title alone). `/tables` and `/tournaments` have an empty state for now (`ComingSoonPage`); `/about` has a stub and a "What's new" section, `#whats-new`, which `/whats-new` redirects to; `/pricing` shows a Monthly | Annually selector (a year costs a quarter less) and three plans (`PlanCard`: Free, Plus at €0.99 a month and Club at €3.99, words in `apps/web/src/lib/plans.ts`; a first draft, the paid ones are half transparent and disabled since the games are not licensed), a line that says so and a message that invites the publishers to write |
| `/privacy`, `/terms` | `(hub)/<page>/page.tsx` | the footer's Privacy Policy and Terms of Use: pages that say their text is being written (`LegalStubPage`), `noindex` (the cookie policy is `/legal#cookies`) |
| `/login` | `(hub)/login/page.tsx` | sign-in (Supabase Auth) with a username (an e-mail address for now) and a password, or with Facebook, Google, Apple or Discord (four small buttons side by side), on the hub's backdrop; `?next=` is where to go back to (`docs/accounts.md`), `noindex` |
| `/me`, `/me/games`, `/me/friends` | `(hub)/me/**` | the pages of a signed-in visitor: profile, games, friends (their friends, conversations and requests are also the social panel, the side panel that the navbar's dock opens, on every page of the hub); per request, `noindex`, and `apps/web/src/proxy.ts` sends a visitor who is not signed in to `/login` |
| `/auth/callback`, `/logout`, `/auth/demo` | `auth/callback/route.ts`, `logout/route.ts`, `auth/demo/route.ts` | the provider's way back (code for session, then `next`), sign-out (POST), and the demo account of development (404 in a build) |
| `/<slug>` | `[game]/page.tsx` | game home ("coming soon" when the game is not playable here) |
| `/<slug>/game/<code>` | `[game]/game/[code]/page.tsx` | table (lobby, board, game over) |
| `/<slug>/preview/home\|game` | `[game]/preview/[kind]/page.tsx` | admin previews (iframe): the game's own page, served to the signed-in gamemaster only (404 otherwise), see `docs/gamemaster.md` |
| `/gamemaster` | `gamemaster/page.tsx` | the gamemaster's overview: every game of the registry |
| `/gamemaster/login` | `gamemaster/login/page.tsx` | sign-in, one session for every game |
| `/gamemaster/<slug>/<section>...` | `gamemaster/[game]/[[...section]]/page.tsx` | a game's admin (Setup, Tasks, Monitoring); `/gamemaster/<slug>/preview/home\|game` is rewritten to `/<slug>/preview/...` |
| `/<slug>/admin/...` | `next.config.ts` | permanent redirect to `/gamemaster/<slug>/...` (the former per-game admin) |
| `/<slug>/icons/favicon\|apple`, `/<slug>/manifest.webmanifest`, `/<slug>/opengraph-image/share` | `[game]/...` | the game's metadata files |
| `/api/<slug>/games/...`, `/api/<slug>/feedback` | `api/[game]/...` | the game's public API |
| `/gamemaster/api/login\|logout`, `/gamemaster/api/<slug>/settings\|upload/<slot>\|tasks\|feedback` | `gamemaster/api/...` | the gamemaster's API: sign-in and sign-out, then everything that needs the session |
| `/api/media` | `api/media/route.ts` | Sanity media proxy, shared by every game |
| `/api/catalog/<slug>/<logo\|icon\|background\|publisher-<n>>` | `api/catalog/[slug]/[slot]/route.ts` | the icon of each publisher's website, found there by the server, and the old addresses of the pictures of the games of the hub, which lead to the image CDN of the platform's Sanity project (`@pbgo/catalog/route`), see `docs/catalog.md` |
| `/ingest/*` | `next.config.ts` (`beforeFiles` rewrites) | PostHog behind the site's own domain: `/ingest/static/*` and `/ingest/array/*` to its assets host, the rest to its ingest host (EU). Only with a PostHog key and host, see `docs/analytics.md` |
| `/robots.txt`, `/sitemap.xml` | `robots.ts`, `sitemap.ts` | site-wide |
| `/favicon.ico` | `public/favicon.ico` | the hub's icon: a static file answers before `[game]`, so `favicon.ico` is never read as a slug. Not `app/favicon.ico`: Next adds that one to the head of every page, game pages included, next to their own `/<slug>/icons/*` |

- Separate root layouts: the hub (`(hub)/layout.tsx`), the games (`[game]/layout.tsx`, which must not call `notFound()` itself) and the gamemaster (`gamemaster/layout.tsx`: platform look, no game runtime, noindex); `global-not-found.tsx` answers any URL that matches no route. Links from the hub to a game are plain `<a>` (full page load).
- Route files are thin wrappers: pages call `@pbgo/core/pages/*` with the game (`gameOf` / `playableGameOf` / `previewableGameOf`), API routes wrap the `@pbgo/core/routes/api/**` handlers with `gameRoute()` and the `@pbgo/core/routes/gamemaster/**` ones with `gamemasterRoute()` (both from `@pbgo/games`). A game that is not playable here (no engine, or not live in production) keeps its home page; its table and API answer 404.
- `apps/web/public` holds `favicon.ico` only (a game's pictures and sounds live in its Sanity project); the build fails on any other file (`pnpm check:public`).
- `api`, `legal`, `privacy`, `terms`, `design`, `games`, `tables`, `tournaments`, `whats-new`, `pricing`, `about`, `ingest`, `gamemaster`, `login`, `logout`, `auth`, `me`, `media`, `catalog` and `game` cannot be a game slug (`RESERVED_SLUGS` of `packages/games/src/slug.ts`).
- Every mutating game route starts with `await rateLimit(game.slug, request, "<rule>")`; so does a new route in a game's `ROUTES`.
- The rest (404 behaviour, segment configs, rate-limit rules): `docs/routing.md`.

## Games registry and shared packages (`packages/`)
A change in `packages/` reaches every game on the next deployment. Detail: `docs/packages.md`, and `docs/game-ui.md` for what core draws in a game.
- `@pbgo/games` — the registry: `GAMES` (pure data: `slug`, `name`, `live`, `indexable`, `sanityProjectId`…) in `src/registry.ts`, `LOADERS` (server) in `src/index.ts`, `RUNTIMES` (client) in `src/runtime.tsx`. Adding a game = one `@pbgo-game/<slug>` package + one entry in each of the three + the dependency in `packages/games/package.json` (`pnpm new-game` does all of it). Never import a game package statically from shared code: a page loads only its game's code.
- `@pbgo-game/<slug>` — a game's binding package; the contract is in `@pbgo/core/lib/binding` (`.` isomorphic, `./ui`, `./server`, `./runtime`, `./styles.css`). Core never imports a game: it receives the `GameModule`, client components read it with `useBinding()`.
- `@pbgo/core` — the shared base: server (Supabase games with a version lock, players, admin, tasks, rate limiting), pages, route handlers, and the in-game UI (screens, HUD, announcements, chat, game over), always drawn in the game's own look.
- `@pbgo/analytics` — PostHog: typed events with no personal data, consent-aware browser provider (`docs/analytics.md`).
- `@pbgo/accounts` — the accounts of the hub: sign-in with Facebook, Google, Apple and Discord through Supabase Auth (browser, server and proxy helpers), the account made of what the provider says, the safe way back after a sign-in, the figures of a profile, the demo account of development (`docs/accounts.md`).
- `@pbgo/catalog` — the games the hub lists, each one as its `game` of the platform's own Sanity project (`docs/platform-sanity.md`; read through the public API with no token, cached ten minutes), Courtisans included: the live games of the registry first, then the games to come in the Studio's `order`; a live game with no game there, or with the project down, gets a minimal row from the registry. The registry decides only `live`, `indexable` and the order of the live games, and a game's own Sanity project is read once one enters the game, never by the hub. The pictures are drawn from the project's image CDN, and the package also holds the route of the icons of the publishers' websites. The hub draws the list in one grid, each card opens the game's page, `/game/<slug>`, the games to come included, and that page ends with the games related to it, from the links of the Studio. It also makes the SEO of those pages: which may be indexed, their metadata, share image, JSON-LD and lines of the sitemap (PLT-56, PLT-83, PLT-90, `docs/catalog.md`).
- `@pbgo/engine-kit` — the engine ↔ web contract (`GameDefinition`, `waitingFor` / `autoPlayFor`, `EngineError`) and the building blocks of the card games. For every game the state is lean (ids and numbers only: no display data, no derived values, no log) and an order always comes from an array of the state, never from `Object.keys` (`jsonb` does not keep the order of the keys).
- `@pbgo/table` — the shared table tools of the boards (react-three-fiber): the `Table` (canvas, camera with its entrance, floor, lights, share photo), the `Surface` laid on it, the `Card` every game draws and the pictures it wears (`paintFace`, `standIn`), with the zones, seats and the debug panel to come (PLT-62). It depends on core, core never imports it, and a game imports it from its lazy board chunk only (`docs/packages.md`).
- `@pbgo/ui` — shadcn components: `@pbgo/ui/game/*` (game theme) and `@pbgo/ui/platform/*` (platform theme), see `docs/design-system.md`.
- `@pbgo/studio-kit` (shared Sanity schemas, `createStudioConfig` for a game's Studio and `createStandaloneStudioConfig` for one that is not a game's, languages) and `@pbgo/content-kit` (the seed pipeline of a Sanity project's content: a game's, the platform's), `@pbgo/tsconfig`, `@pbgo/eslint-config`.
- Every external dependency comes from the pnpm catalog (`catalog:`, enforced by `pnpm check:catalog`). A new workspace package used by `apps/web` goes into `transpilePackages` (`apps/web/next.config.ts`).

## Commands (from the root)
- `pnpm install` — once for the whole monorepo
- `pnpm dev` — apps/web on http://localhost:3100 (hub + every game; `pnpm dev <slug>` prints its URL)
- `pnpm dev:studio <slug>` — the game's Sanity Studio (`pnpm dev:studio platform`: the platform's)
- `pnpm build` (= `pnpm --filter web build`) · `pnpm typecheck` · `pnpm test` · `pnpm lint` · `pnpm check:catalog` · `pnpm check:public`
- `pnpm --filter @<slug>/engine test` · `pnpm --filter @pbgo/core test`
- `pnpm --filter @pbgo/platform content:seed` / `content:art` — the platform's seed (Notion rows → drafts) and the download of the Notion pictures (`docs/platform-sanity.md`)
- `pnpm catalog:list` — what the hub catalog would list right now (the live games + the published games of the platform's Sanity project) and which games of the Studio it leaves out and why; needs no key (`docs/catalog.md`)
- `pnpm new-game <slug> [--name "<Game Name>"]` — `games/<slug>` from `template/`, registered in `packages/games` (not live); the name defaults to the slug, capitalised
- `pnpm go-live <slug>` — Sanity side: project, public dataset, CORS, studio deployed, project id written in the registry, write token in `apps/web/.env.local`
- `pnpm add-game [<slug>] [--name "<Game Name>"] [--rules [<lang>=]<file.pdf> …] [--yes] [--dry-run] [--no-open] [--push]` — a new game from nothing to its Studio (new-game + go-live + rules PDFs + setup-env), checked first and confirmed before anything leaves the machine; the skill `game-new` (`/game-new <slug>`) runs it for the owner. All options and steps: `docs/scripts.md`
- `pnpm game-rules <slug> --rules [<lang>=]<file.pdf> […] [--dry-run] [--overwrite]` — a game's rulebook PDF per language into the draft of its `settings`, whatever its size (`docs/scripts.md`)
- `pnpm setup-env [--no-push | --check]` — applies the pending Supabase migrations, fills `apps/web/.env.local` and pushes the variables to the Vercel project `pbgo`; run it from an up-to-date `main`, never from a branch with an unmerged migration (`--no-push` stays on preview, `--check` validates the settings only). `docs/scripts.md`, `docs/supabase-and-env.md`

## Package names
`@pbgo-game/<slug>` (binding), `@<slug>/engine`, `<slug>-studio` (template: `@pbgo-game/template`, `@template/engine`, `template-studio`). Always target a package with `--filter`.

## Deployment
- One Vercel project, `pbgo` (root directory `apps/web`), owns the domain `playboardgamesonline.app`. Push to `main` = production; every pull request gets a preview
- A game reaches production when `live: true` in the registry; `indexable: true` lets search engines in. Only Courtisans is live and indexable
- `robots.txt` disallows `/api/` (but opens `/api/catalog/`, the icons of the games and of their publishers and the old addresses of the games' pictures), `/ingest/`, `/gamemaster`, `/*/preview`, `/*/game/`; the sitemap lists the hub, the indexable games and the indexable `/game/<slug>` pages (never the gamemaster); non-indexable game pages carry `noindex`. The hub's `/game/<slug>` pages are not covered by `/*/game/`: each says itself whether it may be indexed (a live game follows its registry flag, a game to come needs a description in its game of the platform's Sanity project, `docs/catalog.md`). Every `/gamemaster/**` response also has `X-Robots-Tag: noindex, nofollow` (`next.config.ts`) and the `noindex, nofollow` meta

## Content and data at a glance
- Sanity: one project per game (`sanityProjectId` in the registry), dataset `production`, and the platform's own (`mhgqs6fe`, the hub's catalog and editorial: `docs/platform-sanity.md`). Supabase: one project for every game (production) plus `pbgo-preview` for local development and Vercel previews. Languages: FR / EN / ES / DE (`LANGUAGES` in `packages/studio-kit/src/constants.ts` is the single source)
- Local values in `apps/web/.env.local`, never committed; `pnpm setup-env` fills them and the Vercel project from `~/.config/pbgo/secrets.env`
- Detail: `docs/sanity-and-languages.md`, `docs/supabase-and-env.md`

## Rules of work
- English everywhere: code, comments, docs, commits, PRs. Only player-facing texts are in other languages: a game's live in its Sanity project, the platform's in `UI_TEXTS` and `translations.ts`
- Platform UI (hub, account, legal, gamemaster, 404) uses only `@pbgo/ui` tokens and components, never a hard-coded colour, font or spacing; a new component goes into `@pbgo/ui` first (see `docs/design-system.md`)
- Branch named after the Linear issue (`plt-<n>-<topic>`); the PR description references the issue ID; never merge your own PR
- A PR that adds a migration says so in its description: Oré runs `pnpm setup-env` right after merging it, which applies the migration to preview, then to production (see `docs/supabase-and-env.md`)
- A recurring job is a skill of the agent that carries it out, `.claude/skills/<game|engine|platform>-<job>/SKILL.md`, listed in `.claude/skills/README.md`: its questions, rules and commands are written there once and other docs point to it. `CLAUDE.md` describes the codebase, it holds no procedure
- A game's texts, translations, images and sounds live in its Sanity project only, never in code (`docs/sanity-and-languages.md`)
- This file is loaded into every session, so it stays a map: the detail of an area goes into its `docs/` file, a procedure into a skill
- Never commit secrets or env files (`.env*` except `.env.example`, `.vercel`, `.sanity-project-id` are git-ignored)

## Commits
Git identity: `oré ˖ ࣪⊹) <hey@aurelienlouvel.space>` (GitHub account `aurelienlouvel`), never the work address, or Vercel blocks the deployment. Set it once per clone, in the repo-local config, so commits need no `-c` flags: `git config user.name "oré ˖ ࣪⊹)"` and `git config user.email "hey@aurelienlouvel.space"`
Gitmoji `<emoji>(<scope>): <description>` · scopes: `<slug>`, `template`, `core`, `repo` (e.g. `✨(skull-king): …`, `🔧(repo): …`)

## Where to read more
Open the file of the area you touch before changing it: it holds the full rules that this map only summarises.
- `docs/routing.md` — a route, a layout, a 404, a reserved slug, the rate limits
- `docs/packages.md` — `packages/`: the registry, a game's binding package, core's server, `engine-kit`, `ui`, the Sanity and content kits
- `docs/game-ui.md` — what a game shows around the board: HUD, announcements, seat label, game over, skin, chat, room for the cookie banner, `UI_THEME`, compact layout, motion
- `docs/design-system.md` — a platform screen (hub, account, legal, gamemaster, 404) or a `@pbgo/ui` component
- `docs/gamemaster.md` — the back office: session, sidebar, setup data, previews, tasks
- `docs/analytics.md` — a PostHog event, the consent banner, recordings, masking, table-code scrubbing
- `docs/accounts.md` — sign-in with Facebook, Google, Apple and Discord, the pages of a signed-in visitor, the friends' panel, what is a placeholder, what to set up in Supabase
- `docs/platform-sanity.md` — the platform's own Sanity project: the model of the catalog, the editorial and the (empty) shop block, its Studio, the seed of the Notion rows and its picture step, the order to publish in
- `docs/catalog.md` — the hub catalog: which games it lists, the platform's Sanity project it reads (the query, the order, the cache), the pictures and the publishers' icons, the SEO of the game pages, `pnpm catalog:list`
- `docs/sanity-and-languages.md` — a game's Sanity project, Studio forms, seeding, the media proxy; texts and the four languages
- `docs/supabase-and-env.md` — environment variables and secrets, Supabase migrations, realtime, presence
- `docs/scripts.md` — `pnpm add-game`, `pnpm game-rules`, `pnpm setup-env` in full
- `docs/content-pipeline.md` — seeding a game's Sanity content
- Elsewhere: `.claude/skills/README.md` (the agents' skills), `template/CLAUDE.md` and `template/docs/GAME_GUIDE.md` (building a game), `packages/engine-kit/README.md`, `packages/content-kit/README.md`, `MIGRATION.md` (moving the project to another account)
