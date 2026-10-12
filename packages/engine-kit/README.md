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
- **No log in the state.** What happened is not something the next move needs. A game keeps no history in its `State`. The kit gives the shape of a log entry and the per-viewer filter ([`log`](#log-logts)); how an engine hands its entries to the platform is not settled yet, so nothing in the kit assumes it.

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
- **Two kinds of errors.** `EngineError(code)` is for what a player can get wrong (an illegal move, not their turn): its code is shown to them through the game's error messages. The helpers of the kit throw a plain `RangeError` for what only a bug of the game can cause (an id that does not exist, a pile too short, a position out of range). The game validates the player's input first, so a `RangeError` never reaches a player.

## Reference

### Contract

`contract.ts`, `errors.ts`. `GameDefinition<State, Action, View, SetupData>` with `setup`, `apply`, `view`, `isOver`, `options`, `presets`, `clientActions`, `waitingFor`, `autoPlayFor`, `debug` (and `activePlayer` / `autoPlay`, `@deprecated`). Also `PlayerInfo`, `PlayerAction`, `PlayerResult`, `Results`, `AnyGameDefinition`, `DebugCommand`, `EngineError` and `isEngineError`. The principles and the demo game are explained in `template/docs/GAME_GUIDE.md`.

### Turns

`turns.ts`. Everything that needs to know whose turn it is goes through these, never through the hooks of the definition, so a game written for the previous contract keeps working.

| | |
| --- | --- |
| `waitingPlayers(game, state)` | The players the game waits for, in seat order, no duplicates; nobody once the game is over. |
| `currentPlayer(game, state)` | The player whose turn it is, or `null`. |
| `canPlayFor(game)` | Whether the server can play for an absent player of this game. |
| `playFor(game, state, playerId)` | Plays the current step of one waiting player (`autoPlayFor`). `EngineError("NOT_WAITING")` if they are not waiting, `"AUTOPLAY_UNSUPPORTED"` if the game cannot. |
| `playOn(game, state, maxSteps = 1000)` | Plays for the first waiting player until the game is over. For tests and simulations. |

### Options

`options.ts`. Declarative game options (`number` / `choice` / `boolean`, optional `group`, `requires`, `conflictsWith`, `players`): `defaultOptions`, `normalizeOptions`, `optionStatus`, `optionGroup`, `applyPreset`, `presetMatches`.

### Random numbers (`rng.ts`)

| | |
| --- | --- |
| `createSaveableRng(seed)` | A seeded stream of numbers in [0, 1) (mulberry32) with `save()`, which returns its position. Only the low 32 bits of the seed count. |
| `createRng(seed)` | The same numbers, for a caller that never saves the position. |
| `restoreRng(saved)` | Carries on from a `save()`. `RangeError` unless `saved` is an unsigned 32-bit integer: a missing or damaged position would silently restart the stream, and every game would then draw the same cards. |
| `shuffle(items, rng)` | A shuffled copy (Fisher–Yates). |
| `sideSeed(seed, ...parts)` | A 32-bit seed for an independent stream, from the high bits of the game seed and a few integers of your choice. |
| `randomSeed()` | A fresh game seed (an integer below 2^52, like the server's). The only function of the kit that is not deterministic. |

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

`viewLog(entries, viewerId)` returns the log as that viewer reads it, oldest first: the full event when the entry is public (`to` absent) or addressed to them, else its `masked` version, else nothing. `null` is a spectator. `event` and `masked` are plain data (ids and numbers, never display text): the client turns them into sentences in the viewer's language. The log is never part of the state, see [the rule](#the-rule-lean-state): these functions only filter, wherever the entries are kept.

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

## Tests

```sh
pnpm --filter @pbgo/engine-kit test
pnpm --filter @pbgo/engine-kit typecheck
```

Every helper has its own test file next to it (`src/<module>.test.ts`). The seeded helpers that replaced a game's own version (`rng`, `ids`) are pinned to the numbers the old code gave for the same seed, so a game that moved to them deals the same cards as before.
