# Skyjo · Play Board Games Online

Skyjo (Alexander Bernhardt, Magilano; French edition by Blackrock Games), served by `apps/web` at `/skyjo`. The engine is written from the French booklet (4 pages) and tested. The binding, the board and the Sanity content are the next stages (see "Status"). Listed nowhere until `live` is set in the registry. 2 to 8 players; the web edition is not official.

## Status
- Engine: done (`pnpm check:game skyjo --stage engine`).
- Binding and board: not started when this was written (updated below as the stages land).
- Content model: not started.

## Structure
- `package.json` — `@pbgo-game/skyjo`, the binding package that `@pbgo/games` loads on demand
  - `src/lib/site.ts` — `SLUG`, name, keywords, genres, author, contact (no tagline, no description: a game's texts live in Sanity only)
  - `src/index.ts`, `src/ui.tsx`, `src/runtime.tsx`, `src/server.ts` — the binding
- `packages/engine` — `@skyjo/engine`, the whole game: pure TypeScript on the engine-kit helpers, tested with Vitest
- `apps/studio` — `skyjo-studio`, Sanity Studio of the project `p5sgvh5w` (https://skyjo.sanity.studio)

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
  10. When the draw pile is empty the discard is shuffled under nothing (it becomes the pile), keeping its top card; it cannot happen with 8 players (97 cards are in play at most) and is there so that the game never gets stuck. If even that finds no card, drawing is refused (`INVALID_PHASE`) and the discard can still be taken
  11. A player cannot undo a take: a card taken from the discard must be placed (`MUST_PLACE`)
  12. No option: the target is the booklet's 100 (`TARGET_SCORE`). A shorter game is a later option, not coded

### Absent player
`autoPlayFor` plays a whole turn (not one click): it turns the first cards of the grid (positions 0, 3 then the other column tops), takes the top of the discard when it is 4 or less and it helps (or completes a column), else draws; a card goes where it completes a column, else over a face-up card at least two points higher, else over a face-down card when it is 4 or less, else it is thrown away and the first face-down card is turned over; between two rounds it deals. Deterministic, no random number; every turn turns a card over or lowers a card, so a round always ends. `NOT_WAITING` when the game is not waiting for them.

### Errors
`SKYJO_ERROR_CODES` in `types.ts`. The shared ones are worded by the platform; `INVALID_POSITION`, `CARD_FACE_UP` and `MUST_PLACE` are the game's own.

### Tests
`pnpm --filter @skyjo/engine test` and `typecheck`. A file per part (catalogue, scoring, setup, turns, rounds, view, autoplay, debug, game), each rule with the page of the booklet, `simulation.test.ts` (2 to 8 players, every size twice, one with a third of the moves played for absent players, the count of every round written again from the names of the faces, invariants after every move, junk actions) and `conformance.test.ts` (the contract of the kit).

## Commits
Gitmoji format: `<emoji>(skyjo): <description>`
