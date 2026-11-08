# Testing the engine

An engine is tested in layers, from one rule to a whole game with absent players. Each layer below names the file to copy. Tests sit next to the code (`*.test.ts`) and run with Vitest: `pnpm --filter @<slug>/engine test` for the engine, `pnpm --filter @pbgo-game/<slug> test` for the binding, and `pnpm test` runs every package.

## The layers

| Layer | What it checks | Model |
| --- | --- | --- |
| A file per part of the rules | Each rule on its own, with the page of the rulebook it comes from | Flip 7: `catalogue.test.ts`, `scoring.test.ts`, `setup.test.ts`, `deal.test.ts`, `turns.test.ts`, `cards.test.ts`, `rounds.test.ts` |
| The definition | The id, the bounds, the options, `clientActions` and the error codes in one list | Flip 7: `game.test.ts` |
| Whole games | Every table size played to the end by `playOn` or by a random player, with `problems` checked after every move | Flip 7: `simulation.test.ts`, `autoplay.test.ts`; the template: `game.test.ts` |
| Determinism | The same seed gives the same game, nothing calls `Math.random` once a seed is given, `autoPlayFor` gives the same state for the same state | Courtisans: `determinism.test.ts`; Flip 7: `setup.test.ts` |
| Views and hidden information | For every viewer, `null` and a stranger included, no hidden id anywhere in the JSON of a view | Flip 7: `view.test.ts`; Courtisans: `view.test.ts`; the template: `game.test.ts` |
| The order of keys | A state given back by `reorderKeys` plays, waits and views the same | Flip 7: `game.test.ts`, `simulation.test.ts`; the template: `game.test.ts` |
| No mutation | A step on a state frozen with `deepFreeze` throws if it writes to it, and a refusal leaves the state as it was | Flip 7: `turns.test.ts`, `simulation.test.ts` |
| Junk actions | Wrong types, missing fields and strangers are refused with a code of the game's list | Flip 7: `simulation.test.ts`, `turns.test.ts` |
| Absent players | `playFor` plays each player the game waits for and refuses anybody else with `NOT_WAITING`; a table of absent players ends | Flip 7: `autoplay.test.ts`, `simulation.test.ts`; Courtisans: `game.test.ts` |
| The commands | Each debug command, and that a command that rigs the draw pile changes nothing outside its moment | Flip 7: `debug.test.ts` |
| The takeover in the binding | A whole game in which players never come back, with the real voting rules of core | The template: `src/takeover.test.ts` |
| The error vocabulary in the binding | Every code the engine throws is a shared one or one that `ERROR_CODES` lists, and the list holds the game's own only | The template: `src/error-codes.test.ts` |

## Rules

- Check the invariants after every move, not only at the end: `problems(state)` of Flip 7's `test-utils.ts` gives one sentence for each thing that does not hold, and `[]` for a sound state.
- Rig a state by naming the cards, never their ids: a test does not know which id a card holds. `layout()` of `test-utils.ts` builds a table from card names.
- Vary both halves of a seed in a test over seeds: the deal and the card ids use different bits of it (`seedOf` of `test-utils.ts`; [Random numbers](../01-the-game/09-state.md#random-numbers)).
- Write the expected score again in the test, from the names of the faces, and compare it with the engine's, as `simulation.test.ts` does for the booklet's scoring.
- Assert a refusal by its code. A thing that throws without one is a bug of the game, and `refusal()` rethrows it.
- Test absent players in the engine with `playFor`, and in the binding with `src/takeover.test.ts`, adapted to the new engine (`humanMove` is the one part that knows the game).

From `games/flip-7/packages/engine/src/test-utils.ts`:

```ts
export function refusal(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === "string") return code
    throw error
  }
  throw new Error("The action was accepted")
}
```

## Testing turns

- `playFor` plays for a waiting player and throws `NOT_WAITING` for anybody else, and for the same player once their step is done.
- `playOn` plays whole games: loop it over seeds and table sizes and check what must hold at the end.
- Assert `waitingFor` at each phase, and in seat order for a state whose keys `jsonb` gave back in another order.
- For the binding, `template/src/takeover.test.ts` plays a whole game in which players never come back, with the real `castVotes`, `presentPlayers` and `isStalled` of core; only its `humanMove` knows the game, so adapt it to the new engine (`pnpm --filter @pbgo-game/<slug> test`).
- For the server, `server/takeover.test.ts` tests the voting rules and `server/game-events.test.ts` the routes against an in-memory table.

From `template/packages/engine/src/demo/game.test.ts`:

```ts
const played = playFor(demo, e, "j1")
expect(() => playFor(demo, played, "j1")).toThrow(expect.objectContaining({ code: "NOT_WAITING" }))
```

## Where the patterns are shown

- The seed and the `Math.random` spy: [Determinism](../01-the-game/09-state.md#determinism).
- The order of keys: [Every order comes from an array](../01-the-game/09-state.md#every-order-comes-from-an-array).
- Freezing a state: [Nothing is mutated](../01-the-game/09-state.md#nothing-is-mutated).
- A view that hides a hand: [Hidden information](../01-the-game/10-views.md#hidden-information).
- `playFor`, `playOn` and the takeover test: [Testing turns](#testing-turns) above, and the helpers in [Turns](../01-the-game/03-turns.md).
