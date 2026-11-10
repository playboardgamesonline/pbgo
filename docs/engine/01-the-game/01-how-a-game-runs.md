# How a game runs

An engine is a set of pure functions over a state. The server stores the game, sends it to the browsers and keeps its secrets. This page follows a game from the lobby to the board.

## Who owns what

| Layer | Package | Owns |
| --- | --- | --- |
| Engine | `@<slug>/engine` | The rules: `setup`, `apply`, `view`, `isOver`, who the game waits for |
| Server | `@pbgo/core`: `server/` and `routes/api/games/` | Storage, the version lock, the broadcast, rate limits, player identity, the takeover votes |
| Binding | `@pbgo-game/<slug>` | Hands the engine to the app as `GAME`, with the site constants, error codes, data loaders and board |
| Board | `Game` of the binding's `./ui` | Draws the view it is given and sends actions |

## The life of an action

1. The board posts `{ type, ...fields }` to `/api/<slug>/games/<code>/action` (`api.action`); `gameRoute()` answers `GAME_NOT_FOUND` for a game that is unknown or not playable here.
2. The route (`packages/core/routes/api/games/[code]/action/route.ts`) applies the `action` rule of `RATE_LIMITS`, gets the caller's id with `getPlayerId`, made from the secret in the `<slug>_player` cookie, and checks the `type` against `GAME.clientActions` ([What clientActions controls](05-actions.md#what-clientactions-controls)).
3. `updateGame` (`packages/core/server/games.ts`) reads the table's row and runs the modifier shown in [What reaches apply](05-actions.md#what-reaches-apply). The modifier plays the action with `stepOf`: the new state, and the events of the move when the game says them ([Events and the log](12-events-and-the-log.md)).
4. It writes `version + 1` only if `version` is still the one it read, an optimistic lock. On a lost race it reads again and re-runs the modifier, up to `MAX_ATTEMPTS`, then answers `CONFLICT`. So `apply` may run more than once for one request.
5. After the write, the events of the move are added to the log of the table (`game_log`), then `notify` broadcasts `update` with `{ version }` on the channel `game:<slug>:<code>`. A failed log write or broadcast is logged and ignored.
6. The response is the table as the caller sees it (`servedGame`), with `GAME.view(state, playerId)` and the caller's lines of the log.
7. Other clients (`useLiveGame`) hear `update` and, when the version is newer, read `GET /api/<slug>/games/<code>`, which answers with their own view. They also read on a timer and on window focus, so a lost broadcast costs a delay.

## Starting a game

- A table is opened, joined and started on the platform's page of the game (`/game/<slug>/<code>` while it waits for players); once it is started, its address `/<slug>/game/<code>` shows the board.
- `GAME.setup` runs through `newGame` (`packages/core/server/games.ts`, which uses `setupOf`: a game whose setup says what it did opens its log with it), from `start` (the host, on a table that waits for players), `replay` (once every player has voted for a rematch), the debug route's `start` and the admin preview.
- A rematch is a new game: a new seed, the same players and options.
- A table the engine cannot play is the engine's to refuse: `setup` throws `EngineError("INVALID_PLAYERS")`.
- Core holds a table to `minPlayers` and `maxPlayers` (the gamemaster can narrow them), but tests call `setup` directly.

| Argument | Where it comes from |
| --- | --- |
| `players` | The seats in the order they joined, `{ id, nickname }` and nothing more: `id` is made by `playerIdOf` from the secret in the player's `<slug>_player` cookie ([Where an id comes from](02-players.md#where-an-id-comes-from)), `nickname` the name of the signed-in account or what a guest typed (`resolveSeat`); the picture of an account never reaches `setup` |
| `options` | The options the table holds, normalized by core for this number of players |
| `seed` | `newSeed()`: a random integer below 2^52 drawn with `crypto`, new for every game and every rematch |
| `data` | `SetupData`: what the binding's `loadSetupData` returns, loaded before the write and in the default language; `undefined` without a loader |
