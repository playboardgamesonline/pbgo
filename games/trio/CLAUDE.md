# Trio · Play Board Games Online

Trio, served by `apps/web` at `/trio`. Not playable yet: without an engine (`GAME`), its home page says "coming soon" and its table pages answer 404. Listed nowhere until `live` is set in the registry.

## Structure
- `package.json` — `@pbgo-game/trio`, the binding package that `@pbgo/games` loads on demand
  - `src/lib/site.ts` — `SLUG`, name, tagline, description, keywords, genres (player-facing copy in French)
  - `src/index.ts` — the binding shared by the server and the client: site constants and the default look (logo, icon, share image and colors), replaced by what is set in `/gamemaster/trio`
  - `src/ui.tsx` — `Logo` · `src/runtime.tsx` — client runtime (styles, `BindingProvider`) · `src/server.ts` — server side (`SEO`)
- `packages/engine` — `@trio/engine`, the engine to write (pure TypeScript, Vitest)
- `apps/studio` — `trio-studio`, Sanity Studio of the project `erf97a0b` (https://trio-online.sanity.studio)

## Making it playable
Follow `template/CLAUDE.md` ("Adapting to a new game"): write the engine, export it as `GAME` from `src/index.ts`, add the board (`Game` in `src/ui.tsx`, loaded lazily as in the template), then set `live` (and `indexable` once it is ready for search engines) in `packages/games/src/registry.ts`.

## Commits
Gitmoji format: `<emoji>(trio): <description>`
