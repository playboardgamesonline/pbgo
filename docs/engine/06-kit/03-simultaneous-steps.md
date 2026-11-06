# Simultaneous steps

A simultaneous step is one that several players answer in any order, the last answer ending it: secret bids, everybody reading their missions. The module is `packages/engine-kit/src/simultaneous.ts`; how a step is written, with the demo's bids, is in [Simultaneous steps](../04-turns-and-absent-players.md#simultaneous-steps).

## Exports

| Export | What it does | Errors |
| --- | --- | --- |
| `Submissions<T>` | The answers of a step: a record by player id, `null` until the player answers | |
| `openSubmissions(playerIds)` | Opens the step: nobody has answered | |
| `submit(submissions, playerId, value)` | A new step with that answer; answering again replaces it | `RangeError` for a player outside the step and for a `null` or `undefined` answer |
| `allSubmitted(submissions)` | True once every player has answered | |
| `pendingSubmissions(submissions, playerIds)` | The players who have not answered, in the order of `playerIds` | |
| `submittedFlags(submissions)` | Who has answered, as a boolean by player id, and never what | |
| `revealSubmissions(submissions, playerIds)` | The answers in the order of `playerIds`: `answers[seat]` is the answer of the player in that seat | `RangeError` for an answer that is missing |

## Rules

- `playerIds` is the game's own list of players in seat order: the keys of a stored record come back in the database's order ([Every order comes from an array](../03-state-and-determinism.md#every-order-comes-from-an-array)).
- In `apply`, record the answer and, once `allSubmitted` is true, resolve the step in the same action with `revealSubmissions`: the state never sits between two phases.
- In `waitingFor`, return `pendingSubmissions`; when who has answered is secret, list every player instead, as the Nope window of Exploding Kittens does ([What the game waits for](../04-turns-and-absent-players.md#what-the-game-waits-for)).
- In `view`, show `submittedFlags` and no answer until the step is resolved.
- A game whose answers are final refuses the second one itself, with its own `EngineError`, before it calls `submit`.
- `0`, an empty string and `false` are answers, only `null` means no answer, and a step with no player is complete.

From `games/exploding-kittens/packages/engine/src/window.ts`, where a Nope window waits for every responder to pass: a second pass is refused by the game, and the last one closes the window in the same action.

```ts
export function pass(ctx: Ctx, by: string, chain: number): void {
  const phase = responding(ctx, by, chain)
  if (phase.passed[by] === true) throw new EngineError("ALREADY_PASSED", "You passed already")
  phase.passed = submit(phase.passed, by, true)
  if (allSubmitted(phase.passed)) closeWindow(ctx)
}
```
