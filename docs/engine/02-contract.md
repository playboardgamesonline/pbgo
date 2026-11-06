# The engine contract

`GameDefinition<State, Action, View, SetupData>` in `packages/engine-kit/src/contract.ts` is the whole contract between an engine and the app. An engine is one object of that type, exported as `GAME`; core and the registry hold it as `AnyGameDefinition`.

## GameDefinition

| Field | Required | Role | Rule |
| --- | --- | --- | --- |
| `id` | yes | The game's identifier | Its slug by convention |
| `name` | yes | The game's name | Shown in the game-over footer and on the gamemaster's monitoring page |
| `minPlayers`, `maxPlayers` | yes | The bounds of a table | The gamemaster can narrow them, never widen them |
| `options` | yes | The `OptionDefinitions` of the game | `{}` for none; see [Options and presets](01-how-a-game-runs.md#options-and-presets) |
| `presets` | no | Option combinations, `OptionPreset`s | Applied over the defaults and normalized by `applyPreset`; no screen of the app offers them |
| `clientActions` | yes | The action types a client may send | See [What clientActions controls](#what-clientactions-controls) |
| `setup` | yes | `({ players, options, seed?, data? }) => State`: a new game | See [Starting a game](01-how-a-game-runs.md#starting-a-game) |
| `apply` | yes | `(state, action) => State`: plays one action | Validates everything, throws `EngineError` for an illegal move, never mutates `state` |
| `view` | yes | `(state, playerId) => View`: what one viewer sees | `playerId` is `null` outside the table; see [Hidden information](03-state-and-determinism.md#hidden-information) |
| `isOver` | yes | `(state) => boolean` | True once the game has ended; core then stores the status `over` |
| `debug` | no | `Partial<Record<DebugCommand, (state) => State>>` | See [Debug commands](#debug-commands) |
| `waitingFor` | no, but a game with turns needs it | `(state) => readonly string[]`: the players the game waits for | See [What the game waits for](04-turns-and-absent-players.md#what-the-game-waits-for) |
| `autoPlayFor` | no, but absent players need it | `(state, playerId) => State`: plays one waiting player's current step | See [Playing for an absent player](04-turns-and-absent-players.md#playing-for-an-absent-player) |
| `activePlayer`, `autoPlay` | no | `@deprecated` | See [Deprecated hooks](#deprecated-hooks) |

`SetupData`, the last type parameter (`undefined` by default), is what the binding's `loadSetupData` hands to `setup` as `data`. `Action` extends `PlayerAction`.

## Deprecated hooks

- `activePlayer(state)` returns the one player who must play, or `null`; `autoPlay(state)` plays that player's turn. They allow one waiting player at a time.
- Nothing reads them directly: the kit's helpers fall back on them, so an engine that only has them keeps running ([The kit's helpers](04-turns-and-absent-players.md#the-kits-helpers)).
- A new engine implements `waitingFor` and `autoPlayFor`.

## Debug commands

- `turn` (play an automatic turn) and `over` (play to the end) are the shared names; a game adds its own.
- `POST .../debug` runs a command on the stored state, for a player who sits at the table. `start`, a new game through `setup`, is handled by the route; an unknown command answers `INVALID_ACTION`.
- The route answers `DEBUG_DISABLED` in a production build unless `DEBUG_GAMES=1`.
- A board shows the commands as buttons of its debug panel (`?debug` in the URL, or Shift+D).

## The types around it

| Type | What it is |
| --- | --- |
| `PlayerInfo` | `{ id, nickname }`: a seat as `setup` receives it |
| `PlayerAction` | `{ type, playerId }`: what every action extends; the server sets `playerId` |
| `Results`, `PlayerResult` | The end of a game, in the view ([Results](#results)) |
| `AnyGameDefinition` | `GameDefinition<any, any, any, any>`: what core, the registry and the kit's helpers hold |
| `DebugCommand` | `"turn"`, `"over"`, or any string a game adds |
| `OptionDefinitions`, `OptionValues`, `OptionPreset` | The options, their values and the presets (`packages/engine-kit/src/options.ts`) |

## Results

- The definition has no member for results: the view holds `results: Results | null`, set once the game is over, next to `phase: "over"`.
- `Results` is `{ players: PlayerResult[]; winners: string[] }`; `winners` are player ids, several on a tie.
- A `PlayerResult` is `{ playerId, total, rank, detail }`: `total` is the score shown, `rank` starts at 1 and a tie shares a rank (`ranks()` of the kit), `detail` is a list of `{ key, label, points }` drawn as chips.
- Core reads `view.results` when `view.phase === "over"`, for the game-over panel and the victory announcement; no server code reads it.
- A game can extend `PlayerResult` with fields for its own board.

## What core reads from a view

Core reads four optional fields of a view (`CoreView` in `packages/core/lib/binding.ts`); the server reads none.

- `phase`: a string; the shared UI takes `"over"` for the end of the game.
- `results`: see [Results](#results).
- `me`: `{ id: string }` for the viewer, `null` for a spectator; the ticker's "your turn" and the takeover pill need `me.id`.
- `log`: a list; only its length is read, to pick the victory phrase.

## Errors

- `EngineError(code, message?)` is what an engine throws for a player's mistake. The answer carries the `code` only, so `message` is for tests and debugging.
- `isEngineError(error)` also accepts an engine's own class of the same shape (`name === "EngineError"` and a string `code`): `instanceof` alone misses it, since one app serves every game.
- The client shows, in order: the message written in Sanity for the code (Setup › Copy › Errors; a code of the game falls back on English), the platform's own message, then `[missing: errorMessages.<CODE>]`.
- Core words the codes of its own routes, `NOT_YOUR_TURN`, `UNKNOWN_CARD` and the two the kit throws, `NOT_WAITING` and `AUTOPLAY_UNSUPPORTED`: the list is `CORE_ERROR_MESSAGES` (`packages/core/lib/api.ts`).
- A game words its other codes through `ERROR_CODES` of its binding, which fills Setup › Copy › Errors. A listed code without a message is logged and reads `[missing: …]`; a code thrown and not listed has no message.
- Core's own routes also throw `INVALID_ACTION`, `UNKNOWN_PLAYER`, `GAME_NOT_STARTED` and `INVALID_REQUEST`, which it does not word: list one to word it.
- Keep a game's codes in one `as const` list, a comment per code (`FLIP7_ERROR_CODES`).
- A bug of the game is not an `EngineError` ([Two kinds of errors](03-state-and-determinism.md#two-kinds-of-errors)).

## What clientActions controls

- `clientActions` lists the action types a client may send; any other `type` is refused with `INVALID_ACTION` before `apply` runs.
- It filters, it does not validate: `apply` gets the rest of the body as written ([What reaches apply](01-how-a-game-runs.md#what-reaches-apply)).
- `debug` commands, `autoPlayFor` and `setup` do not go through the list.
- Type the list against the union so it cannot drift. From `games/flip-7/packages/engine/src/types.ts`:

  ```ts
  export const CLIENT_ACTIONS = ["hit", "stay", "target", "deal"] as const satisfies readonly Action["type"][]
  ```

## A minimal engine

The definition of Flip 7, from `games/flip-7/packages/engine/src/game.ts`. Its bodies are in `setup.ts`, `actions.ts` (`step`), `view.ts`, `machine.ts` (`isOver`, `waitingFor`), `autoplay.ts`, `debug.ts` and `options.ts`, and its types in `types.ts`.

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
