# Before you hand the engine over

One line per rule, each linking to the page that owns it. A line that is not true is a task.

## The engine

- It is pure: no I/O, no clock, no UI, and no dependency but `@pbgo/engine-kit` ([What an engine never does](../01-the-game/11-the-contract.md#what-an-engine-never-does)).
- The state holds ids and numbers only: no display data, no derived value, no log ([Lean state](../01-the-game/09-state.md#lean-state)).
- Everything random comes from the seed, and the stream is carried from one step to the next ([Determinism](../01-the-game/09-state.md#determinism), [Carrying a stream](../01-the-game/09-state.md#carrying-a-stream)).
- Every order comes from an array of the state ([Every order comes from an array](../01-the-game/09-state.md#every-order-comes-from-an-array)).
- `apply` never mutates its argument ([Nothing is mutated](../01-the-game/09-state.md#nothing-is-mutated)).
- A player's mistake is an `EngineError`, a bug a plain error ([Two kinds of errors](../01-the-game/05-actions.md#two-kinds-of-errors)).
- `clientActions` is typed against the `Action` union ([What clientActions controls](../01-the-game/05-actions.md#what-clientactions-controls)).
- The error codes are the shared ones and the game's own, in one list ([Errors](../01-the-game/05-actions.md#errors)).
- `setup` refuses a table it cannot play ([Starting a game](../01-the-game/01-how-a-game-runs.md#starting-a-game)).
- The engine holds no text: its options and the lines of its score name keys, and their words are written in the game's Sanity ([The words of options and scores](../01-the-game/07-parameters.md#the-words-of-options-and-scores)).

## What players see and who the game waits for

- A view shows nothing hidden to any viewer, `null` included ([Hidden information](../01-the-game/10-views.md#hidden-information)).
- The view carries `results` once the game is over ([What core reads from a view](../01-the-game/10-views.md#what-core-reads-from-a-view), [Results](../01-the-game/06-victory.md#victory-and-results)).
- `waitingFor` lists the players the game waits for, in seat order, and nothing hidden ([`waitingFor`](../01-the-game/03-turns.md#waitingfor)).
- `autoPlayFor` completes one waiting player's step, legal and deterministic, and throws `NOT_WAITING` for anybody else ([Playing for an absent player](../01-the-game/03-turns.md#playing-for-an-absent-player)).
- A simultaneous step is resolved in the action of the last answer ([Simultaneous steps](../01-the-game/03-turns.md#simultaneous-steps)).
- The debug commands exist for development ([Debug commands](../01-the-game/11-the-contract.md#debug-commands)).

## The tests

- Every layer has its file, and `pnpm --filter @<slug>/engine test` and `typecheck` pass ([Testing the engine](06-testing.md)).
- `src/takeover.test.ts` is adapted to the new engine ([Testing turns](06-testing.md#testing-turns)).
- `src/conformance.test.ts` passes, with the `secretsFor` of the game ([The conformance test](06-testing.md#the-conformance-test)).

## The binding

- `GAME` is exported and the engine is a dependency of the binding ([Exporting `GAME`](05-wiring-it-in.md#exporting-game)).
- The game's own codes, and only those, are in `ERROR_CODES`, and `src/error-codes.test.ts` passes ([Error codes](05-wiring-it-in.md#error-codes)).
- The game is registered and still not live ([`live` and `indexable`](05-wiring-it-in.md#live-and-indexable)).
- `pnpm test` and `pnpm typecheck` pass for the whole repo.
