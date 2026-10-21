# Courtisans Online

Online version of the board game **Courtisans** (Catch Up Games), served by the single app `apps/web` at `/courtisans` on top of `@pbgo/core`.
Detailed architecture (intentions, tuning, pitfalls): `ARCHITECTURE.md`, a snapshot from before the move to core; it keeps the old French identifiers and paths, which are outdated.

## Code conventions
- English everywhere: identifiers, files, engine values, Sanity fields, comments. Player-facing French texts live in `src/lib/site.ts`, `src/lib/i18n.ts` and the defaults (catalog, missions, rules)
- Glossary: courtisan → `courtier`, famille → `family` (`butterfly`, `toad`, `nightingale`, `hare`, `stag`, `carp`), rôle → `role` (`noble`, `spy`, `assassin`, `guard`), domaine → `domain`, table de la Reine → `table` (levels `up` = light / `down` = disgrace), statut → `status` (`light`, `disgrace`, `neutral`), pioche → `deck`, main → `hand`, tapis → `mat`, siège → `seat`, journal → `log`, partie → `game`

## Assets
Nothing of this game is served from `apps/web/public`: every picture file and every sound comes from Sanity (`game`, `family`, `role`, `courtier`, `mission`, `interface`, `settings`, `audio`). The code holds colours, texts and the sound mix (`src/lib/sounds.ts`: volume and spacing of each effect; an effect with no file in Gamemaster › Audio stays silent). A picture that is missing is drawn as a plain stand-in on the table and stays visible: the `[textures]` report in the browser console, the Launch checklist and the "No file in Sanity" badge of Gamemaster › Audio.

## Structure
- `package.json` — `@pbgo-game/courtisans`, the binding package loaded by `@pbgo/games`
  - `src/index.ts` (engine `GAME`, site constants, `SOUNDS`, `I18N`, `DEFAULT_SKIN`, `UI_THEME`, `SETTINGS_DEFAULTS`), `src/ui.tsx` (`Logo`, `Game` loaded on demand), `src/server.ts` (`loadSetupData` = missions, `loadGameData` = catalog, `SEO`), `src/runtime.tsx` (fonts, `styles.css`, `BindingProvider`)
  - `src/components/game` — board (`game.tsx`: opening, interactions, announcements, end), messages, pictograms, score detail
    - opening: the banquet waits until every player has read their missions (engine phase `missions`: `GAME.waitingFor` = the players who have not read, `GAME.autoPlayFor` reads for one of them). After the idle delay the players present can vote to read for the latecomers: core's `StalledTurn` with the `missionsSkip*` labels, `POST /api/courtisans/games/<code>/takeover`; the opening has no route of its own
  - `src/components/game3d` — react-three-fiber scene (`layout.ts` computes the poses, `scene.tsx` moves each card to its pose)
  - `src/lib/catalog.ts` (the catalog's types and its French texts; the pictures come from Sanity), `src/lib/skin.ts` (colours and texts of the banquet skin, never an image), `src/lib/sounds.ts` (the sound mix; the files are in Sanity)
  - `src/lib/ui-theme.ts` — `UI_THEME`, how the shared in-game UI keeps the banquet look: announcements in the accent font, white with a gold outline and gold hairlines, gold star confetti; round seat discs with a pale ring and the title font; a game over on the navy surface with a gold line and a cream polaroid; `motion: "lively"` (confetti, springs, emoji burst; reduced motion still wins). The look changes there, never in a copy of a shared component
- `apps/studio` — Sanity Studio on `@pbgo/studio-kit` (the game's own `texts` replaces the shared version)
- `packages/engine` — pure TypeScript engine (`@courtisans/engine`), `GAME` = `@pbgo/engine-kit` contract, tested with Vitest

## Sanity
- Project `2lo2f5sv`, dataset `production`, studio `courtisans.sanity.studio`; admin writes use `SANITY_API_WRITE_TOKEN_COURTISANS`
- Shared (studio-kit): `settings` (logo, theme, fonts, credits), `interface` (top/bottom decor, character = the Queen, also the cover of the hub card, pattern, host pictogram, player colors), `texts` (interface labels, victory sentences + `missionsButton`, `banquetStarts`)
- Game-specific: `game` (mat, backs, pictograms, arrows, paper), `family`, `role`, `courtier`, `mission` + recursive `condition` object (values = engine keys). No `rules` document: the rules are PDF links, set in `settings` (Gamemaster › Mechanics)
- Queries in `src/sanity/queries.ts`, then `pnpm --filter courtisans-studio typegen`
- Migration to core (English values, shared skin): `pnpm --filter @pbgo-game/courtisans sanity:migrate-core` (dry run) then `--confirm`, then the studio's `schema:deploy` and `deploy`

## Commits
Gitmoji format: `<emoji>(courtisans): <description>`
