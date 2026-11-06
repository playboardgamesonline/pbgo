# Random numbers

Everything random in an engine comes from a stream seeded from the game's seed, so the same seed and the same actions give the same game ([Determinism](../03-state-and-determinism.md#determinism)). The module is `packages/engine-kit/src/rng.ts`.

## Exports

| Export | What it does | Errors |
| --- | --- | --- |
| `Rng` | A stream: a function that returns a number in [0, 1) each time it is called | |
| `SaveableRng` | An `Rng` that also has `save()`, which returns its position as one number | |
| `createSaveableRng(seed)` | A seeded stream (mulberry32) with `save()`; only the low bits of `seed` count | |
| `createRng(seed)` | The same numbers, for a caller that never saves the position | |
| `restoreRng(saved)` | Carries on from a `save()`: the next numbers are the ones the saved stream would have drawn | `RangeError` for anything `save()` could not have returned |
| `shuffle(items, rng)` | A shuffled copy (Fisher-Yates); draws nothing for fewer than two items | |
| `sideSeed(seed, ...parts)` | A seed for an independent stream, from the high bits of the game seed and integers of your choice | |
| `randomSeed()` | A fresh seed of the kind the server draws ([Starting a game](../01-how-a-game-runs.md#starting-a-game)); the only function of the kit that is not deterministic | |

## Rules

- `save()` moves with every draw, so call it after the last draw of a step ([Carrying a stream](../03-state-and-determinism.md#carrying-a-stream)).
- A missing or damaged position would silently restart the stream, and every game would draw the same cards: that is why `restoreRng` refuses it.
- `sideSeed` leaves out the low bits that `createRng` uses, so a side stream is unrelated to the shuffle.
- `parts` are public integers: a new set is a new stream.
- `shuffle` returns a new array and leaves `items` alone; the order depends on the stream only.
- The numbers a seed gives are pinned in `rng.test.ts`: a change to the generator would change every game already in play.

From `games/flip-7/packages/engine/src/setup.ts`, the two streams of a game: the shuffle's and, for the card ids, a side stream.

```ts
const seed = args.seed ?? randomSeed()
const rng = createSaveableRng(seed)
const idsRng = createSaveableRng(sideSeed(seed, IDS_STREAM))
```
