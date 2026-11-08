# State

The server stores a game as a state and rebuilds from it what every player sees, the view ([Views](10-views.md), [Hidden information](10-views.md#hidden-information)). The seeded streams an engine draws from are in `packages/engine-kit/src/rng.ts`.

## Lean state

- **Ids and numbers only.** Names, texts, labels, colours and image paths are display data: they live in the game's catalogue (code) and in Sanity, and the board draws them from the view. A card in the state is an id, an amount is a number.
- **No derived values.** What can be computed from the rest of the state is computed, never stored: totals, who leads, the size of a pile, whose turn it is, who the game waits for.
- **No log.** What happened is not what the next move needs. `apply` returns a state and nothing else, so the contract has no way to hand events over.
- **Plain JSON.** The state is stored as `jsonb`: an `undefined` field vanishes, and `Map`, `Set`, `Date` and class instances do not survive.

## What goes where

| Kind | In Flip 7 |
| --- | --- |
| In the state | `seats`, `ids`, `rng`, `deck`, `discard`, `lines`, `status`, `stack`, `rounds`, `stats`, `dealer`, `options` (`State` in `types.ts`) |
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
- So an engine never calls `Math.random` or `Date.now`. The one exception is `randomSeed()`, called from `setup` when no seed was given: `const seed = args.seed ?? randomSeed()` in Flip 7's `setup.ts`.
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

## Random numbers

| Export | What it does | Errors |
| --- | --- | --- |
| `Rng` | A stream: a function that returns a number in [0, 1) each time it is called | |
| `SaveableRng` | An `Rng` that also has `save()`, which returns its position as one number | |
| `createSaveableRng(seed)` | A seeded stream (mulberry32) with `save()`; only the low bits of `seed` count | |
| `createRng(seed)` | The same numbers, for a caller that never saves the position | |
| `restoreRng(saved)` | Carries on from a `save()`: the next numbers are the ones the saved stream would have drawn | `RangeError` for anything `save()` could not have returned |
| `shuffle(items, rng)` | A shuffled copy (Fisher-Yates); draws nothing for fewer than two items | |
| `sideSeed(seed, ...parts)` | A seed for an independent stream, from the high bits of the game seed and integers of your choice | |
| `randomSeed()` | A fresh seed of the kind the server draws; the only function of the kit that is not deterministic | |

- `save()` moves with every draw, so call it after the last draw of a step. A missing or damaged position would silently restart the stream, and every game would draw the same cards: that is why `restoreRng` refuses it.
- `sideSeed` leaves out the low bits that `createRng` uses, so a side stream is unrelated to the shuffle; `parts` are public integers, and a new set is a new stream.
- `shuffle` returns a new array and leaves `items` alone; the order depends on the stream only. The numbers a seed gives are pinned in `rng.test.ts`: a change to the generator would change every game already in play.
