# @pbgo/engine-kit

What a game's engine and the web app agree on (the `GameDefinition` contract, turns, options), and the building blocks the card games share (seeded random numbers, opaque ids, decks, a per-viewer log, scores over rounds, simultaneous steps). Pure TypeScript: no UI, no dependency, nothing random that is not seeded. The package is consumed as source (`main` is `src/index.ts`).

```ts
import { createSaveableRng, drawWithReshuffle, issueIds, restoreRng } from "@pbgo/engine-kit"
```

The template's engine re-exports the whole kit (`export * from "@pbgo/engine-kit"`), so a name the kit exports cannot also be declared by that engine.

- [The rule: lean state](#the-rule-lean-state)
- [Conventions](#conventions)
- [Reference](#reference): [contract](#contract) · [turns](#turns) · [options](#options) · [rng](#random-numbers-rngts) · [ids](#opaque-ids-idsts) · [deck](#decks-deckts) · [log](#log-logts) · [rounds](#rounds-roundsts) · [simultaneous](#simultaneous-steps-simultaneousts)
- [Putting it together](#putting-it-together)

## The rule: lean state

**A game's state holds ids and numbers only: no display data, no derived values, no log.** Decided on Oct 11 (PLT-45), and it applies to every game.

- **Ids and numbers only.** Names, texts, labels, colours and image paths are display data. They live in the game's catalogue (code) and in Sanity, and the client draws them from the view. A card in the state is an id, an amount is a number.
- **No derived values.** What can be computed from the rest of the state is computed, never stored: the totals from the scores of the rounds (`sumRounds`), who leads (`leaders`), how many cards a pile holds, whose turn it is when it follows from a counter, who the game waits for (`waitingFor`).
- **No log in the state.** What happened is not something the next move needs. A game keeps no history in its `State`. It says what each move did with `step` (the new state and the entries of the move), and the platform keeps them in the log of the table (`game_log`) and sends each player the lines they may read; the kit gives the shape of an entry, the per-viewer filter and the helpers that play through `step` ([`log`](#log-logts)).

The helpers follow from the rule: cards are numbers ([`ids`](#opaque-ids-idsts), [`deck`](#decks-deckts)), piles are arrays of ids, totals are arrays of numbers in seat order, and the position of a random stream is one number. A state in that style (an illustration, not a template):

```ts
type State = {
  seats: string[] // player ids in seat order: the only source of any order
  ids: number[] // the id each card of the catalogue holds, by catalogue index
  idsRng: number // saved position of the stream that issues ids
  rng: number // saved position of the shuffle stream
  deck: number[] // card ids, top first
  discard: number[]
  hands: number[][] // hands[seat]
  rounds: number[][] // score of each finished round, rounds[round][seat]
  bids: Submissions<number> // a simultaneous step in progress
}
```

## Conventions

- **Determinism.** Everything random comes from a stream seeded with the game seed: the same seed and the same actions replay the same game. This is what replays, the takeover of an absent player and the tests rely on. Never `Math.random` or `Date.now` in an engine. The one exception is `randomSeed()`, called from `setup` when no seed was given.
- **Carry a stream from one action to the next.** `createSaveableRng(seed).save()` is one number to keep in the state. `restoreRng` picks the stream up where it stopped, so a game keeps drawing deterministically long after its setup:

  ```ts
  const rng = restoreRng(state.rng)
  // …shuffle, draw…
  return { ...state, rng: rng.save() }
  ```

- **Side streams.** Numbers that reach the clients (opaque ids above all) must not come from the stream that shuffles, or anyone who rebuilt it would know the deck. `sideSeed(seed, ...parts)` derives an independent stream from the high bits of the seed (the shuffle only uses the low 32 bits). Each game numbers its own streams: `sideSeed(seed, IDS_STREAM)`, `sideSeed(seed, AUTO_MOVE_STREAM)`. The kit reserves none.
- **`jsonb` forgets the order of keys.** The state is stored as `jsonb`, which returns the keys of an object in its own order. An order (seats, turns, who is pending) always comes from an array of the state, never from `Object.keys`. That is why every helper that works per player takes the list of seats, or returns arrays aligned with it.
- **Nothing is modified.** Every helper reads its arguments as `readonly` and returns new arrays and objects, so `{ ...state, ...result }` is the next state.
- **Two kinds of errors.** `EngineError(code)` is for what a player can get wrong (an illegal move, not their turn): its code is shown to them through the error messages, the platform's for the shared codes (`SHARED_ERROR_CODES`) and the game's, written in Sanity, for the codes of its own. The helpers of the kit throw a plain `RangeError` for what only a bug of the game can cause (an id that does not exist, a pile too short, a position out of range). The game validates the player's input first, so a `RangeError` never reaches a player.

## Reference

### Contract

`contract.ts`, `errors.ts`, `outcomes.ts`. `GameDefinition<State, Action, View, SetupData, Event>` with `setup`, `apply`, `view`, `isOver`, `options`, `presets`, `clientActions`, `waitingFor`, `autoPlayFor`, `debug` (and `activePlayer` / `autoPlay`, `@deprecated`), for a game that says what its moves did, `step`, `autoPlayStep` and `setupStep`, and for a game with a clock, `begin` and `nextDeadline` ([Timers and deadlines](#timers-and-deadlines-timerts-deadlinets)). Also `PlayerInfo`, `PlayerAction`, `PlayerResult`, `Results` (`coop` says that a table that plays on one side won or lost together), `AnyGameDefinition`, `DebugCommand`, `EngineError` and `isEngineError`, and the vocabulary of the refusals every game shares: `SHARED_ERROR_CODES`, `SharedErrorCode` and `isSharedErrorCode`. `outcomesOf(results)` reads the results as the outcome of each player for the history (`win`, `loss`, `draw`, `coop_win`, `coop_loss`: `PLAYER_OUTCOMES`; `abandoned` is the platform's). For the tests of a game, `@pbgo/engine-kit/testing` has `errorVocabularyProblems`, which reads the sources of an engine and says what is wrong with its codes. The principles and the demo game are explained in `template/docs/GAME_GUIDE.md`.

### Turns

`turns.ts`. Everything that needs to know whose turn it is goes through these, never through the hooks of the definition, so a game written for the previous contract keeps working.

| | |
| --- | --- |
| `waitingPlayers(game, state)` | The players the game waits for, in seat order, no duplicates; nobody once the game is over. |
| `currentPlayer(game, state)` | The player whose turn it is, or `null`. |
| `canPlayFor(game)` | Whether the server can play for an absent player of this game. |
| `playFor(game, state, playerId, at?)` | Plays the current step of one waiting player (`autoPlayFor`); `at` is the time the server plays it at, for a game with a clock. `EngineError("NOT_WAITING")` if they are not waiting, `"AUTOPLAY_UNSUPPORTED"` if the game cannot. |
| `playOn(game, state, maxSteps = 1000)` | Plays for the first waiting player until the game is over. For tests and simulations. |

### Options

`options.ts`. Declarative game options (`number` / `choice` / `boolean`, optional `group`, `requires`, `conflictsWith`, `players`): `defaultOptions`, `normalizeOptions`, `optionStatus`, `optionGroup`, `applyPreset`, `presetMatches`. An option names no text: its words, and those of a preset and of a line of score, are written in the game's Sanity under the keys of `texts.ts` (`optionLabelKey`, `choiceLabelKey`, `scoreLabelKey`…), and `engineTextKeys(definition)` lists the ones a definition needs.

### Random numbers (`rng.ts`)

| | |
| --- | --- |
| `createSaveableRng(seed)` | A seeded stream of numbers in [0, 1) (mulberry32) with `save()`, which returns its position. Only the low 32 bits of the seed count. |
| `createRng(seed)` | The same numbers, for a caller that never saves the position. |
| `restoreRng(saved)` | Carries on from a `save()`. `RangeError` unless `saved` is an unsigned 32-bit integer: a missing or damaged position would silently restart the stream, and every game would then draw the same cards. |
| `shuffle(items, rng)` | A shuffled copy (Fisher–Yates). |
| `sideSeed(seed, ...parts)` | A 32-bit seed for an independent stream, from the high bits of the game seed and a few integers of your choice. |
| `randomSeed()` | A fresh game seed (an integer below 2^52, like the server's). The only function of the kit that is not deterministic. |

### Dice (`dice.ts`)

A roll is a draw from the game's seeded stream, made inside `apply` with a stream restored from the state; the board throws a `Die` onto the number the engine gave (`docs/engine/02-components/10-dice.md`).

| | |
| --- | --- |
| `rollDie(rng, sides = 6)` | One roll: a whole number from 1 to `sides`. One draw of the stream. `RangeError` for a die with fewer than two sides, or not a whole number of them. |
| `rollDice(rng, count, sides = 6)` | `count` dice, one after the other, in order. Nothing is drawn for an empty pool. |
| `rerollDice(rng, dice, reroll, sides = 6)` | A pool with the dice at the indexes of `reroll` rolled again, in the order of their index whatever the order they were listed in. A new array. `RangeError` for an index that is not a die of the pool or is listed twice. |

### Answers (`answers.ts`)

What a player answers in a window other than text: a number (a bet, a quantity, a bid) or a choice among options. Checked in one place, in `apply`, on the field of the action (`docs/engine/02-components/12-bets-and-choices.md`).

| | |
| --- | --- |
| `cleanNumber(input, rules)` | The number chosen, checked against `min`, `max`, `step` (counted from `min`) and `integer` (whole by default). `EngineError("INVALID_NUMBER")` for anything that is not a finite number, one outside the range or off the steps; `RangeError` for rules no number could meet. A string is not a number. |
| `cleanChoice(input, options)` | The option chosen, one of `options` (strings or numbers, compared strictly). `EngineError("INVALID_CHOICE")` for anything else. |
| `cleanChoices(input, options, rules)` | Several options: a list with none twice, between `min` and `max`, returned in the order of `options`. `EngineError("INVALID_CHOICE")`. |

### Counters (`counters.ts`)

A number of the state held between two ends: life, coins, clue tokens, points. The helper says what really changed, so that the log can say it (`docs/engine/02-components/14-counters.md`).

| | |
| --- | --- |
| `changeCounter(rules, value, delta)` | `value` changed by `delta` and held between `rules.min` and `rules.max` (both optional). A `Change`: `from`, `to`, `applied` (what really changed, with its sign) and `stopped` (`"min"` or `"max"` when that end cut the change short, `null` otherwise, and `null` for an end reached exactly). Never a `-0`. `RangeError` for a `min` above the `max`, a value or a change that is not a finite number, and a value outside the ends. |

### Tracks (`track.ts`)

A marker on a row of spaces, kept in the state as the number of its space; the board walks it along the spaces (`docs/engine/02-components/15-tracks.md`).

| | |
| --- | --- |
| `moveAlong(track, from, steps)` | A marker on space `from` of `track` (`{ min = 0, max, loop }`) moved `steps` spaces, forward above zero and back below. A `Walk`: `from`, `to`, `moved` (the spaces really gone), `passed` (the spaces it went through in order, the last being `to`), `laps` (+1 for each crossing from `max` to `min` on a loop, -1 for each crossing back, always 0 without a loop) and `stopped` (the end that cut a move short on a track that does not loop). Never a `-0`. `RangeError` for a track with no space or whose ends are not whole numbers, a marker that is not on a space of it, steps that are not a whole number or are more than `MAX_WALK` (100,000). |

### Bags (`bag.ts`)

Tokens of several kinds drawn at random from counts kept in the state: an array of whole numbers indexed by kind (`docs/engine/02-components/18-bags.md`).

| | |
| --- | --- |
| `bagSize(counts)` | How many tokens are in the bag, all kinds together. `RangeError` for counts that are not whole numbers. |
| `drawFromBag(rng, counts, count = 1)` | `{ drawn, bag }`: `count` tokens drawn one after the other, each as likely as any other in the bag, without putting them back; `drawn` lists their kinds in order and `bag` is the counts left. A bag with fewer tokens gives all it has. One draw of `rng` for each token drawn, none for an empty bag. New arrays. `RangeError` for counts that are not whole numbers and for a number of tokens that is not. |

### Boards (`board.ts`)

A grid of cells that touch one another, whose cells the state names by a number from 0, row by row from the top (`docs/engine/02-components/16-boards.md`). A board has no state: build it once and ask it.

| | |
| --- | --- |
| `squareBoard({ columns, rows, diagonals })` | Squares numbered `row * columns + col`. With `diagonals` the corners touch too: eight directions (the even ones are the sides) and the king's distance; without, four directions and the sides' distance. |
| `hexBoard({ radius })`, `hexBoard({ columns, rows })` | Hexagons with a point up, six directions, axial coordinates `[q, r]`: a hexagon of hexagons round a middle cell, or a rectangle whose odd rows are shifted half a cell to the right (numbered like a square board). |
| `board.size`, `coords`, `directions`, `at(a, b)`, `step(cell, direction)`, `neighbours(cell)`, `distance(from, to)` | The number of cells, the two numbers that place each (`[col, row]` or `[q, r]`), the number of directions, the cell at two numbers or -1, the cell one step away or -1, the cells next to a cell in the order of the directions, and the number of steps between two cells. `RangeError` for a cell or a direction the board does not have. |
| `reachable(board, from, range, { blocked })` | The cells reachable in `range` steps at the most without entering a blocked cell, `{ cell, distance }`, nearest first then by number, the start included. |
| `shortestPath(board, from, to, { blocked })` | The cells to go through from `from` to `to`, the last being `to`: `[]` for the same cell, `null` when there is no way. Directions tried in order, so the same board gives the same way. |
| `regionOf(board, start, same)` | The cells linked to `start` through cells for which `same` is true, in the order of their number; empty when `start` is not one. |
| `lineBetween(board, from, to)` | The cells a straight line goes through after `from`, the last being `to` (Bresenham on squares, the nearest cells on hexagons). |
| `rayFrom(board, from, direction, { blocked })` | `{ open, stoppedBy }`: the cells a sliding piece goes through in one direction, and the blocked cell that stopped it, or `null` at the edge. |

### Writing (`writing.ts`)

The text a player writes is cleaned and bounded in one place, in `apply`, before it reaches a state, a log or another player's screen (`docs/engine/02-components/11-text-field.md`).

| | |
| --- | --- |
| `cleanText(input, rules)` | The text ready for the state: composed accents, one space between words, no control, invisible or lone-surrogate character, no stack of combining marks, one line (or the `lines` the rules allow). `EngineError("INVALID_TEXT")` for anything that is not a string, is empty, or is longer or has more lines or words than the rules allow: it never cuts. |
| `TextRules`, `DEFAULT_TEXT_MAX` | `max` (characters as a reader counts them), `min`, `lines`, `words`. |
| `textKey(text)`, `sameText(a, b)` | What two texts are compared by: without accents, case or anything but letters and digits. |

A text written in secret by every player is a `Submissions<string>`: the view says who wrote, never what, until the step is resolved.

### Drawing (`drawing.ts`)

What a player draws is cleaned and bounded in one place, in `apply`, as a text is (`docs/engine/02-components/21-drawing.md`). A drawing is a list of strokes, each `{ color, width, points }`: the colour and the width are indexes of the game's palette and brushes, and the points are a flat list of whole numbers on a grid of `DRAWING_GRID` (1000) on each side.

| | |
| --- | --- |
| `cleanStroke(input, rules)` | One stroke checked and given back as a new object: the numbers rounded, a point that comes twice in a row kept once. `EngineError("INVALID_DRAWING")` for anything that is not a stroke, a colour or a width outside the palette, points off the grid, or more points than a stroke may have (counted as sent). |
| `addStrokes(drawing, input, rules)` | The drawing with the strokes of `input` added, as a new list. `INVALID_DRAWING` for what is not a list of strokes, `EngineError("DRAWING_FULL")` when the strokes or the points would pass the limits. |
| `cleanDrawing(input, rules)` | A whole drawing handed in at once, checked as strokes added to an empty sheet. |
| `undoStroke(drawing)`, `drawingPoints(drawing)`, `emptyDrawing()` | The drawing without its last stroke, how many points it holds in all, and a sheet with nothing on it. |
| `DrawingRules`, `DRAWING_LIMITS`, `DRAWING_GRID` | `colors` and `widths` (how many there are), the limits `strokes`, `points` and `strokePoints` (60, 2,500 and 400 unless a game says less), and the grid. |

A drawing that every player makes in secret is a `Submissions<Drawing>`: the view says who has drawn, never what, until the step is resolved.

### Opaque ids (`ids.ts`)

A card that clients can see (face down on the table, in a hand, in a pile) is shown under an id, never under what it is. An id is a number that says nothing about the card or its place. The kit keeps the link in one table, `ids`, aligned with the game's catalogue: `ids[card]` is the id held, now, by the card at index `card` of the catalogue. Piles, hands and tables hold ids only.

A card that goes back into hiding after it was seen gets a **new id**, so nobody can follow it from what they saw: a Defuse slid back into the deck (Exploding Kittens), the three cards of a failed Trio turned face down, a Love Letter card put back. Issue ids from a side stream with its own saved position.

| | |
| --- | --- |
| `issueIds(count, rng, space = ID_SPACE)` | The ids of `count` cards, all different, in catalogue order: the first `ids` table of a game. `ID_SPACE` is 2^32; a game that prints its ids in a fixed format may ask for a smaller `space`. |
| `reissueId(ids, id, rng, space?)` | Gives the card that holds `id` a new id that no card holds. Returns `{ ids, fresh }`: the new table and the new id, which the caller puts where the card is now. The old id must not stay anywhere in the state. A retired id is not remembered: it could come back, by chance, one time in `space`. |
| `reissueIds(ids, held, rng, space?)` | The same for several cards: `fresh[i]` replaces `held[i]`. |
| `cardOf(ids, id)` | The index in the catalogue of the card that holds `id`, or `-1`. |

### Decks (`deck.ts`)

A pile is an array of ids with the **top first**: `pile[0]` is drawn next and the last element is the bottom. The discard follows the same convention, so its top is the card discarded last and a card is discarded with `[card, ...discard]` (or `insertAt(discard, card, 0)`). Everything is seeded: the functions that need a random number take a `Rng`.

| | |
| --- | --- |
| `draw(pile, count = 1)` | `{ drawn, pile }`: `count` cards from the top, or all of them if the pile holds fewer (look at `drawn.length`). |
| `peek(pile, count = 1)` | The `count` cards on top, left where they are (See the Future). |
| `insertAt(pile, card, position)` | The pile with `card` slid in so that `position` cards stay above it: `0` is the top, `pile.length` the bottom. `RangeError` outside that range. |
| `reshuffleDiscard(piles, rng, { keep? })` | Shuffles the discard and puts it under what is left of the deck. The `keep` cards on top of the discard stay where they are (Skyjo keeps its visible card: `keep: 1`). |
| `drawWithReshuffle(piles, count, rng, { keep? })` | Draws `count` cards; when the deck runs out in the middle of the draw, the discard is reshuffled once and the draw goes on. Never before: a deck that holds exactly `count` cards is not reshuffled. Fewer cards come back only when both piles are exhausted; the game decides what that means. Returns `{ drawn, piles }`. |
| `deal(pile, seats, size)` | `{ hands, pile }`: `size` cards to each seat, block after block from the top (`hands[seat]`). `RangeError` when the pile is too short, rather than uneven hands. |

`Piles<T>` is `{ deck: T[]; discard: T[] }`. Every function is generic and defaults to numeric ids.

### Log (`log.ts`)

Some things that happen are private: the card a Priest shows, the three cards a player looks at with See the Future. The others know *that* it happened, not what it was. An entry holds the event in full for the players it concerns, and a masked version for everybody else:

```ts
const entries: LogEntry<Event>[] = [
  { event: { kind: "draw", seat: 0 } }, // public
  { event: { kind: "peek", seat: 0, cards: [4, 9, 12] }, to: ["ana"], masked: { kind: "peek", seat: 0 } },
]
viewLog(entries, "ana") // both events in full
viewLog(entries, "bob") // the draw, then the masked peek
viewLog(entries, null) // a spectator: the same as bob
```

`viewLog(entries, viewerId)` returns the log as that viewer reads it, oldest first: the full event when the entry is public (`to` absent) or addressed to them, else its `masked` version, else nothing. `null` is a spectator. `event` and `masked` are plain data (ids and numbers, never display text): the client turns them into sentences in the viewer's language. The log is never part of the state, see [the rule](#the-rule-lean-state): `viewLog` only filters, wherever the entries are kept, and the platform keeps them in `game_log`.

A game gives its entries with `step`, the `apply` that also says what happened, and `autoPlayStep` and `setupStep` for the player it plays for and the moves of its setup. `Step<State, E>` is `{ state, events }`; `step(state, action).state` is what `apply` gives. The platform never calls the members of the definition for this, it plays through the helpers, which work for a game that has no log:

| Export | What it does |
| --- | --- |
| `stepOf(game, state, action)` | The game's `step`, else `apply` with no events |
| `playStepFor(game, state, playerId, at?)` | The game's `autoPlayStep`, else `playFor` with no events; the same refusals as `playFor` |
| `setupOf(game, args)` | The game's `setupStep`, else `setup` with no events |

`docs/engine/01-the-game/12-events-and-the-log.md` tells the whole way, from the engine to the board.

### Timers and deadlines (`timer.ts`, `deadline.ts`)

An engine has no clock: it never reads `Date.now()`. The server tells it the time, as the `at` of every action (`PlayerAction.at`, which a client cannot set), and a game with a clock says in `nextDeadline` when it needs the clock next and which system action to play then. The state keeps the clock of a step as a `Timer`, two numbers, so it stays plain data; the view says how long a step lasts and the platform says how much is left.

| Export | What it does |
| --- | --- |
| `Timer` | `{ endsAt, seconds }`: when the step ends, in milliseconds on the server's clock, and how long it was set for |
| `startTimer(at, seconds)` | A timer set for `seconds` that starts at `at`. A time that is not finite or a length that is not above zero throws a `RangeError`: they are bugs of the game |
| `restartTimer(timer, at)`, `extendTimer(timer, seconds)` | The same timer set again from `at`, and the timer with `seconds` more (the whole grows with the end) |
| `timeLeft(timer, now)`, `timerDone(timer, now)`, `timerFraction(timer, now)` | The milliseconds left (never below 0), whether the time is out, and the share that is left, from 1 to 0 |
| `begin(state, at)` | A hook of the definition: the game goes live at `at`, the server calls it once, when every player is ready. A game starts the clock of its first step here and not in `setup` |
| `nextDeadline(state)` | A hook of the definition: the `Deadline`, `{ at, action }`, or null for no clock, between two steps with none and once the game is over |
| `SYSTEM_PLAYER`, `systemAction(type, at)`, `isSystemAction(action)` | The clock's action: its `playerId` is `"system"`, its type is no entry of `clientActions`, and `apply` checks `isSystemAction` before it plays it |
| `beginOf(game, state, at)`, `deadlineOf(game, state)`, `deadlineIn(game, state, now)` | What the server reads through, never the hooks: the state once the game is live, the deadline of a game that has a valid one, and how long until it in whole milliseconds, never below 0 |
| `settleDeadlines(game, state, now, maxSteps?, before?)` | Plays the deadlines that are due at `now`, each with the time it was due at as its `at`, so the steps that follow start their clocks from the time they would have started at: the same table settled at two moments gives the same game. Up to `MAX_DEADLINES` at once; `before` is asked, with the state, ahead of each one, to learn whom the game was waiting for |

`docs/engine/02-components/20-timers.md` tells the whole way, from the engine to the hourglass on the table.

### Rounds (`rounds.ts`)

Scores accumulated over rounds until somebody reaches a target, then the highest total wins (Flip 7: 200, Love Letter's tokens) or the lowest (Skyjo: 100, 6 nimmt: 66, where the points are penalties). Totals are arrays in seat order: `totals[seat]`.

```ts
const rule: RoundsRule = { target: 100, wins: "low", tie: "shared" }
roundsOutcome(sumRounds(state.rounds, state.seats.length), rule) // { over: false } | { over: true, winners: [seat, …] }
```

| | |
| --- | --- |
| `RoundsRule` | `{ target, wins: "high" \| "low", tie: "shared" \| "playOn" }`. When several players share the best total, `shared` makes all of them win and `playOn` plays one more round. |
| `addScores(totals, scores)` | The totals after a round. `RangeError` if the scores do not match the seats. |
| `sumRounds(rounds, seats)` | The totals of `seats` players from the scores of each round (`rounds[round][seat]`). A game that stores the round-by-round scores derives its totals with this instead of storing them as well. |
| `leaders(totals, wins)` | The seats with the best total, in seat order (all of them when tied). |
| `ranks(totals, wins)` | The rank of each seat, from 1: a tie shares a rank and the next ones are skipped (1, 2, 2, 4). Feeds `PlayerResult.rank`. |
| `roundsOutcome(totals, rule)` | `{ over: false }`, or `{ over: true, winners }` with the winning seats. Over once some total has reached the target (above it, whoever has the best total wins, not necessarily that player). |

### Simultaneous steps (`simultaneous.ts`)

Every player (or several) answers in any order and the step is resolved by the last answer, inside the `apply` that receives it: secret bids, everybody reads their missions, a simultaneous card choice. Keep the answers in the state as `Submissions<T>` (`Record<string, T | null>`, keyed by player id, `null` until the player answers) and resolve the step in `apply` as soon as everyone has answered. The state never sits between two phases. The step is also what the game waits for (`waitingFor`), and an absent player is played for with `autoPlayFor`, one player at a time.

| | |
| --- | --- |
| `openSubmissions(playerIds)` | An empty step: nobody has answered. |
| `submit(submissions, playerId, value)` | The step with that answer recorded. Answering again replaces it (the last one counts); a game whose answers are final refuses the second one itself, before calling this. `RangeError` for a player who is not part of the step, and for `null` / `undefined`, which would read as "not answered". |
| `allSubmitted(submissions)` | True when everyone has answered. |
| `pendingSubmissions(submissions, seatIds)` | Who has not answered, in the order of `seatIds`: this is `waitingFor`. |
| `submittedFlags(submissions)` | Who answered, never what: all a view may show before the step is resolved. |
| `revealSubmissions(submissions, seatIds)` | The answers in seat order (`answers[seat]`), whatever the order of the keys of the stored object. Call it once `allSubmitted` is true: an answer still missing is a bug of the game, so it throws a `RangeError`. |

```ts
// apply, on the answer of one player
const bids = submit(state.bids, action.playerId, action.amount)
if (!allSubmitted(bids)) return { ...state, bids }
const amounts = revealSubmissions(bids, state.seats) // amounts[seat]
// …resolve the step with `amounts`, then open the next one with openSubmissions(state.seats)
```

### Maps (`graph.ts`)

Places joined by roads, numbered from 0, and the corners of a board (`docs/engine/02-components/22-maps.md`). The searches of `board.ts` (`reachable`, `shortestPath`, `regionOf`) take any `Network`, a `Board` or a graph.

| | |
| --- | --- |
| `graph(size, edges)` | A graph of `size` places joined by `edges` (`[a, b]` pairs): `neighbours(place)`, `edgesAt(place)`, `edgeBetween(a, b)`, `edgesBetween(a, b)`. Double routes are two roads. `RangeError` for a place the graph does not have or a road from a place to itself. |
| `cornerGraph(board)` | The corners of a square or hexagonal board: its points (where cells meet) as places and its sides as roads. 54 points and 72 sides for the 19 hexagons of Catan. Also `cellsAt(point)`, `pointsOf(cell)`, `sidesOf(cell)`, `cellsOfSide(side)` and `place(point)`. |
| `longestTrail(graph, roads, { blocked?, weight? })` | The most a trail along the given roads is worth, a road used once and a place visited again: the longest road of Catan, the longest route of Ticket to Ride. `blocked` places can be started or ended at but not passed through. |
| `Network`, `Graph`, `Edge`, `Corners`, `TrailRules` | A search's view of a board (`size`, `neighbours`), a graph, a road, the corners of a board, and the rules of a trail. |

### Tricks (`tricks.ts`)

A trick is one card from each player: the leader's sets the suit, the others follow it when they can, the best card takes it (`docs/engine/01-the-game/03-turns.md`). The helpers keep no state, and read the cards through `suitOf` and `rankOf` of the game's catalogue.

| | |
| --- | --- |
| `ledSuit(plays, suitOf)` | The suit that was led: that of the first card played that has one (a jester leads nothing); null while none has. |
| `playableCards(hand, led, { suitOf, free? })` | The cards a player may play: those of the led suit when the hand holds any, else every card; `free` names the cards that may always be played. |
| `outranks(card, winning, rules)` | Whether a card takes the trick from the one winning it, by the usual rules: suit, trump, rank, the first played keeping a tie. |
| `trickWinner(plays, rules)` | The play that wins: `rules.decide` for the whole trick, then each card against the one winning so far through `rules.beats` and `outranks`. `RangeError` for no play. |
| `playOrder(players, leader)` | The players in the order they play, the leader first. `RangeError` for a leader who is not a player. |
| `TrickPlay`, `TrickCards`, `TrickRules`, `TrickContext` | A play, what a card is to a trick, the rules (`trump`, `beats`, `decide`), and what a rule of the game is told (`led`, `trump`). |

### Drafting (`draft.ts`)

A draft: every player picks a card, the picks are revealed together, the hands go on to the next player (`docs/engine/01-the-game/03-turns.md`). The hands are lists in seat order.

| | |
| --- | --- |
| `passAround(hands, steps)` | The hands after they were passed `steps` seats on: seat `i` gives its hand to seat `i + steps`, round the table; a negative number passes the other way. `RangeError` for steps that are not a whole number. |
| `takePicks(hands, picks)` | The hands without the picked cards and what each player took (`taken[seat]`). `RangeError` for picks that are not as many as the hands or not in their hands. |

### Tiles (`tiles.ts`)

Tiles with an edge on each side, laid next to one another where the sides match, in one of their turns: Carcassonne, dominoes (`docs/engine/02-components/24-tiles.md`). The state keeps `{ at, tile, turns }` for each tile that is laid, `at` being the two numbers of a cell (`[col, row]` on squares, `[q, r]` on hexagons) on a grid that has no end; the free cells, where a tile fits and the roads and cities are worked out from it by a `tiling` made at every move. The sides are numbered as the directions of a `Board` (east first, clockwise), and a tile turned once shows on its south what it had on its east.

| | |
| --- | --- |
| `sidesOf(lattice)`, `neighbourOf(lattice, at, side)`, `oppositeSide(lattice, side)`, `around(lattice, at)` | The sides of a tile on `"square"` or `"hex"`, the cell across a side, the side that touches it, and the cells that touch a cell (the corners of a square count: eight). `RangeError` for a side or a cell that is not one. |
| `squareEdges({ north, east, south, west })`, `hexEdges({ … })` | The edges of a tile given by the side they are on, in the order of the sides. |
| `turnEdges(edges, turns)`, `distinctTurns(edges)` | The edges after `turns` turns clockwise, and the turns, from 0, that show a tile in a new way (one for a tile the same on every side, two for a straight road, four for a corner). |
| `tiling(lattice, laid, edgesOf)` | The tiles that are laid, seen as a whole: `at(cell)`, `edge(cell, side)`, `spots()` (the free cells that touch a tile, or `[0, 0]` for no tile), `fits(cell, edges, rules?)`, `placements(edges, rules?)` (every free cell with each turn where a tile fits) and `bounds()`. `TileRules` is `matches(laid, against)` (equal by default) and `allowed(cell)`. `RangeError` for two tiles on a cell or edges that are not as many as the sides. |
| `features(grid, segmentsOf, { slots })` | The roads, cities and fields of a whole layout: the `Segment`s (a `kind` and the `ports` where it touches the sides of its tile) joined across the sides, as `Feature`s with their `parts` and how many of their sides are still `open` (0: closed). A side has `slots` ports, counted clockwise round the tile, and slot `k` meets slot `slots - 1 - k` across. |
| `segmentProblems(lattice, segments, { slots, complete })` | The mistakes in the segments of one tile, as sentences, to test the game's table of tiles with. |

## Putting it together

```ts
const IDS_STREAM = 1 // each game numbers its own side streams

// setup
const seats = players.map((player) => player.id)
const rng = createSaveableRng(seed) // the shuffle stream
const idsRng = createSaveableRng(sideSeed(seed, IDS_STREAM)) // a side stream: ids reach the clients
const ids = issueIds(CATALOGUE.length, idsRng) // CATALOGUE: the cards of the game, in code
const { hands, pile } = deal(shuffle(ids, rng), seats.length, 7)
return { seats, ids, idsRng: idsRng.save(), rng: rng.save(), deck: pile, discard: [], hands, rounds: [] }

// apply: a player draws
const rng = restoreRng(state.rng)
const { drawn, piles } = drawWithReshuffle({ deck: state.deck, discard: state.discard }, count, rng)
const hands = state.hands.map((hand, s) => (s === seat ? [...hand, ...drawn] : hand))
return { ...state, ...piles, hands, rng: rng.save() }

// apply: a card the table has seen goes back into the deck, hidden again
const idsRng = restoreRng(state.idsRng)
const { ids, fresh } = reissueId(state.ids, id, idsRng) // `id` is gone from the hand it came from
return { ...state, ids, idsRng: idsRng.save(), deck: insertAt(state.deck, fresh, position) }
```

## Tests of a game

`@pbgo/engine-kit/testing` is for the tests of a binding, never for an engine (it reads the disk). `conformanceProblems(GAME, options)` plays an engine the way the server does and returns the rules of the contract it breaks as sentences (see `docs/engine/04-build-a-game/06-testing.md`); `errorVocabularyProblems` checks its error codes against its sources; `deepFreeze`, `reorderKeys` (the way `jsonb` gives a value back), `deepEqual` and `jsonProblems` are the helpers they use.

## Tests

```sh
pnpm --filter @pbgo/engine-kit test
pnpm --filter @pbgo/engine-kit typecheck
```

Every helper has its own test file next to it (`src/<module>.test.ts`). The seeded helpers that replaced a game's own version (`rng`, `ids`) are pinned to the numbers the old code gave for the same seed, so a game that moved to them deals the same cards as before.
