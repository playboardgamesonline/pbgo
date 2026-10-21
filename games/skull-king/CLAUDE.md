# Skull King · Play Board Games Online

Skull King, served by `apps/web` at `/skull-king`. Not playable yet: without an engine (`GAME`), its home page says "coming soon" and its table pages answer 404. Listed nowhere until `live` is set in the registry.

## Structure
- `package.json` — `@pbgo-game/skull-king`, the binding package that `@pbgo/games` loads on demand
  - `src/lib/site.ts` — `SLUG`, name, keywords, genres, author, contact (no tagline, no description: a game's texts live in Sanity only)
  - `src/index.ts` — the binding shared by the server and the client: site constants and the default look (logo, icon, share image and colors), replaced by what is set in `/gamemaster/skull-king`
  - `src/ui.tsx` — `Logo` · `src/runtime.tsx` — client runtime (styles, `BindingProvider`) · `src/server.ts` — server side (`SEO`)
- `packages/engine` — `@skull-king/engine`, the engine to write (pure TypeScript, Vitest)
- `apps/studio` — `skull-king-studio`, Sanity Studio of the project `e9247r0u` (https://skull-king.sanity.studio)

## Making it playable
Follow `template/CLAUDE.md` ("Adapting to a new game"): write the engine, export it as `GAME` from `src/index.ts`, add the board (`Game` in `src/ui.tsx`, loaded lazily as in the template), then set `live` (and `indexable` once it is ready for search engines) in `packages/games/src/registry.ts`.

## Commits
Gitmoji format: `<emoji>(skull-king): <description>`
