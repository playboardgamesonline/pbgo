# Courtisans Online

Online version of the board game **Courtisans** (Catch Up Games), served by the single app `apps/web` at `/courtisans` on top of `@pbgo/core`.
Detailed architecture (intentions, tuning, pitfalls): `ARCHITECTURE.md`, written in French before the move to core; its paths and names are outdated.

## Code conventions
- English everywhere: identifiers, files, engine values, Sanity fields, comments. Player-facing French texts live in `src/lib/site.ts`, `src/lib/i18n.ts` and the defaults (catalog, missions, rules)
- Glossary: courtisan → `courtier`, famille → `family` (`butterfly`, `toad`, `nightingale`, `hare`, `stag`, `carp`), rôle → `role` (`noble`, `spy`, `assassin`, `guard`), domaine → `domain`, table de la Reine → `table` (levels `up` = light / `down` = disgrace), statut → `status` (`light`, `disgrace`, `neutral`), pioche → `deck`, main → `hand`, tapis → `mat`, siège → `seat`, journal → `log`, partie → `game`

## Assets
Files in `apps/web/public/courtisans` (served at `/courtisans/...`), named in English `UPPER_SNAKE_CASE` (e.g. `home/QUEEN.webp`, `cards/SPY_HARE.webp`, `sounds/HOVER.mp3`), folders in lowercase English. Build paths with `asset()` from `src/lib/site.ts`.

## Structure
- `package.json` — `@pbgo-game/courtisans`, the binding package loaded by `@pbgo/games`
  - `src/index.ts` (engine `GAME`, site constants, `SOUNDS`, `I18N`, `DEFAULT_SKIN`, `SETTINGS_DEFAULTS`), `src/ui.tsx` (`Logo`, `Game` loaded on demand), `src/server.ts` (`loadSetupData` = missions, `loadGameData` = catalog, `ROUTES.banquet`, `SEO`), `src/runtime.tsx` (fonts, `styles.css`, `BindingProvider`)
  - `src/components/game` — board (`game.tsx`: opening, interactions, announcements, end), messages, pictograms, score detail
    - opening: the banquet waits until every player has read their missions (engine phase `missions`); after the idle delay, ready players can vote to start without the latecomers (`stalled-opening.tsx`, `POST /api/courtisans/games/<code>/banquet`, `src/server/banquet.ts`)
  - `src/components/game3d` — react-three-fiber scene (`layout.ts` computes the poses, `scene.tsx` moves each card to its pose)
  - `src/lib/catalog.ts` (default catalog), `src/lib/skin.ts` (default banquet skin), `src/lib/sounds.ts`
- `apps/studio` — Sanity Studio on `@pbgo/studio-kit` (the game's own `rules` and `texts` replace the shared versions)
- `packages/engine` — pure TypeScript engine (`@courtisans/engine`), `GAME` = `@pbgo/engine-kit` contract, tested with Vitest

## Sanity
- Project `2lo2f5sv`, dataset `production`, studio `courtisans.sanity.studio`; admin writes use `SANITY_API_WRITE_TOKEN_COURTISANS`
- Shared (studio-kit): `settings` (logo, theme, fonts, credits), `interface` (top/bottom decor, character = the Queen, pattern, host pictogram, player colors), `texts` (interface labels, victory sentences + `missionsButton`, `banquetStarts`)
- Game-specific: `game` (mat, backs, pictograms, arrows, paper), `rules` (illustrated tabs, defaults in `src/lib/default-rules.ts`), `family`, `role`, `courtier`, `mission` + recursive `condition` object (values = engine keys)
- Queries in `src/sanity/queries.ts`, then `pnpm --filter courtisans-studio typegen`
- Migration to core (English values, shared skin): `pnpm --filter @pbgo-game/courtisans sanity:migrate-core` (dry run) then `--confirm`, then the studio's `schema:deploy` and `deploy`

## Commits
Gitmoji format: `<emoji>(courtisans): <description>`
