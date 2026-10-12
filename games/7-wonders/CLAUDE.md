# 7 Wonders · Play Board Games Online

7 Wonders, served by `apps/web` at `/7-wonders`. Not playable yet: without an engine (`GAME`), its home page says "coming soon" and its table pages answer 404. Listed nowhere until `live` is set in the registry.

## Structure
- `package.json` — `@pbgo-game/7-wonders`, the binding package that `@pbgo/games` loads on demand
  - `src/lib/site.ts` — `SLUG`, `asset()`, name, tagline, description, keywords, genres (player-facing copy in French)
  - `src/index.ts` — the binding shared by the server and the client: site constants and the default look (none yet: the core theme, and icons generated from the title), replaced by what is set in `/7-wonders/admin`
  - `src/ui.tsx` — `Logo` · `src/runtime.tsx` — client runtime (styles, `BindingProvider`) · `src/server.ts` — server side (`SEO`)
- `packages/engine` — `@7-wonders/engine`, still the template's demo game (La Plus Haute): replace it with the game's engine (pure TypeScript, Vitest)
- `apps/studio` — `7-wonders-studio`, Sanity Studio of the project `xpof03pw` (not deployed yet: `pnpm go-live 7-wonders`)
- Static files: `apps/web/public/7-wonders/` (served at `/7-wonders/...`)

## Making it playable
Follow `template/CLAUDE.md` ("Adapting to a new game"): write the engine, export it as `GAME` from `src/index.ts`, add the board (`Game` in `src/ui.tsx`, loaded lazily as in the template), then set `live` (and `indexable` once it is ready for search engines) in `packages/games/src/registry.ts`.

## Commits
Gitmoji format: `<emoji>(7-wonders): <description>`
