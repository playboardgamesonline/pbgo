# Skyjo · Play Board Games Online

Skyjo (Alexander Bernhardt, Magilano; French edition by Blackrock Games), served by `apps/web` at `/skyjo`. The engine is written from the French booklet (4 pages) and tested, the board is drawn on `@pbgo/table`, and the Sanity content is described and seeded as code (see "Status" for what was and was not done). Listed nowhere until `live` is set in the registry. 2 to 8 players; the web edition is not official.

## Status
- Engine: done (`pnpm check:game skyjo --stage engine`).
- Binding and board: done and playable outside production (`pnpm check:game skyjo --stage board`). Checked in a real browser through a throwaway preview route (removed before the commit), not through `pnpm check:board`, which needs Supabase.
- Content model and seed: written (the Studio's `card` list, the words, the seed with its art manifest); **nothing was written to Sanity**: the seed has never been run against the project `p5sgvh5w`, the Studio was not redeployed, and the owner has not published anything. Until then every word of the board reads `[missing: <key>]` and the cards and their back are stand-ins. When the preview was looked at, the Sanity project answered "Dataset production not found": the `production` dataset has to exist before the seed can run (`pnpm go-live skyjo` makes it).
- Not live and not indexable (`live: false`, `indexable: false` in the registry): that is the `game-go-live` stage.

## Structure
- `package.json` — `@pbgo-game/skyjo`, the binding package that `@pbgo/games` loads on demand
  - `src/lib/site.ts` — `SLUG`, name, keywords, genres, author, contact, `ERROR_CODES` (the game's own refusals: `INVALID_POSITION`, `CARD_FACE_UP`, `MUST_PLACE`; no tagline, no description: a game's texts live in Sanity only)
  - `src/index.ts` — the binding shared by the server and the client: the engine (`GAME`), the site constants, the default colors (`SETTINGS_DEFAULTS`: a warm graphite felt, cream ink, a sky-blue accent), the skin (`DEFAULT_SKIN`: the eight seat colors) and the in-game look (`UI_THEME`: calm motion, round seats)
  - `src/lib/words.ts` — `WORD_FIELDS` (the 37 words of the board, the fields of the Board tab of `texts`) and `fill` · `src/lib/catalog.ts` — `ClientCatalog` (the picture of each card under its engine key, the back, the words) and `MISSING_CATALOG` · `src/lib/cards.ts` — the figure of a card · `src/lib/history.ts` — the sentence of each event of the log (`sentenceOf`, `actorsOf`) · `src/lib/floor-tones.ts` — the colors of the pads · `src/lib/skin.ts`, `src/lib/ui-theme.ts`
  - `src/sanity/` — the query of the board (`queries.ts`), its fetch cached 60 s (`catalog.ts`), the catalog built from it in the language asked (`catalog-client.ts`) and the types that `pnpm --filter skyjo-studio typegen` writes (`types.ts`, generated, offline)
  - `src/ui.tsx` — `Logo` and `Game`, loaded with `dynamic` so the hub carries no three.js · `src/runtime.tsx` · `src/server.ts` — `loadGameData`, which gives the board its catalog
  - `src/components/game/game.tsx` — the screen around the table: announcements (start, new round, your turn, last turn, victory or defeat), the ticker (round and score that ends the game, the history of the table), the game over, the seven intents the table sends (`reveal`, `take`, `draw`, `place`, `discard`, `flip`, `deal`), the Phases / Rig the table / Replay folders of the debug panel
  - `src/components/board/` — the table, the only place that imports `@pbgo/table` and three.js (see The board): `scene.tsx`, `layout.ts` (+ test), `camera.ts` (+ test), `viewport.ts`, `textures.ts`, `pacing.ts` (+ test), `glows.ts`
  - `src/conformance.test.ts` (the contract of an engine, played the way the server plays it) · `src/takeover.test.ts` (absent players and the votes to play for them) · `src/error-codes.test.ts`
- `packages/engine` — `@skyjo/engine`, the whole game: pure TypeScript on the engine-kit helpers, tested with Vitest
- `apps/studio` — `skyjo-studio`, Sanity Studio of the project `p5sgvh5w` (https://skyjo.sanity.studio): the `card` list, the `game` singleton (card back), `texts` (the Board tab holds the words); `studio-forms.test.ts` and `board-words.test.ts` guard the forms and the words (`pnpm --filter skyjo-studio test`)
- `check-board.config.mjs` — the game's part of `pnpm check:board skyjo`: how its seats play, the situations photographed (the viewer's choice, holding a drawn card, the deal), what the viewer presses and where (the Draw, Take, Throw away and Deal pads, a card of the grid), and the cases rigged as frames (a column, a placement, a throw-away, the last turn, the count, the end of the game). **Written but never run** (no Supabase in the sandbox where the board was built)
- `content/` — the Sanity content as versioned code and its seed, run by `@pbgo/content-kit` (see Content)

## Glossary (FR → EN)
manche → `round` · donneur → `dealer` · grille (les 12 cartes d'un joueur) → `grid`, case → `cell` (numérotées `colonne * 3 + ligne`) · colonne → `column` · face cachée / visible → face down / face up (`up`) · pioche → `deck` (draw pile) · défausse → `discard` · prendre la carte de la défausse (choix 1) → `take` · prendre la carte de la pioche (choix 2) → `draw` · échanger → `place` · défausser la carte piochée → `discard` (action) · retourner une carte → `flip` · retourner deux cartes au début → `reveal` (opening) · dernier tour → last turn (`ender`, `last`) · décompte → count · points doublés → `doubled` · 100 points → `TARGET_SCORE`

## Engine (`packages/engine/src`)
- `types.ts` — `State`, `Stage`, `Cell`, `Action` (`CLIENT_ACTIONS`), the views (`PlayerView`, `PublicPhase`, `PublicSeat`, `PublicCell`), the events (`SkyjoEvent`), the error codes (`SKYJO_ERROR_CODES`)
- `catalogue.ts` — `CARDS` (the 15 faces, keys `card-minus-2`, `card-minus-1`, `card-0` … `card-12`), `DECK` (their copies, 150 cards), `CATALOGUE`, `bandOf` (the colour band of a value, the board's look only) · `scoring.ts` — the count (`roundScores`, `isTriple`, `columnCells`) · `options.ts` — `TARGET_SCORE` and no option
- `machine.ts` — `open` / `close` of a step, the cards and the grids, the scores, `waitingFor` · `round.ts` — `startRound` (all 150 cards shuffled, 12 each, one on the discard), `beginTurns` (who starts), `dropColumn`, `endTurn`, `endRound` (the count) · `actions.ts` — `reveal`, `take`, `draw`, `place`, `discard`, `flip`, `dealRound` and `step(state, action)` · `setup.ts` · `autoplay.ts` · `results.ts` · `view.ts` · `debug.ts` · `game.ts` (`GAME`) · `index.ts`
- `test-utils.ts` — `layout` builds a rigged table from values (a number is a card face down, `up(n)` one face up, `null` a hole); not exported

### How a game goes
- `step(state, action)` gives `{ state, events }` (`SkyjoLogEntry`). The state is lean: ids and numbers. `grids[seat]` is 12 cells, `column * 3 + row`, each `{ card, up }` or `null` once its column was thrown away; `stage` is the one thing the round waits on
- Stages: `reveal` (everybody turns two cards over, simultaneous: `waitingFor` lists every player who still has to) → `choose` (take the discard or draw) → `place` (a card in hand: from the discard it must be placed, from the pile it may be placed or thrown away) → `flip` (after a throw-away, one face-down card turns over) → next player … → `between` (the round is counted, the dealer deals) → `reveal` …
- Hidden: the cards face down (to everybody, their owner too, so a face-down cell is `{ up: false }` and carries no id), the order of the draw pile (the view gives its size) and the card just drawn from it (seen by the holder only; the log entry of the draw has `to` and a `masked` version). The card taken from the discard was seen by all
- The draw pile runs out: the discard, but its top card, is shuffled into a new pile (`reshuffleDiscard` with `keep: 1`)

### Rules as coded (booklet pages as printed)
- 150 cards: five -2, ten -1, fifteen 0, ten of each from 1 to 12 (p.1). 2 to 8 players
- A round: each player gets 12 cards face down in 4 columns of 3, one card from the pile starts the discard; each player turns two of their own cards over (p.1). The player whose two cards add up highest starts (p.2); the turn goes clockwise
- A turn: take the top of the discard and swap it with one of your 12 cards, face up or down (the replaced card goes face up on the discard); or draw the top of the pile and either swap it likewise or throw it on the discard and turn one face-down card over (p.2)
- Three equal cards face up in a column go to the discard, after the replaced card, so that they end on top (p.2); also when a card is turned over, and at the count when the last cards are turned
- The round ends when a player has all their cards face up (columns thrown away leave no card to count): every other player plays one last turn (p.3). Then all cards are turned, columns of three equal cards go, each player scores the sum of their cards (negatives subtracted), and the ender's points are doubled if they are not strictly the lowest of the round, but only when positive (p.3)
- The game ends when a player's total reaches 100 or more at the end of a round; the lowest total wins (p.1, p.4)
- **Where the booklet is silent, the engine decides as follows (the official Skyjo rule where I know it; all to be validated by the owner):**
  1. The number of players: 2 to 8 (the box says so; the booklet gives no range)
  2. The tie for who starts (two players with the highest sum): the first of them clockwise from the dealer's left. Every round is opened that way (the booklet says it of "a round", and only that)
  3. The first dealer is drawn from the seed; after each round the deal passes one seat clockwise, and the dealer's only duty is to press Deal between two rounds
  4. The two opening cards are turned in any order by all the players at once, final, and everybody sees them as they are turned
  5. A tie for the lowest total at the end: all the tied players win (the booklet says "the player with the lowest score", `roundsOutcome` with `tie: "shared"`)
  6. The ender who is in a tie for the lowest round score is doubled (the booklet's own example: 10, 24 and 10 gives 20). A tie of the ender at zero or below is not doubled
  7. All 150 cards are shuffled again for every round (the cards of the last round included)
  8. The three equal cards thrown away are put on the discard with the replaced card under them, the last of the three on top; a placement can only make one column, the count can make several
  9. A player who ends the round by throwing away their last column (no card left) is the ender, with a count of 0
  10. When the draw pile is empty the discard, but its top card, is shuffled into a new pile (the booklet does not say: it is the official rule); it cannot happen with 8 players (97 cards are in play at most) and is there so that the game never gets stuck. If even that finds no card, drawing is refused (`INVALID_PHASE`) and the discard can still be taken
  11. A player cannot undo a take: a card taken from the discard must be placed (`MUST_PLACE`)
  12. No option: the target is the booklet's 100 (`TARGET_SCORE`). A shorter game is a later option, not coded

### Absent player
`autoPlayFor` plays a whole turn (not one click): it turns the first cards of the grid (positions 0, 3 then the other column tops), takes the top of the discard when it is 4 or less and it helps (or completes a column), else draws; a card goes where it completes a column, else over a face-up card at least two points higher, else over a face-down card when it is 4 or less, else it is thrown away and the first face-down card is turned over; between two rounds it deals. Deterministic, no random number; every turn turns a card over or lowers a card, so a round always ends. `NOT_WAITING` when the game is not waiting for them.

### Errors
`SKYJO_ERROR_CODES` in `types.ts`. The shared ones are worded by the platform; `INVALID_POSITION`, `CARD_FACE_UP` and `MUST_PLACE` are the game's own.

### Tests
`pnpm --filter @skyjo/engine test` and `typecheck`. A file per part (catalogue, scoring, setup, turns, rounds, view, autoplay, debug, game), each rule with the page of the booklet, `simulation.test.ts` (2 to 8 players, every size twice, one with a third of the moves played for absent players, the count of every round written again from the names of the faces, invariants after every move, junk actions) and `conformance.test.ts` (the contract of the kit).

## The board
One scene on `@pbgo/table` (`scene.tsx`), a function of the view. The screen around it (HUD, players, chat, menu) is core's.

| Zone | Block | A player can press there |
| --- | --- | --- |
| The seat of each player, the viewer in front and the others all round the table in turn order, each turned toward the middle, with the total under the name and a word (last turn, ended the round, the points of the round) | `PlayerSeat` | nothing |
| The grid of each player: 4 columns of 3 cards, face down until turned, a hole where a column was thrown away; the viewer's is the biggest, the others' are smaller, rows overlap so that the figure at the top of each card stays readable | `Zone` | the viewer's cards, each its own floor zone (`cellZone`: the card and the room round it, the twelve zones tile the grid), while there is a card to choose: two to open the round, any card while holding one, a face-down one after a throw-away |
| The draw pile (count written on its top card), left of the middle | `Pile` | its top card, on the viewer's choice: draw |
| The card in hand, between the piles: face up for who drew it (and for everybody when it came from the discard), a back for the others | `Zone` | nothing |
| The discard, right of the middle: the card that was on top stays under the new one; the cards of a thrown column fly there | `Zone` | its top card, on the viewer's choice: take |
| Draw (under the pile) and Take the discard (under the discard) on the viewer's choice; Discard and flip (under the discard) while holding a drawn card; Deal across both for the dealer between two rounds | `FloorButton` | the pads; Tab, Enter and Space too |
| The instruction of the moment, flat on the table above the piles | `TableText` | nothing |

- **Look.** A calm warm-graphite felt with the kit's grain (`grainTexture`, as Flip 7), a cream ink and a sky-blue accent for the instruction: the cards bring the colour (green, yellow, red, blue, the rainbow back), so the table stays neutral and the pads keep to a few quiet tones that none of the card colours is (a blue to draw, an amber to take, a grey to throw away, a pale blue for the cells: `lib/floor-tones.ts`, outside the settings' theme, which has no slot for them)
- **Layout.** The ring is Flip 7's (`seatAngle`, `seatAt`, `seatSpots`, `plateAt`, mirrored in `layout.ts` with its tests: Flip 7 keeps them with its own knobs, so nothing was lifted into the kit) for 2 to 8 seats; the knobs come in pairs for the fewest and the most seats (`tableOf`). The numbers were searched, not guessed: every plate, grid, pile and strip of every table of 2 to 8 keeps apart from the others (`layout.test.ts`, separating-axis tests) and the camera fits all of them in 1280x720, 1024x768 and the other windows of `camera.test.ts`
- **Camera.** `fitCamera` as Flip 7, with the platform's boxes it keeps the table clear of (the log, the list of the players, and here the message box at the bottom right) and a lower `LEAST_UNIT` (30, Flip 7's is 38): eight seats of twelve cards must fit a tablet held across, so the cards of the seats at the far side are small there (about 20 px wide). A spectator of eight seats on 1024x768 is the one corner that does not fit (there is no spectator on the platform)
- **Words.** Everything the board writes is `words.<key>` of the catalog (`WORD_FIELDS`); `content/data/board-words.test.ts` fails on a word used and not seeded, and on a word seeded and not used. The figure on a card is the engine's value, no word
- **Pace.** A move is paced from its lines in the log (`pacing.ts`, `timelineOf`): a deal goes round the table card by card, the card in hand arrives before it is placed, the replaced card and the placed one fly together, a thrown column flies card by card from its cells to the discard and lies there until the move has played out. The words that say how a move ended (the totals, the last-turn word) wait for it; a table that is opened or reloaded plays nothing
- **Friction.** No block for the number of cards of a pile: it is written on the top card (`children` of `PileTop`), since a count written on the table next to a stack is hidden from the camera by the stack. The cells' floor zones lie under the cards, so at rest only their rims between the cards show; they lift under the pointer or the focus

## Content (Sanity), seed not run
- 18 documents: the 15 faces of the deck in one `card` list (`card-minus-2` … `card-12`, the engine's keys), each with its game key (a dropdown), its colour band (dark blue, light blue, green, yellow, red: a dropdown, what groups the faces), its place in the list (`order`, read only), its quantity (5, 10, 15, then 10 each) and last its visual; `game` (the card back, one tab) and `settings` (credits: Alexander Bernhardt, Magilano) and `texts`. A card is named by the figure printed on it, so it has no name to translate; there is no `rules` document (the rules are the publisher's PDF, linked in `settings`)
- `texts` carries three things: the five lines of the score (`engineTexts`: `score.rounds`, `score.bestRound`, `score.columns`, `score.ended`, `score.doubled`; Skyjo has no option), the messages of the three own error codes (`errorMessages`) and the 37 words of the board (`BOARD_WORDS`). English is the base, French follows the booklet, **Spanish and German were written by an agent: the owner reads them**
- `content/data/art-manifest.ts`: 17 slots: the 15 faces (`card-minus-2.svg` … `card-12.svg`, which `skyjo-minus-2`, `skyjo-7`… also fill), the back (`card-back`, also `skyjo-back`) and the logo. The art folder is outside the repo and goes in with an absolute `--art-dir`; the 16 SVGs the owner handed over (raster inside, 296 by 476) are not committed
- `pnpm --filter @pbgo-game/skyjo content:seed --dry-run` (needs the token `SANITY_API_WRITE_TOKEN_SKYJO`) then `--apply`: drafts only, the owner publishes. `pnpm --filter @pbgo-game/skyjo test` covers `content/` and `src/` (no network, nothing written); `content/parity/engine.test.ts` keeps the seed equal to the engine (the faces, their quantities and bands, the words of the engine, the codes)
- After a change of the Studio's schema: `pnpm --filter skyjo-studio typegen` (its types are committed) and the owner's deploy of the hosted Studio

## Commits
Gitmoji format: `<emoji>(skyjo): <description>`
