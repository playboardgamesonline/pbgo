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
  - `src/lib/ui-theme.ts` — `UI_THEME`, how the shared in-game UI keeps the banquet look: announcements in the accent font, white with a gold outline and gold hairlines, gold star confetti; round seat discs with a pale ring and the title font; a game over on the navy surface with a gold line and a cream polaroid; `motion: "lively"` (confetti, springs, emoji burst; reduced motion still wins). The look changes there, never in a copy of a shared component
- `apps/studio` — Sanity Studio on `@pbgo/studio-kit` (the game's own `texts` replaces the shared version)
- `packages/engine` — pure TypeScript engine (`@courtisans/engine`), `GAME` = `@pbgo/engine-kit` contract, tested with Vitest
- `content/` — the game's translations in Sanity as versioned code (its data and its config) and the seed script, run by the shared `@pbgo/content-kit` (see Content below); `vitest.config.ts` runs its tests

## Sanity
- Project `2lo2f5sv`, dataset `production`, studio `courtisans.sanity.studio`; admin writes use `SANITY_API_WRITE_TOKEN_COURTISANS`
- Shared (studio-kit): `settings` (logo, theme, fonts, credits), `interface` (top/bottom decor, character = the Queen, also the cover of the hub card, pattern, host pictogram, player colors), `texts` (interface labels, victory sentences + `missionsButton`, `banquetStarts`, the hidden home heading, the genres, the two status wordings and, in its Board tab, the 17 words of the table)
- Game-specific: `game` (mat, backs, pictograms, arrows, paper), `family`, `role`, `courtier`, `mission` + recursive `condition` object (values = engine keys). No `rules` document: the rules are PDF links, set in `settings` (Gamemaster › Mechanics)
- Queries in `src/sanity/queries.ts`, then `pnpm --filter courtisans-studio typegen`
- Migration to core (English values, shared skin): `pnpm --filter @pbgo-game/courtisans sanity:migrate-core` (dry run) then `--confirm`, then the studio's `schema:deploy` and `deploy`

## Content (Sanity)
28 documents, all translations (GAM-20): the name of the 6 families, the name and rule of the 4 roles, the text of 17 of the 20 missions, and the `texts` singleton (tagline, home title and introduction, victory sentences, the 17 interface labels, the 12 error messages, the missions button and the start of the banquet, the hidden home heading, the genres, the two status wordings and the 17 words of the board, in its Board tab). Each one already exists, published, in the Studio with its colour, card, condition and pictogram, so the seed makes a draft of it and fills the languages it misses: no document is created from nothing, no image is placed (`slots: []`), the 30 courtiers and every other document are not touched
- Every text was copied word for word from what the game showed before its texts moved to Sanity, nothing is invented: the straight apostrophes and trailing `…` of the source stay (the other games' seeds use the typographic ’). What the Studio already says wins: a French value that differs from the code's (the four role rules, the victory sentences, the missions button) is reported as "Kept as edited in Sanity" and the other languages are filled around it
- Left out on purpose: `mission-dark-8`, `-9` and `-10`. The French text and the condition the Studio holds are not the ones the code translates, so copying the code's English, Spanish and German would give players another mission than the one the engine checks. They need translations of the Studio's French, read by the owner
- No text stays in the code (GAM-22): the board vocabulary (`courtier`, the zones, the verbs and draw lines, the game over log…), the status wordings, the hidden home heading and the genres each have a field of `texts`. A text Sanity does not have reads `[missing: <field>]` on the page and is logged once per language on the server. There is no default mission: a game whose Sanity holds too few missions of a colour does not start. `src/lib/site.ts` keeps the name, the author, the contact, the keywords and the list of error codes (their messages are in Sanity)
- `pnpm --filter @pbgo-game/courtisans content:seed --dry-run` shows what would change, `--apply` writes the drafts. Nothing is published from code; the owner reviews and publishes in the Studio (the site reads the published documents)
- `pnpm --filter @pbgo-game/courtisans test` and `typecheck` cover `content/` (no network, nothing written): the seed data against the rules of the Studio forms and the real Studio schema, and the seed run against an in-memory dataset. The seed stays as the record of what was written
- The pipeline itself is `@pbgo/content-kit` (`packages/content-kit`); the whole process and what Courtisans gets: `docs/content-pipeline.md` at the root

## Commits
Gitmoji format: `<emoji>(courtisans): <description>`
