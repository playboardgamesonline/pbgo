# State

The server stores a game as a state and rebuilds from it what every player sees, the view ([Views](10-views.md), [Hidden information](10-views.md#hidden-information)). The seeded streams an engine draws from are in `packages/engine-kit/src/rng.ts`.

## Lean state

- **Ids and numbers only.** Names, texts, labels, colours and image paths are display data: they live in the game's catalogue (code) and in Sanity, and the board draws them from the view. A card in the state is an id, an amount is a number.
- **No derived values.** What can be computed from the rest of the state is computed, never stored: totals, who leads, the size of a pile, whose turn it is, who the game waits for.
- **No log.** What happened is not what the next move needs. The engine says it apart from the state, with `step`: the new state and the events of the move ([Events and the log](12-events-and-the-log.md)). The platform keeps them in the log of the table.
- **Plain JSON.** The state is stored as `jsonb`: an `undefined` field vanishes, and `Map`, `Set`, `Date` and class instances do not survive.

## What goes where

| Kind | In Flip 7 |
| --- | --- |
| In the state | `seats`, `ids`, `rng`, `deck`, `discard`, `lines`, `status`, `stack`, `rounds`, `stats`, `dealer`, `options` (`State` in `types.ts`) |
| In the log, not in the state | The events of a move (`Flip7Event`: a round, a draw, a stay, a bust…), said by `step` and kept by the platform ([Events and the log](12-events-and-the-log.md)) |
| Computed | `totalsOf` (from `rounds`), `isOver`, `results`, `waitingFor`, `roundScore`, the size of the deck |
| Lives elsewhere | The faces (`CATALOGUE`, `CARDS`), the names, pictures and texts (Sanity), the nicknames (the table's `players`) |

## Every order comes from an array

- `jsonb` returns the keys of an object in its own order, shortest first and then alphabetical, not the order they were written in.
- Every order (seats, turns, who is pending, who plays next) comes from an array of the state, never from `Object.keys` of a record keyed by player. A record can still serve as a lookup.
- The kit's per-player helpers take the list of seats, or return arrays aligned with it.
- Test it with ids of different lengths, seated as `long-id`, `x1`, `x0`, or with `reorderKeys` of `@pbgo/engine-kit/testing`, which the [conformance test](../04-build-a-game/06-testing.md#the-conformance-test) applies to every step. From `template/packages/engine/src/demo/game.test.ts`:

```ts
const e = demo.setup({ players: seated, options: {}, seed: 7 })
// the database gives the keys of an object back shortest first, then alphabetically
const stored: State = { ...e, bids: JSON.parse('{"x0":null,"x1":null,"long-id":null}') as State["bids"] }
expect(demo.waitingFor!(stored)).toEqual(["long-id", "x1", "x0"])
```

## Nothing is mutated

- `apply` returns a new state and leaves its argument alone: it can run again on a fresh row ([The life of an action](01-how-a-game-runs.md#the-life-of-an-action)), and the kit's helpers take `readonly` arguments and return new arrays and objects.
- Two ways to write a step: build the next state with spreads, or clone it once and mutate the private copy, as Flip 7's `open` does.
- Catch a mutation in tests by freezing every state a step returns (`deepFreeze` of `@pbgo/engine-kit/testing`, which the conformance test does): the next step throws if it writes to its input.

## Determinism

- The server draws the seed of a game (`newSeed()`, see [Starting a game](01-how-a-game-runs.md#starting-a-game)); everything random comes from a stream seeded with it, so the same seed and the same actions give the same game.
- Pinned-seed tests rely on it, and so does `autoPlayFor`, which must give the same result for the same state.
- So an engine never calls `Math.random` or `Date.now`. What it knows of time is the `at` of an action, which the server sets, and the clock of a step that it keeps in its state as a `Timer` ([Timers](../02-components/20-timers.md)). The one exception is `randomSeed()`, called from `setup` when no seed was given: `const seed = args.seed ?? randomSeed()` in Flip 7's `setup.ts`.
- Test that a pinned seed gives the same game and that nothing calls `Math.random` once a seed is given (`vi.spyOn(Math, "random")` in `games/courtisans/packages/engine/src/determinism.test.ts`).

### Carrying a stream

- Keep `rng.save()` in the state (one number) and `restoreRng` it in the next step: the stream picks up where it stopped.
- Numbers that reach the clients, opaque ids above all, come from a side stream (`sideSeed`), never from the stream that shuffles, or anybody who rebuilt it would know the deck. Each game numbers its own side streams; the kit reserves none.

Flip 7 picks the stream up when a step opens and saves the position back when it closes. From `games/flip-7/packages/engine/src/machine.ts`:

```ts
const s = structuredClone(state)
return { s, rng: restoreRng(s.rng), events: [] }
// …
ctx.s.rng = ctx.rng.save()
```

## Counters and tracks

| Export | What it does | Errors |
| --- | --- | --- |
| `CounterRules`, `changeCounter(rules, value, delta)` | A number changed by `delta` and held between the ends the game gives, with what was really applied and the end that cut it short, if one did ([Counters](../02-components/14-counters.md)) | `RangeError` for ends that no number is between, a value or a change that is not a finite number, a counter outside its ends |
| `TrackRules`, `moveAlong(track, from, steps)` | A marker moved along a row of spaces, forward or back, that stops at the ends or goes round: where it ended, the spaces it went through, the laps it made and the end that stopped it, if one did ([Tracks](../02-components/15-tracks.md)) | `RangeError` for a track with no space, a marker that is not on a space of it, steps that are not whole or that are more than `MAX_WALK` |

- A counter is a number of the state and a position on a track is another: the state holds the numbers and nothing else, and the board knows the spaces by their number. Markers that share a space are kept in the order they came, in an array.

## Bags

| Export | What it does | Errors |
| --- | --- | --- |
| `bagSize(counts)`, `drawFromBag(rng, counts, count)` | How many tokens a bag holds, and tokens drawn from it at random without putting them back: `{ drawn, bag }`, the kinds in the order they came and the counts that are left, one draw of the stream for each ([Bags](../02-components/18-bags.md)) | `RangeError` for counts that are not whole numbers and for a number of tokens that is not |

- A bag is an array of counts indexed by kind, never an object keyed by kind: an order comes from an array.

## Boards

| Export | What it does | Errors |
| --- | --- | --- |
| `squareBoard({ columns, rows, diagonals? })`, `hexBoard({ radius })`, `hexBoard({ columns, rows })` | A grid of cells numbered from 0, row by row from the top, that says who is next to a cell, how far two cells are and the coordinates of each ([Boards](../02-components/16-boards.md)) | `RangeError` for a board with no cell, a cell that is not on it and a direction it does not have |
| `reachable`, `shortestPath`, `regionOf`, `lineBetween`, `rayFrom` | The cells that can be reached in some steps, the way from one cell to another, the cells linked to one, a straight line and what a sliding piece sees: all over the cells' numbers, going round the cells the game blocks | `RangeError` for a cell that is not on the board, a range that is not a number of steps |

- The state holds the number of the cell a piece stands on, not its coordinates. A board has no state of its own: a game makes it once and asks it.

## Random numbers

| Export | What it does | Errors |
| --- | --- | --- |
| `Rng` | A stream: a function that returns a number in [0, 1) each time it is called | |
| `SaveableRng` | An `Rng` that also has `save()`, which returns its position as one number | |
| `createSaveableRng(seed)` | A seeded stream (mulberry32) with `save()`; only the low bits of `seed` count | |
| `createRng(seed)` | The same numbers, for a caller that never saves the position | |
| `restoreRng(saved)` | Carries on from a `save()`: the next numbers are the ones the saved stream would have drawn | `RangeError` for anything `save()` could not have returned |
| `shuffle(items, rng)` | A shuffled copy (Fisher-Yates); draws nothing for fewer than two items | |
| `rollDie(rng, sides)`, `rollDice(rng, count, sides)`, `rerollDice(rng, dice, reroll, sides)` | A die, a pool, a pool with some dice rolled again: one draw of the stream for each die rolled ([Dice](../02-components/10-dice.md)) | `RangeError` for a die with fewer than two sides, a count that is not a whole number, an index that is not a die of the pool |
| `sideSeed(seed, ...parts)` | A seed for an independent stream, from the high bits of the game seed and integers of your choice | |
| `randomSeed()` | A fresh seed of the kind the server draws; the only function of the kit that is not deterministic | |

- `save()` moves with every draw, so call it after the last draw of a step. A missing or damaged position would silently restart the stream, and every game would draw the same cards: that is why `restoreRng` refuses it.
- `sideSeed` leaves out the low bits that `createRng` uses, so a side stream is unrelated to the shuffle; `parts` are public integers, and a new set is a new stream.
- `shuffle` returns a new array and leaves `items` alone; the order depends on the stream only. The numbers a seed gives are pinned in `rng.test.ts`: a change to the generator would change every game already in play.
