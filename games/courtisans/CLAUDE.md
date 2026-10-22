# Courtisans Online

Online version of the board game **Courtisans** (Catch Up Games), served by the single app `apps/web` at `/courtisans` on top of `@pbgo/core`.
Detailed architecture (intentions, tuning, pitfalls): `ARCHITECTURE.md`, a snapshot from before the move to core; it keeps the old French identifiers and paths, which are outdated.

## Code conventions
- English everywhere: identifiers, files, engine values, Sanity fields, comments. Player-facing texts, in every language, live in Sanity only (`texts`, `family`, `role`, `mission`), never in the code: a text Sanity does not have shows as `[missing: <key>]`
- Glossary: courtisan → `courtier`, famille → `family` (`butterfly`, `toad`, `nightingale`, `hare`, `stag`, `carp`), rôle → `role` (`noble`, `spy`, `assassin`, `guard`), domaine → `domain`, table de la Reine → `table` (levels `up` = light / `down` = disgrace), statut → `status` (`light`, `disgrace`, `neutral`), pioche → `deck`, main → `hand`, tapis → `mat`, siège → `seat`, journal → `log`, partie → `game`

## Assets
Nothing of this game is served from `apps/web/public`: every picture file and every sound comes from Sanity (`game`, `family`, `role`, `courtier`, `mission`, `interface`, `settings`, `audio`). The code holds colours and the sound mix (`src/lib/sounds.ts`: volume and spacing of each effect; an effect with no file in Gamemaster › Audio stays silent). A picture that is missing is drawn as a plain stand-in on the table and stays visible: the `[textures]` report in the browser console, the Launch checklist and the "No file in Sanity" badge of Gamemaster › Audio.

## Structure
- `package.json` — `@pbgo-game/courtisans`, the binding package loaded by `@pbgo/games`
  - `src/index.ts` (engine `GAME`, site constants and `ERROR_CODES`, `SOUNDS`, `DEFAULT_SKIN`, `UI_THEME`, `SETTINGS_DEFAULTS`), `src/ui.tsx` (`Logo`, `Game` loaded on demand), `src/server.ts` (`loadSetupData` = missions, `loadGameData` = catalog with the board's words, `SEO` = genres and hidden heading, read from `texts`), `src/runtime.tsx` (fonts, `styles.css`, `BindingProvider`)
  - `src/components/game` — board (`game.tsx`: opening, interactions, announcements, end), messages, pictograms, score detail
    - opening: the banquet waits until every player has read their missions (engine phase `missions`: `GAME.waitingFor` = the players who have not read, `GAME.autoPlayFor` reads for one of them). After the idle delay the players present can vote to read for the latecomers: core's `StalledTurn` with the `missionsSkip*` labels, `POST /api/courtisans/games/<code>/takeover`; the opening has no route of its own
  - `src/components/game3d` — react-three-fiber scene (`layout.ts` computes the poses, `scene.tsx` moves each card to its pose)
  - `src/lib/catalog.ts` (the catalog's types, the fields of the board's vocabulary and the catalog shown when Sanity answers nothing: every text a `[missing: …]` marker, no picture; the pictures and texts come from Sanity), `src/lib/skin.ts` (colours of the banquet skin, never an image or a text), `src/lib/sounds.ts` (the sound mix; the files are in Sanity)
  - `src/lib/ui-theme.ts` — `UI_THEME`, how the shared in-game UI keeps the banquet look: announcements in the accent font (uploaded in Gamemaster › Visual), white with a gold outline and gold hairlines, gold star confetti; round seat discs with a pale ring and the title font; a game over on the navy surface with a gold line and a cream polaroid; `motion: "lively"` (confetti, springs, emoji burst; reduced motion still wins). The look changes there, never in a copy of a shared component
- `apps/studio` — Sanity Studio on `@pbgo/studio-kit` (the game's own `texts` replaces the shared version)
- `packages/engine` — pure TypeScript engine (`@courtisans/engine`), `GAME` = `@pbgo/engine-kit` contract, tested with Vitest

## Sanity
- Project `2lo2f5sv`, dataset `production`, studio `courtisans.sanity.studio`; admin writes use `SANITY_API_WRITE_TOKEN_COURTISANS`
- Shared (studio-kit): `settings` (logo, theme, fonts, credits; the accent font is the file uploaded in Gamemaster › Visual), `interface` (top/bottom decor, character = the Queen, also the cover of the hub card, pattern, host pictogram, player colors), `texts` (interface labels, victory sentences + `missionsButton`, `banquetStarts`, the hidden home heading, the genres, the two status wordings and, in its Board tab, the 17 words of the table)
- Game-specific: `game` (tabs Board: mat and its texture, Card backs, Arrows), `family`, `role` (name, key, copies per family, pictogram, lettering: no `Rule` field), `courtier`, `mission` + recursive `condition` object (values = engine keys). No `rules` document: the rules are PDF links, set in `settings` (Gamemaster › Mechanics)
- Queries in `src/sanity/queries.ts`, then `pnpm --filter courtisans-studio typegen`

## Content (Sanity)
Everything the players read, see or hear is in Sanity, in every language (GAM-20, GAM-22, GAM-23): the name of the 6 families, the name of the 4 roles, the text of the 20 missions, the `texts` singleton (tagline, home title and introduction, victory sentences, the 17 interface labels, the 12 error messages, the missions button and the start of the banquet, the hidden home heading, the genres, the two status wordings and the 17 words of the board, in its Board tab), the pictures, the sounds and the accent font (Typey, `settings.accentFontFile`). The code holds none of it: a text Sanity does not have reads `[missing: <field>]` on the page and is logged once per language on the server, a picture it does not have is drawn as a plain stand-in. There is no default mission: a game whose Sanity holds too few missions of a colour does not start. `src/lib/site.ts` keeps the name, the author, the contact, the keywords and the list of error codes (their messages are in Sanity)
- The seed that wrote the translations (GAM-20, GAM-22) is gone: Sanity is the record, edited in the Studio and in the gamemaster. The documents are never created from code
- `mission-dark-8`, `-9` and `-10` have their English, Spanish and German as drafts, written from the Studio's French, for the owner to read and publish. `mission-dark-10` is checked by a condition that counts the cards below the mat in total (no family filter), while its French text says "of each family": to settle with the owner
- The body font is Alegreya Variable from npm (`src/styles.css`); titles follow it. Only the accent font is a file in Sanity

## Commits
Gitmoji format: `<emoji>(courtisans): <description>`
