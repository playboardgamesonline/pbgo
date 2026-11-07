# Writing the engine

An engine is written from the data up to the definition: the box, the state, the rules of a step, then what a player sees. The files are Flip 7's (`games/flip-7/packages/engine/src`); a game with more rules adds files (Exploding Kittens has `effects.ts`, `combos.ts` and `window.ts`) and keeps the parts. A file imports only the ones above it in the table, and a test file sits next to each ([Testing the engine](06-testing.md)). What each Flip 7 file holds is in [Flip 7](../05-examples/01-a-lean-engine.md), and the helpers the parts call are described where they are used: [Options](../01-the-game/07-parameters.md#options), [Turns](../01-the-game/03-turns.md), [Random numbers](../01-the-game/09-state.md#random-numbers), [Decks and piles](../02-components/06-decks-and-piles.md) and [Rounds](../01-the-game/06-victory.md#rounds).

## The order

| # | Part | File | Rule it keeps |
| --- | --- | --- | --- |
| 1 | State, actions and views | `types.ts` | The state holds ids and numbers only ([Lean state](../01-the-game/09-state.md#lean-state)); `CLIENT_ACTIONS` is typed against the `Action` union ([What clientActions controls](../01-the-game/05-actions.md#what-clientactions-controls)) |
| 2 | Error codes | `types.ts` | One `as const` list, a comment per code, each code a player's mistake ([Errors](../01-the-game/05-actions.md#errors)) |
| 3 | The box as data | `catalogue.ts` | Names, pictures and texts stay out of the state: it holds ids and the catalogue says what they are ([What goes where](../01-the-game/09-state.md#what-goes-where)) |
| 4 | Options | `options.ts` | Data, normalized by the kit ([Expansions and helpers](../01-the-game/07-parameters.md#expansions-and-helpers), [Options](../01-the-game/07-parameters.md#options)) |
| 5 | Scoring | `scoring.ts` | Pure functions of the components, never of a state |
| 6 | The machinery of a step | `machine.ts` | A step opens a private copy and closes it with the stream saved back; `waitingFor`, `isOver` and the totals are computed from the state ([Nothing is mutated](../01-the-game/09-state.md#nothing-is-mutated), [Carrying a stream](../01-the-game/09-state.md#carrying-a-stream)) |
| 7 | The rules of play | `round.ts`, `actions.ts` | Everything is checked before anything changes: an illegal move is an `EngineError`, a bug a plain error ([Two kinds of errors](../01-the-game/05-actions.md#two-kinds-of-errors)); piles are drawn with [Decks](../02-components/06-decks-and-piles.md) |
| 8 | Setup | `setup.ts` | A table the engine cannot play is refused with `INVALID_PLAYERS`; everything random comes from the seed, and cards get opaque ids ([Starting a game](../01-the-game/01-how-a-game-runs.md#starting-a-game), [Determinism](../01-the-game/09-state.md#determinism), [Random numbers](../01-the-game/09-state.md#random-numbers), [Opaque ids](../01-the-game/10-views.md#opaque-ids)) |
| 9 | Results | `results.ts` | `Results` once the game is over and `null` before ([Results](../01-the-game/06-victory.md#victory-and-results), [Rounds](../01-the-game/06-victory.md#rounds)) |
| 10 | The view | `view.ts` | A viewer sees what they may and nothing more, `null` included ([Hidden information](../01-the-game/10-views.md#hidden-information)) |
| 11 | Absent players | `autoplay.ts` | One waiting player's step, legal and deterministic; `NOT_WAITING` for anybody else ([Playing for an absent player](../01-the-game/03-turns.md#playing-for-an-absent-player), [Turns](../01-the-game/03-turns.md)) |
| 12 | Debug commands | `debug.ts` | Development only ([Debug commands](../01-the-game/11-the-contract.md#debug-commands)) |
| 13 | The definition | `game.ts` | One `GameDefinition` exported as `GAME` |
| 14 | The exports | `index.ts` | The kit and the engine's names |

## The `GAME` export

- `game.ts` builds one `GameDefinition<State, Action, PlayerView>` and exports it as `GAME`. Every hook calls a part above, so the file holds no rule ([A minimal engine](../01-the-game/11-the-contract.md#a-minimal-engine)).
- `index.ts` re-exports the kit with the engine's names, so the binding can import both from `@<slug>/engine`; a name the kit exports cannot be declared again by the engine.
- The binding re-exports `GAME` ([Wiring the engine into the app](05-wiring-it-in.md)).

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
- The binding's `ERROR_CODES` lists the codes the engine throws and core does not word; their messages are written in Sanity, never in the code ([Error codes](05-wiring-it-in.md#error-codes)).
- A bug of the game is not an `EngineError`; the kit's helpers throw `RangeError` for it.

From `games/flip-7/packages/engine/src/actions.ts`:

```ts
if (lineOf(s, frame.seat).length === 0) throw new EngineError("CANNOT_STAY", "You have no card in front of you: hit")
```
