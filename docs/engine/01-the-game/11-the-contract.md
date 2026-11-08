# The contract

`GameDefinition<State, Action, View, SetupData>` in `packages/engine-kit/src/contract.ts` is the whole contract between an engine and the app: an engine is one object of that type, exported as `GAME`. `@pbgo/engine-kit` (`packages/engine-kit`) is pure TypeScript with no UI and no dependency, consumed as source and imported from the package root; an engine re-exports it with `export * from "@pbgo/engine-kit"`.

## The fields

| Field | Required | Role | Rule |
| --- | --- | --- | --- |
| `id` | yes | The game's identifier | Its slug by convention |
| `name` | yes | The game's name | Shown in the game-over footer and on the gamemaster's monitoring page |
| `minPlayers`, `maxPlayers` | yes | The bounds of a table | The gamemaster can narrow them, never widen them |
| `options` | yes | The `OptionDefinitions` of the game | `{}` for none; see [Options](07-parameters.md#options) |
| `presets` | no | Option combinations, `OptionPreset`s | Applied over the defaults and normalized by `applyPreset`; no screen of the app offers them |
| `clientActions` | yes | The action types a client may send | See [What clientActions controls](05-actions.md#what-clientactions-controls) |
| `setup` | yes | `({ players, options, seed?, data? }) => State`: a new game | `data` is the `SetupData` (the last type parameter, `undefined` by default) that the binding's `loadSetupData` hands over; see [Starting a game](01-how-a-game-runs.md#starting-a-game) |
| `apply` | yes | `(state, action) => State`: plays one action | Validates everything, throws `EngineError` for an illegal move, never mutates `state` |
| `view` | yes | `(state, playerId) => View`: what one viewer sees | `playerId` is `null` outside the table; see [Hidden information](10-views.md#hidden-information) |
| `isOver` | yes | `(state) => boolean` | True once the game has ended; core then stores the status `over` |
| `debug` | no | `Partial<Record<DebugCommand, (state) => State>>` | See [Debug commands](#debug-commands) |
| `waitingFor` | no, but a game with turns needs it | `(state) => readonly string[]`: the players the game waits for | See [`waitingFor`](03-turns.md#waitingfor) |
| `autoPlayFor` | no, but absent players need it | `(state, playerId) => State`: plays one waiting player's current step | See [Playing for an absent player](03-turns.md#playing-for-an-absent-player) |
| `activePlayer`, `autoPlay` | no | `@deprecated` | See [Deprecated hooks](#deprecated-hooks) |

## The types around it

| Type | What it is |
| --- | --- |
| `PlayerInfo` | `{ id, nickname }`: a seat as `setup` receives it |
| `PlayerAction` | `{ type, playerId }`: what every `Action` extends; the server sets `playerId` |
| `Results`, `PlayerResult` | The end of a game, in the view ([Results](06-victory.md#victory-and-results)) |
| `AnyGameDefinition` | `GameDefinition<any, any, any, any>`: what core, the registry and the kit's helpers hold |
| `OptionDefinitions`, `OptionValues`, `OptionPreset` | The options, their values and the presets (`packages/engine-kit/src/options.ts`) |

## A minimal engine

From `games/flip-7/packages/engine/src/game.ts`, the whole definition of Flip 7. Its bodies are in `setup.ts`, `actions.ts` (`step`), `view.ts`, `machine.ts` (`isOver`, `waitingFor`), `autoplay.ts`, `debug.ts` and `options.ts`, and its types in `types.ts`:

```ts
export const GAME: GameDefinition<State, Action, PlayerView> = {
  id: "flip-7",
  name: "Flip 7",
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  options: OPTIONS,
  clientActions: CLIENT_ACTIONS,
  setup: ({ players, options, seed }) => setupGame({ players, options, seed }),
  apply: (state, action) => step(state, action).state,
  view: (state, playerId) => playerView(state, playerId),
  isOver,
  waitingFor,
  autoPlayFor,
  debug: debugCommands,
}
```

## Debug commands

`GameDefinition.debug` maps `DebugCommand` names to functions of a state, to reach a situation of the game without playing up to it. `turn` (play an automatic turn) and `over` (play to the end) are the shared names; a game adds its own.

- `POST .../debug` runs a command on the stored state, for a player who sits at the table. `start`, a new game through `setup`, is handled by the route; an unknown command answers `INVALID_ACTION`, and a production build answers `DEBUG_DISABLED` unless `DEBUG_GAMES=1`.
- A board shows the commands as buttons of its debug panel (`?debug` in the URL, or Shift+D).

## Deprecated hooks

- `activePlayer(state)` returns the one player who must play, or `null`; `autoPlay(state)` plays that player's turn. They allow one waiting player at a time.
- A new engine implements `waitingFor` and `autoPlayFor`. Nothing reads the deprecated hooks directly: the kit's helpers fall back on them, so an engine that only has them keeps running ([Turns](03-turns.md)).

## What an engine never does

- **I/O.** No database, network, file or Sanity read; what the rules need from outside arrives as `SetupData`. The only dependency of an engine package is `@pbgo/engine-kit`.
- **The clock.** No `Date.now()` or `new Date()`: the contract has no time ([Not built yet](../03-not-built-yet.md#what-the-contract-leaves-out)).
- **Randomness outside the seed.** No `Math.random` ([Determinism](09-state.md#determinism)).
- **Display data in the state** ([Lean state](09-state.md#lean-state)).
- **Mutation** ([Nothing is mutated](09-state.md#nothing-is-mutated)).
- **UI.** No React, no board, no import of `@pbgo/core`.

The [conformance test](../04-build-a-game/06-testing.md#the-conformance-test) plays an engine and checks most of this, step by step.
