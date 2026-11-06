# Turns

The turn helpers say who a game waits for and play for a player who is absent. They take a definition, or any object that has the turn hooks (`TurnHooks`), and read the deprecated hooks too, so an engine written for the older contract keeps running ([Deprecated hooks](../02-contract.md#deprecated-hooks)). The module is `packages/engine-kit/src/turns.ts`.

## Exports

| Export | What it does | Errors |
| --- | --- | --- |
| `TurnHooks<State>` | The part of a definition the helpers read: `isOver`, `waitingFor`, `autoPlayFor` and the deprecated `activePlayer`, `autoPlay` and `debug` | |
| `waitingPlayers(game, state)` | The players the game waits for: `waitingFor`, else `activePlayer` as a list of one; in the order the engine gave, without duplicates, empty once the game is over | |
| `currentPlayer(game, state)` | Whose turn it is, or `null`: the deprecated `activePlayer` when the game has it, else the first waiting player | |
| `canPlayFor(game)` | Whether the server can play for an absent player: the game knows who waits and has a way to play. Reads the definition, not a state | |
| `playFor(game, state, playerId)` | Plays the current step of one waiting player with `autoPlayFor`, or with the deprecated `autoPlay` or `debug.turn` when that player is the only one waiting | `EngineError`: `NOT_WAITING`, `AUTOPLAY_UNSUPPORTED` |
| `playOn(game, state, maxSteps?)` | Plays for the first waiting player again and again, until the game is over, nobody is waiting or `maxSteps` plays were made | `EngineError`: `AUTOPLAY_UNSUPPORTED` |

## Rules

- `waitingPlayers` returns a new array, never the engine's own, and drops anything that is not a string, such as the `null` of an `activePlayer` with nobody to play.
- `playFor` throws `NOT_WAITING` before it reaches any hook, for a player who is not waiting and for anybody once the game is over.
- `playFor` prefers `autoPlayFor`; the deprecated hooks serve only when a single player waits (`canPlayFor` does not check it), and `AUTOPLAY_UNSUPPORTED` means neither can.
- `playOn` is for tests, simulations and previews, and `maxSteps` stops a game that never ends ([Testing turns](../04-turns-and-absent-players.md#testing-turns)).
- Core reads them to say who the game waits for and to play for an absent player ([Absent players in core](../04-turns-and-absent-players.md#absent-players-in-core)).

From `games/exploding-kittens/packages/engine/src/game.test.ts`, where `newState` sets up a table: the same seed plays the same game, each played to its end by `playOn`.

```ts
const first = playOn(GAME, newState(n, seedOf(n)))
expect(playOn(GAME, newState(n, seedOf(n))), String(n)).toStrictEqual(first)
```
