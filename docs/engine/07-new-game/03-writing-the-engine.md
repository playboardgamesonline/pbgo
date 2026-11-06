# Writing the engine

An engine is written from the data up to the definition: the box, the state, the rules of a step, then what a player sees. The files are Flip 7's (`games/flip-7/packages/engine/src`); a game with more rules adds files (Exploding Kittens has `effects.ts`, `combos.ts` and `window.ts`) and keeps the parts. A file imports only the ones above it in the table, and a test file sits next to each ([Testing the engine](05-testing-the-engine.md)). What each Flip 7 file holds is in [Flip 7](../08-examples/01-flip-7.md), and the helpers the parts call are in [The engine kit](../06-kit/index.md).

## The order

| # | Part | File | Rule it keeps |
| --- | --- | --- | --- |
| 1 | State, actions and views | `types.ts` | The state holds ids and numbers only ([Lean state](../03-state-and-determinism.md#lean-state)); `CLIENT_ACTIONS` is typed against the `Action` union ([What clientActions controls](../02-contract.md#what-clientactions-controls)) |
| 2 | Error codes | `types.ts` | One `as const` list, a comment per code, each code a player's mistake ([Errors](../02-contract.md#errors)) |
| 3 | The box as data | `catalogue.ts` | Names, pictures and texts stay out of the state: it holds ids and the catalogue says what they are ([What goes where](../03-state-and-determinism.md#what-goes-where)) |
| 4 | Options | `options.ts` | Data, normalized by the kit ([Options and presets](../01-how-a-game-runs.md#options-and-presets), [Options](../06-kit/01-options.md)) |
| 5 | Scoring | `scoring.ts` | Pure functions of the components, never of a state |
| 6 | The machinery of a step | `machine.ts` | A step opens a private copy and closes it with the stream saved back; `waitingFor`, `isOver` and the totals are computed from the state ([Nothing is mutated](../03-state-and-determinism.md#nothing-is-mutated), [Carrying a stream](../03-state-and-determinism.md#carrying-a-stream)) |
| 7 | The rules of play | `round.ts`, `actions.ts` | Everything is checked before anything changes: an illegal move is an `EngineError`, a bug a plain error ([Two kinds of errors](../03-state-and-determinism.md#two-kinds-of-errors)); piles are drawn with [Decks](../06-kit/06-decks.md) |
| 8 | Setup | `setup.ts` | A table the engine cannot play is refused with `INVALID_PLAYERS`; everything random comes from the seed, and cards get opaque ids ([Starting a game](../01-how-a-game-runs.md#starting-a-game), [Determinism](../03-state-and-determinism.md#determinism), [Random numbers](../06-kit/04-random-numbers.md), [Opaque ids](../06-kit/05-opaque-ids.md)) |
| 9 | Results | `results.ts` | `Results` once the game is over and `null` before ([Results](../02-contract.md#results), [Rounds](../06-kit/08-rounds.md)) |
| 10 | The view | `view.ts` | A viewer sees what they may and nothing more, `null` included ([Hidden information](../03-state-and-determinism.md#hidden-information)) |
| 11 | Absent players | `autoplay.ts` | One waiting player's step, legal and deterministic; `NOT_WAITING` for anybody else ([Playing for an absent player](../04-turns-and-absent-players.md#playing-for-an-absent-player), [Turns](../06-kit/02-turns.md)) |
| 12 | Debug commands | `debug.ts` | Development only ([Debug commands](../02-contract.md#debug-commands)) |
| 13 | The definition | `game.ts` | One `GameDefinition` exported as `GAME` |
| 14 | The exports | `index.ts` | The kit and the engine's names |

## The `GAME` export

- `game.ts` builds one `GameDefinition<State, Action, PlayerView>` and exports it as `GAME`. Every hook calls a part above, so the file holds no rule ([A minimal engine](../02-contract.md#a-minimal-engine)).
- `index.ts` re-exports the kit with the engine's names, so the binding can import both from `@<slug>/engine`; a name the kit exports cannot be declared again by the engine.
- The binding re-exports `GAME` ([Wiring the engine into the app](04-wiring-it-in.md)).

From `games/flip-7/packages/engine/src/index.ts`:

```ts
export * from "@pbgo/engine-kit"
export * from "./types"
export { step } from "./actions"
// …
export { GAME } from "./game"
```

## Errors

- A player's mistake is `throw new EngineError("<CODE>", "<message>")`: the answer carries the code only, and the message is for tests and debugging.
- The codes are one list in `types.ts` (`FLIP7_ERROR_CODES`), the meaning of each in a comment. `game.test.ts` keeps it free of duplicates, and `simulation.test.ts` fails on a refusal whose code is not in it.
- The binding's `ERROR_CODES` lists the codes the engine throws and core does not word; their messages are written in Sanity, never in the code ([Error codes](04-wiring-it-in.md#error-codes)).
- A bug of the game is not an `EngineError`; the kit's helpers throw `RangeError` for it.

From `games/flip-7/packages/engine/src/actions.ts`:

```ts
if (lineOf(s, frame.seat).length === 0) throw new EngineError("CANNOT_STAY", "You have no card in front of you: hit")
```
