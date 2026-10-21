# 6 qui prend ! · Play Board Games Online

6 qui prend !, served by `apps/web` at `/6-nimmt`. Not playable yet: without an engine (`GAME`), its home page says "coming soon" and its table pages answer 404. Listed nowhere until `live` is set in the registry.

## Structure
- `package.json` — `@pbgo-game/6-nimmt`, the binding package that `@pbgo/games` loads on demand
  - `src/lib/site.ts` — `SLUG`, name, tagline, description, keywords, genres (player-facing copy in French)
  - `src/index.ts` — the binding shared by the server and the client: site constants and the default look (none yet: the core theme, and icons generated from the title), replaced by what is set in `/gamemaster/6-nimmt`
  - `src/ui.tsx` — `Logo` · `src/runtime.tsx` — client runtime (styles, `BindingProvider`) · `src/server.ts` — server side (`SEO`)
- `packages/engine` — `@6-nimmt/engine`, still the template's demo game (La Plus Haute): replace it with the game's engine (pure TypeScript, Vitest)
- `apps/studio` — `6-nimmt-studio`, Sanity Studio of the project `t5dwtve1` (not deployed yet: `pnpm go-live 6-nimmt`)

## Making it playable
Follow `template/CLAUDE.md` ("Adapting to a new game"): write the engine, export it as `GAME` from `src/index.ts`, add the board (`Game` in `src/ui.tsx`, loaded lazily as in the template), then set `live` (and `indexable` once it is ready for search engines) in `packages/games/src/registry.ts`.

## Commits
Gitmoji format: `<emoji>(6-nimmt): <description>`
