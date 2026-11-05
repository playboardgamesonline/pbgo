# State and determinism

The server stores a game as a state and rebuilds what every player sees from it. These are the rules every engine keeps for that state: what goes in it, where its randomness comes from, how its orders are kept and what it may reveal.

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

A derived value is a function of the state. From `games/flip-7/packages/engine/src/machine.ts`:

```ts
/** What each seat has banked in the finished rounds. */
export function totalsOf(s: State): number[] {
  return sumRounds(s.rounds, s.seats.length)
}
```

## Determinism

- The server draws the seed of a game (`newSeed()`, see [Starting a game](01-how-a-game-runs.md#starting-a-game)); everything random comes from a stream seeded with it, so the same seed and the same actions give the same game.
- Pinned-seed tests rely on it, and so does `autoPlayFor`, which must give the same result for the same state.
- So an engine never calls `Math.random` or `Date.now`. The one exception is `randomSeed()`, called from `setup` when no seed was given: `const seed = args.seed ?? randomSeed()` in Flip 7's `setup.ts`.
- Test that a pinned seed gives the same game and that nothing calls `Math.random` once a seed is given (`vi.spyOn(Math, "random")` in `games/courtisans/packages/engine/src/determinism.test.ts`).

| Function | What it does |
| --- | --- |
| `createSaveableRng(seed)` | A stream of numbers in [0, 1) with `save()`, which returns its position as one number; only the low bits of the seed count |
| `restoreRng(saved)` | Carries on from a saved position; `RangeError` for one that `save()` could not have returned |
| `createRng(seed)` | The same numbers, for a caller that never saves the position |
| `shuffle(items, rng)` | A shuffled copy |
| `sideSeed(seed, ...parts)` | A seed for an independent stream, from the high bits of the game seed and a few integers of your choice |
| `randomSeed()` | A fresh seed; the only function of the kit that is not deterministic |

## Carrying a stream

- Keep `rng.save()` in the state (one number) and `restoreRng` it in the next step: the stream picks up where it stopped.
- Numbers that reach the clients, opaque ids above all, come from a side stream (`sideSeed`), never from the stream that shuffles, or anybody who rebuilt it would know the deck. Each game numbers its own side streams; the kit reserves none.

Flip 7 picks the stream up when a step opens and saves the position back when it closes. From `games/flip-7/packages/engine/src/machine.ts`:

```ts
const s = structuredClone(state)
return { s, rng: restoreRng(s.rng), events: [] }
// …
ctx.s.rng = ctx.rng.save()
```

## Every order comes from an array

- `jsonb` returns the keys of an object in its own order, shortest first and then alphabetical, not the order they were written in.
- Every order (seats, turns, who is pending, who plays next) comes from an array of the state, never from `Object.keys` of a record keyed by player. A record can still serve as a lookup.
- The kit's per-player helpers take the list of seats, or return arrays aligned with it.
- Test it with ids of different lengths, seated as `long-id`, `x1`, `x0`, or with `reorderKeys` (`test-utils.ts` of Flip 7). From `template/packages/engine/src/demo/game.test.ts`:

```ts
const e = demo.setup({ players: seated, options: {}, seed: 7 })
// the database gives the keys of an object back shortest first, then alphabetically
const stored: State = { ...e, bids: JSON.parse('{"x0":null,"x1":null,"long-id":null}') as State["bids"] }
expect(demo.waitingFor!(stored)).toEqual(["long-id", "x1", "x0"])
```

## Nothing is mutated

- `apply` returns a new state and leaves its argument alone: it can run again on a fresh row ([The life of an action](01-how-a-game-runs.md#the-life-of-an-action)), and the kit's helpers take `readonly` arguments and return new arrays and objects.
- Two ways to write a step: build the next state with spreads, or clone it once and mutate the private copy, as Flip 7's `open` does.
- Catch a mutation in tests by freezing every state a step returns (`deepFreeze` in `test-utils.ts` of Flip 7): the next step throws if it writes to its input.

## Hidden information

- `view(state, playerId)` returns what that viewer may see and nothing more; `null` is a viewer outside the table ([What is public](01-how-a-game-runs.md#what-is-public)).
- A view shows no hand, no secret answer and no order of a pile. Test it for every kind of viewer. From `template/packages/engine/src/demo/game.test.ts`:

```ts
const view = demo.view(e, "j1")
expect(view.me?.hand).toEqual(e.players[1]!.hand)
expect(JSON.stringify(view)).not.toContain(e.players[0]!.hand[0]!.id + '"')
expect(demo.view(e, null).me).toBeNull()
```

## Opaque ids and the per-viewer log

- **Opaque ids** (`ids.ts`): a card that clients can see face down is shown under a number that says nothing about it, and a card that goes back into hiding gets a new id (`reissueId`).
- **The per-viewer log** (`log.ts`): a `LogEntry` holds the event in full for the players it concerns (`to`) and a `masked` version for the others; `viewLog(entries, viewerId)` filters. The log is not in the state.
- The reference of both is `packages/engine-kit/README.md`.

## Two kinds of errors

- A player's mistake (an illegal move, a move out of turn, a card they do not hold) is an `EngineError(code)` ([Errors](02-contract.md#errors)).
- A bug of the game (an id that does not exist, a pile too short, a position out of range) is a plain error: the kit's helpers throw `RangeError`. Validate the player's input first, so a `RangeError` never comes from a move.
- What each does to the request is in [What reaches apply](01-how-a-game-runs.md#what-reaches-apply).
- Flip 7's `perform` checks, in this order: the game is not over, the action is well formed, the game waits for the player, the action belongs to what the game waits for, then the rule itself.
