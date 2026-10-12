# Hanabi · Play Board Games Online

Hanabi, served by `apps/web` at `/hanabi`. Not playable yet: without an engine (`GAME`), its home page says "coming soon" and its table pages answer 404. Listed nowhere until `live` is set in the registry.

## Structure
- `package.json` — `@pbgo-game/hanabi`, the binding package that `@pbgo/games` loads on demand
  - `src/lib/site.ts` — `SLUG`, `asset()`, name, tagline, description, keywords, genres (player-facing copy in French)
  - `src/index.ts` — the binding shared by the server and the client: site constants and the default look (logo, icon, share image and colors), replaced by what is set in `/hanabi/admin`
  - `src/ui.tsx` — `Logo` · `src/runtime.tsx` — client runtime (styles, `BindingProvider`) · `src/server.ts` — server side (`SEO`)
- `packages/engine` — `@hanabi/engine`, the engine to write (pure TypeScript, Vitest)
- `apps/studio` — `hanabi-studio`, Sanity Studio of the project `srffdhjt` (https://hanabi.sanity.studio). Its own document types (`suit`, `card`, `bonusTile`, and the `game` singleton) are in `schemaTypes/`, the lists they share with the seed (suit keys, ranks, rating keys, bonus tile numbers) in `schemaTypes/constants.ts`
- `content/` — the Sanity content as versioned code and the seed script (see below); `vitest.config.ts` runs its tests
- Static files: `apps/web/public/hanabi/` (served at `/hanabi/...`)

## Content (Sanity)
51 documents: 7 suits (5 colours, multicolor, black), 35 cards (one per suit and value, with `quantity`: 70 in all), 6 Flamboyants bonus tiles, and the `game`, `rules` and `settings` singletons. Rules are in our own words in FR, EN, ES and DE; `settings` holds the credits (Antoine Bauza, Cocktail Games, link to the publisher) and the links to the publisher's rulebook PDFs.
- `pnpm --filter @pbgo-game/hanabi content:seed --dry-run` shows what would change, `--apply` writes the drafts. Nothing is published from code; the owner publishes in the Studio
- Art (66 slots) is dropped in `assets/art/` (git-ignored) under the slot's name (`card-red-3.png`, `suit-blue.svg`, `card-back.png`, `bonus-2.png`…) and placed with `--art-dir assets/art`. The files that exist today are publisher press visuals, not card faces: none is used
- The Hanabi binding does not read the `rules` document yet; the toolbar's Rules button opens the publisher's PDF
- `pnpm --filter @pbgo-game/hanabi test` and `typecheck` cover `content/` (no network, nothing written)
- The whole process, the options and the art naming: `docs/content-pipeline.md` at the root

## Making it playable
Follow `template/CLAUDE.md` ("Adapting to a new game"): write the engine, export it as `GAME` from `src/index.ts`, add the board (`Game` in `src/ui.tsx`, loaded lazily as in the template), then set `live` (and `indexable` once it is ready for search engines) in `packages/games/src/registry.ts`.

## Commits
Gitmoji format: `<emoji>(hanabi): <description>`
