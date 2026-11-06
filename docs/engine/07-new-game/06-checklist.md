# Before you hand the engine over

One line per rule, each linking to the page that owns it. A line that is not true is a task.

## The engine

- It is pure: no I/O, no clock, no UI, and no dependency but `@pbgo/engine-kit` ([What an engine never does](../01-how-a-game-runs.md#what-an-engine-never-does)).
- The state holds ids and numbers only: no display data, no derived value, no log ([Lean state](../03-state-and-determinism.md#lean-state)).
- Everything random comes from the seed, and the stream is carried from one step to the next ([Determinism](../03-state-and-determinism.md#determinism), [Carrying a stream](../03-state-and-determinism.md#carrying-a-stream)).
- Every order comes from an array of the state ([Every order comes from an array](../03-state-and-determinism.md#every-order-comes-from-an-array)).
- `apply` never mutates its argument ([Nothing is mutated](../03-state-and-determinism.md#nothing-is-mutated)).
- A player's mistake is an `EngineError`, a bug a plain error ([Two kinds of errors](../03-state-and-determinism.md#two-kinds-of-errors)).
- `clientActions` is typed against the `Action` union ([What clientActions controls](../02-contract.md#what-clientactions-controls)).
- The error codes are one list ([Errors](../02-contract.md#errors)).
- `setup` refuses a table it cannot play ([Starting a game](../01-how-a-game-runs.md#starting-a-game)).

## What players see and who the game waits for

- A view shows nothing hidden to any viewer, `null` included ([Hidden information](../03-state-and-determinism.md#hidden-information)).
- The view carries the fields core reads, and `results` once the game is over ([What core reads from a view](../02-contract.md#what-core-reads-from-a-view), [Results](../02-contract.md#results)).
- `waitingFor` lists the players the game waits for, in seat order, and nothing hidden ([What the game waits for](../04-turns-and-absent-players.md#what-the-game-waits-for)).
- `autoPlayFor` completes one waiting player's step, legal and deterministic, and throws `NOT_WAITING` for anybody else ([Playing for an absent player](../04-turns-and-absent-players.md#playing-for-an-absent-player)).
- A simultaneous step is resolved in the action of the last answer ([Simultaneous steps](../04-turns-and-absent-players.md#simultaneous-steps)).
- The debug commands exist for development ([Debug commands](../02-contract.md#debug-commands)).

## The tests

- Every layer has its file, and `pnpm --filter @<slug>/engine test` and `typecheck` pass ([Testing the engine](05-testing-the-engine.md)).
- `src/takeover.test.ts` is adapted to the new engine ([Testing turns](../04-turns-and-absent-players.md#testing-turns)).

## The binding

- `GAME` is exported and the engine is a dependency of the binding ([Exporting `GAME`](04-wiring-it-in.md#exporting-game)).
- The codes core does not word are in `ERROR_CODES` ([Error codes](04-wiring-it-in.md#error-codes)).
- The game is registered and still not live ([`live` and `indexable`](04-wiring-it-in.md#live-and-indexable)).
- `pnpm test` and `pnpm typecheck` pass for the whole repo.
