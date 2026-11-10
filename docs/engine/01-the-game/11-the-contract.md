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
| `setupStep` | no | `({ players, options, seed?, data? }) => Step`: `setup` that also says what happened while the game was set up | `setupStep(args).state` is what `setup(args)` gives; see [Events and the log](12-events-and-the-log.md) |
| `apply` | yes | `(state, action) => State`: plays one action | Validates everything, throws `EngineError` for an illegal move, never mutates `state` |
| `step` | no | `(state, action) => Step`: `apply` that also says what happened | `step(state, action).state` is what `apply` gives; the events go to the log of the table ([Events and the log](12-events-and-the-log.md)) |
| `view` | yes | `(state, playerId) => View`: what one viewer sees | `playerId` is `null` outside the table; see [Hidden information](10-views.md#hidden-information) |
| `isOver` | yes | `(state) => boolean` | True once the game has ended; core then stores the status `over` |
| `progress` | no | `(state) => number`: how far the game has come, from 0 to 100 | A number at every state, the same for the same state; the table sends it as `PublicGame.progress` through `progressOf` (never more than 99 before the game is over, 100 after). Flip 7: the best total over the target. The bar of the HUD and what a player who leaves weighs are for the HUD and PLT-21 to use |
| `debug` | no | `Partial<Record<DebugCommand, (state) => State>>` | See [Debug commands](#debug-commands) |
| `waitingFor` | no, but a game with turns needs it | `(state) => readonly string[]`: the players the game waits for | See [`waitingFor`](03-turns.md#waitingfor) |
| `autoPlayFor` | no, but absent players need it | `(state, playerId, at?) => State`: plays one waiting player's current step; `at` is the time the server plays it at, for a game with a clock | See [Playing for an absent player](03-turns.md#playing-for-an-absent-player) |
| `autoPlayStep` | no, but a game with a `step` needs it | `(state, playerId, at?) => Step`: `autoPlayFor` that also says what happened | `autoPlayStep(state, playerId, at).state` is what `autoPlayFor` gives; see [Events and the log](12-events-and-the-log.md) |
| `begin` | no, but a game with a clock needs it | `(state, at) => State`: the game goes live at `at` | The server calls it once, when every player is ready: a game with a clock starts the clock of its first step here, and not in `setup`, so the players do not lose time to the ready check. See [Timers](../02-components/20-timers.md#in-the-engine) |
| `nextDeadline` | no, but a game with a clock needs it | `(state) => Deadline \| null`: when the game needs the clock next, and the system action to play then | Null for a game with no clock, between two steps that have none and once the game is over; the server plays it on the first request that looks at the table after the time. See [Timers](../02-components/20-timers.md#in-the-engine) |
| `activePlayer`, `autoPlay` | no | `@deprecated` | See [Deprecated hooks](#deprecated-hooks) |

## The types around it

| Type | What it is |
| --- | --- |
| `PlayerInfo` | `{ id, nickname }`: a seat as `setup` receives it |
| `PlayerAction` | `{ type, playerId, at? }`: what every `Action` extends; the server sets `playerId` and `at`, the time it plays the action at, in milliseconds |
| `Timer`, `Deadline` | `{ endsAt, seconds }`, the clock of a step as the state keeps it, and `{ at, action }`, what `nextDeadline` answers: the time and the system action that the clock plays then ([Timers](../02-components/20-timers.md)) |
| `Results`, `PlayerResult` | The end of a game, in the view ([Results](06-victory.md#results)), and `outcomesOf`, which reads them as a win, a loss, a draw or a win or loss of the whole table for each player ([Outcomes](06-victory.md#outcomes)) |
| `Standing` | `{ playerId, score }`: what a player has so far, in the view as `standings`, for the list of the players in the HUD ([Keeping the score](../02-components/09-score.md#keeping-the-score)) |
| `Step`, `LogEntry` | What a move gives back when the game says what happened: the state and the events, each event with the players who read it in full and what the others read instead ([Events and the log](12-events-and-the-log.md)) |
| `AnyGameDefinition` | `GameDefinition<any, any, any, any, any>`: what core, the registry and the kit's helpers hold |
| `OptionDefinitions`, `OptionValues`, `OptionPreset` | The options, their values and the presets (`packages/engine-kit/src/options.ts`) |

## A minimal engine

From `games/flip-7/packages/engine/src/game.ts`, the whole definition of Flip 7. Its bodies are in `setup.ts`, `actions.ts` (`step`), `view.ts`, `machine.ts` (`isOver`, `waitingFor`), `autoplay.ts`, `debug.ts` and `options.ts`, and its types in `types.ts`:

```ts
export const GAME: GameDefinition<State, Action, PlayerView, undefined, Flip7Event> = {
  id: "flip-7",
  name: "Flip 7",
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  options: OPTIONS,
  clientActions: CLIENT_ACTIONS,
  setup: ({ players, options, seed }) => setupGame({ players, options, seed }),
  setupStep: ({ players, options, seed }) => setupStep({ players, options, seed }),
  apply: (state, action) => step(state, action).state,
  step,
  view: (state, playerId) => playerView(state, playerId),
  isOver,
  waitingFor,
  autoPlayFor,
  autoPlayStep,
  debug: debugCommands,
}
```

## Debug commands

`GameDefinition.debug` maps `DebugCommand` names to functions of a state, to reach a situation of the game without playing up to it. `turn` (play an automatic turn) and `over` (play to the end) are the shared names; a game adds its own.

- `POST .../debug` runs a command on the stored state, for a player who sits at the table. `start`, a new game through `setup`, is handled by the route; an unknown command answers `INVALID_ACTION`, and a production build answers `DEBUG_DISABLED` unless `DEBUG_GAMES=1`.
- A board shows the commands as buttons of its debug panel (`?debug` in the URL, or Shift+D).
- The platform has commands of its own next to the game's: `start`, `state` (the state of the table, saved) and `load` (a saved state put in its place). They are described in [Tuning](../04-build-a-game/07-tuning.md#keeping-and-loading-a-state).

## Deprecated hooks

- `activePlayer(state)` returns the one player who must play, or `null`; `autoPlay(state)` plays that player's turn. They allow one waiting player at a time.
- A new engine implements `waitingFor` and `autoPlayFor`. Nothing reads the deprecated hooks directly: the kit's helpers fall back on them, so an engine that only has them keeps running ([Turns](03-turns.md)).

## What an engine never does

- **I/O.** No database, network, file or Sanity read; what the rules need from outside arrives as `SetupData`. The only dependency of an engine package is `@pbgo/engine-kit`.
- **The clock.** No `Date.now()` or `new Date()`: the server tells an engine the time, as the `at` of every action, and an engine says when it needs the clock in `nextDeadline` ([Timers](../02-components/20-timers.md#in-the-engine)).
- **Randomness outside the seed.** No `Math.random` ([Determinism](09-state.md#determinism)).
- **Display data in the state** ([Lean state](09-state.md#lean-state)).
- **Mutation** ([Nothing is mutated](09-state.md#nothing-is-mutated)).
- **UI.** No React, no board, no import of `@pbgo/core`.

The [conformance test](../04-build-a-game/06-testing.md#the-conformance-test) plays an engine and checks most of this, step by step.
