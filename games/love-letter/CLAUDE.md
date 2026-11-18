# Love Letter · Play Board Games Online

Love Letter, served by `apps/web` at `/love-letter`. Not playable yet: without an engine (`GAME`), its home page says "coming soon" and its table pages answer 404. Listed nowhere until `live` is set in the registry. 2 to 6 players, the 2025 edition (Z-Man Games). The rules spec is `docs/games/love-letter/rules.md`.

## Structure
- `package.json` — `@pbgo-game/love-letter`, the binding package that `@pbgo/games` loads on demand
  - `src/lib/site.ts` — `SLUG`, name, keywords, genres, author, contact (no tagline, no description: a game's texts live in Sanity only)
  - `src/index.ts` — the binding shared by the server and the client: site constants and the default look (logo, icon, share image and colors), replaced by what is set in `/gamemaster/love-letter`
  - `src/ui.tsx` — `Logo` · `src/runtime.tsx` — client runtime (styles, `BindingProvider`) · `src/server.ts` — server side (`SEO`)
- `packages/engine` — `@love-letter/engine`, the engine to write (pure TypeScript, Vitest)
- `apps/studio` — `love-letter-studio`, Sanity Studio of the project `8h6tuu2t` (https://love-letter.sanity.studio). Its own document types (`character`, the `game` pictures) are in `schemaTypes/`, the lists they share with the seed (the ten keys and their English titles) in `schemaTypes/constants.ts`, and the guard of the forms is `studio-forms.test.ts` (`pnpm --filter love-letter-studio test`)
- `content/` — the Sanity content as versioned code (the game's data and config) and the seed script, run by the shared `@pbgo/content-kit` (see Content); `vitest.config.ts` runs its tests and those of `src`

## Content (Sanity)
12 documents, written as drafts: the owner publishes them in the Studio.
- 10 `character` documents, `character-spy` to `character-princess`: the ten characters of the 21 cards. The fields, in the order of the Studio form: the English game key (`key`, a dropdown of the ten keys, which the engine reads as they are with no mapping: append only, never rename), the printed value (`value`, 0 to 9, read-only, which sorts the list), the name (`name`, localized), the card text (`text`, localized), the copies (`quantity`) and last the visual (`image`)
- `game`, pictures only, in three tabs (Board with the optional mat, Card backs, Favor token with its symbol, its mask and its 3D model file), and `settings`, the credits only (Seiji Kanai, Z-Man Games and its link: the draft that holds the English rulebook only gets its gaps filled; no illustrator line, since `settings` has no field for one, and the booklet names Andrew Bosley for the character art; no description, the catalog's is English only)
- No Effect or Rule field: what a card does is the engine's, and the rules are the publisher's PDFs linked in `settings`. The card text is the one exception, a text to display on the card's plate, by decision, because the faces are blank. The engine never reads it and no test can check prose against the engine, so a rule that changes in the engine is changed in these texts by hand. No category (nothing on the table groups the ten characters) and nothing in `texts` or `audio` yet: the words of the options and the scores come after the engine, the words of the board with the board and the victory phrases at go-live, each a later pass of `game-sanity-create`

| Value | Key | English | French | Quantity |
| --- | --- | --- | --- | --- |
| 0 | `spy` | Spy | Espionne | 2 |
| 1 | `guard` | Guard | Garde | 6 |
| 2 | `priest` | Priest | Prêtre | 2 |
| 3 | `baron` | Baron | Baron | 2 |
| 4 | `handmaid` | Handmaid | Servante | 2 |
| 5 | `prince` | Prince | Prince | 2 |
| 6 | `chancellor` | Chancellor | Chancelier | 2 |
| 7 | `king` | King | Roi | 1 |
| 8 | `countess` | Countess | Comtesse | 1 |
| 9 | `princess` | Princess | Princesse | 1 |

- Names and texts: the English names are the 2025 rulebook's (p. 2) and the French ones the ten names printed on p. 2 of the publisher's French demo leaflet (`~/Companies/PBGO/assets/love-letter/rules-demo-fr.pdf`, © 2019 Z-Man Games, a document apart from the rulebook: names only, never rules). The ten English card texts were written for the platform from the rules spec, in our own words and not the publisher's. The ten French card texts are DRAFTS in our own wording, for the owner to read, with the leaflet's terms (manche, quitter la manche, en lice, pion Faveur). Spanish and German have no source and stay empty on purpose: 40 gaps (the name and the text of each character), which `content/data/schema.test.ts` states, and the board shows the English until someone fills them in the Studio
- `pnpm --filter @pbgo-game/love-letter content:seed --dry-run` shows what would change, `--apply` writes the drafts. Nothing is published from code. The token is `SANITY_API_WRITE_TOKEN_LOVE_LETTER`. `pnpm --filter @pbgo-game/love-letter test` and `typecheck` cover `content/` (no network, nothing written)
- To do with the engine: a `content/parity/engine.test.ts` (Flip 7's is the model) that holds the keys, the values and the quantities equal to the engine's catalogue, and the `typecheck` script of `package.json` gains `tsc --noEmit -p content/parity`

## Pictures
The owner's art is in `~/Companies/PBGO/_ASSETS/catalog/games/love-letter/` (the ten faces and the back in `cards/`, the favor token in `tokens/`, backgrounds, brand pictures, fonts and visuals) and goes in with the seed's 15 slots at step 7 (`game-assets`; the slots and their file names are in `docs/content-pipeline.md`, "Love Letter slots"). What the board needs from the faces, read from the pictures and measured on the files (confirm the geometry with a render):
- The faces are **blank plates**, 760 by 1060 px (38:53), opaque from edge to edge (`paintFace` of the table kit wants a full rectangle and cuts the corners): no name and no text is printed, so the board draws the Name and the Card text of the Studio over them. The **value and the copies are printed**: the value in a burgundy medallion at the top left (about x 45 to 235, y 50 to 245; the Spy's is a pointed-oval glyph standing for 0) and the copies as dots on the left edge under it (a gold dot is a copy that the classic version removes), so the board draws neither. The back is a full-bleed burgundy leaf pattern, no frame, no logo, no text
- The plates, in pixels of the 760 by 1060 file (a clean core is the largest empty rectangle found on the file; the visible plate is a little larger):

| Plate | Faces | Clean core | Notes |
| --- | --- | --- | --- |
| Name: the banner right of the medallion | all ten | x 307 to 583, y 72 to 149 (277 by 78) | centre (445, 110), that is (0.586, 0.104) of the card; the banner is visible about x 270 to 635, y 58 to 155 |
| Text, layout A | spy, guard, baron, handmaid, prince, chancellor | x 91 to 668, y 810 to 977 (578 by 168) | centred on x = 380; visible box about x 50 to 712, y 800 to 995 |
| Text, layout B | priest, king, countess, princess | x 91 to 668, y 846 to 976 (578 by 131) | the portrait runs lower; visible box about x 50 to 712, y 835 to 995 |

- Budgets, kept by `content/data/data.test.ts` and not by the Studio: a card text of at most 130 characters (about three lines of 40 at the text size of the publisher's own sheet, and four fit layout A), at most 90 on layout B (the four faces with the shorter plate), and a name of at most 12 letters. The board may fit a text smaller
- Fonts, a **guess**: the owner's English sheet (`visuals/VISUEL_CARDS_SHEET_EN.webp`, a mock-up with the publisher's wording, read for layout only) sets the name centred in the banner in a bold display face and the text centred in a small old-style serif, and the library's `fonts/cabazon-regular.otf` (display) and `fonts/MinionPro-Regular.ttf` (serif) look like that pair: to confirm with the owner. Minion Pro is a commercial typeface (Adobe): its web licence must be checked before step 7 uploads it, and Cabazon's licence is not checked either. The fonts go in the Gamemaster (Visual) and the board reads them as Flip 7's does (`tableFonts`)
- The favor token has three files: its symbol (an SVG) and its mask (a PNG) are images the seed places, its 3D model (`FAVOR_TOKEN.glb`) is a file dropped on its field in the Studio; nothing in the table kit loads a glTF today. Not in this Studio: the box (placed in the catalog entry), the sprites sheet `visuals/VISUEL_SPRITES.webp` (effect icons: a shield, a question bubble, a scales seal, a hooded figure and a crossed-out one, numeral discs; single files are wanted if the board draws any of them), and the reference card and the broken seal (the library has no picture of them)

## Making it playable
Follow `template/CLAUDE.md` ("Adapting to a new game"): write the engine, export it as `GAME` from `src/index.ts`, add the board (`Game` in `src/ui.tsx`, loaded lazily as in the template), then set `live` (and `indexable` once it is ready for search engines) in `packages/games/src/registry.ts`.

## Commits
Gitmoji format: `<emoji>(love-letter): <description>`
