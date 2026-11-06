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
2. The route (`packages/core/routes/api/games/[code]/action/route.ts`) applies the `action` rule of `RATE_LIMITS`, reads the player's id from the `<slug>_player` cookie and checks the `type` against `GAME.clientActions` ([What clientActions controls](02-contract.md#what-clientactions-controls)).
3. `updateGame` (`packages/core/server/games.ts`) reads the table's row and runs the modifier shown in [What reaches apply](#what-reaches-apply).
4. It writes `version + 1` only if `version` is still the one it read, an optimistic lock. On a lost race it reads again and re-runs the modifier, up to `MAX_ATTEMPTS`, then answers `CONFLICT`. So `apply` may run more than once for one request.
5. After the write, `notify` broadcasts `update` with `{ version }` on the channel `game:<slug>:<code>`. A failed broadcast is logged and ignored.
6. The response is the table as the caller sees it (`publicGame`), with `GAME.view(state, playerId)`.
7. Other clients (`useLiveGame`) hear `update` and, when the version is newer, read `GET /api/<slug>/games/<code>`, which answers with their own view. They also read on a timer and on window focus, so a lost broadcast costs a delay.

## What reaches apply

The modifier of step 3, from `packages/core/routes/api/games/[code]/action/route.ts`:

```ts
const row = await updateGame(game, params.code ?? "", (row) => {
  if (!row.state || row.status !== "playing") throw new ApiError("GAME_NOT_STARTED", 409)
  const state = GAME.apply(row.state, { ...action, playerId: id })
  return { state, status: GAME.isOver(state) ? "over" : "playing" }
})
```

- Core replaces `playerId` with the id of the cookie, so a client cannot act for another player.
- It checks nothing else: the rest of the body reaches `apply` as written, so `apply` checks the payload, that the player sits at the table and that the move is theirs.
- An `EngineError` ends the request before the write; any other error is logged and answers `SERVER_ERROR`.

## What is public

- The `State` is read by the server only (the `state` column of `games`, row level security, no policy): it never reaches a browser.
- `PublicGame` (`packages/core/lib/game-types.ts`) is all a browser receives: the table's code, host, `status` and `players` (id, nickname and the picture of their account, if any), `options`, `replay` (who voted for a rematch), `view`, and `waitingFor`, `present` and `takeovers`.
- `waitingFor`, `present` and `takeovers` are the same for every viewer.
- `view` gets the viewer's id when they sit at the table and `null` for everybody else. The read route needs no cookie, so a view must be safe to show to anybody.
- Neither the seed nor a saved stream position is in a view.

## Starting a game

- A table is opened, joined and started on the platform's page of the game (`/game/<slug>/<code>` while it waits for players); once it is started, its address `/<slug>/game/<code>` shows the board.
- `GAME.setup` runs through `newGame` (`packages/core/server/games.ts`), from `start` (the host, on a table that waits for players), `replay` (once every player has voted for a rematch), the debug route's `start` and the admin preview.
- A rematch is a new game: a new seed, the same players and options.
- A table the engine cannot play is the engine's to refuse: `setup` throws `EngineError("INVALID_PLAYERS")`.
- Core holds a table to `minPlayers` and `maxPlayers` (the gamemaster can narrow them), but tests call `setup` directly.

| Argument | Where it comes from |
| --- | --- |
| `players` | The seats in the order they joined, `{ id, nickname }` and nothing more: `id` is the random value of the player's `<slug>_player` cookie, `nickname` the name of the signed-in account or what a guest typed (`resolveProfile`); the picture of an account never reaches `setup` |
| `options` | The options the table holds, normalized by core for this number of players |
| `seed` | `newSeed()`: a random integer below 2^52 drawn with `crypto`, new for every game and every rematch |
| `data` | `SetupData`: what the binding's `loadSetupData` returns, loaded before the write and in the default language; `undefined` without a loader |

## Options and presets

- An engine declares `options` as data: each is a `number`, a `choice` or a `boolean`, with a `label` and an optional `help`.
- An option may add `group` (`parameter`, or `extension` for an optional module), `requires`, `conflictsWith` (the first declared wins) and `players` (the table sizes it exists for).
- The platform's page of the game does not draw them from the declaration. It offers the expansions of the game and its helpers, each with an id, and a choice reaches the engine only when that id is the key of one of its options (`engineOptionsOf`, `packages/core/lib/table-options.ts`, used by `table-creator.tsx` and `own-lobby.tsx` in `apps/web/src/components`). An option that no expansion or helper carries cannot be chosen at a table and keeps its default.
- `label` and `help` are shown as written in the gamemaster's Setup › Mechanics; the platform does not translate them.
- `normalizeOptions` clamps numbers, drops unknown values and switches off an option whose constraints are not met. Core runs it in `gameOptions` (`packages/core/lib/settings.ts`) and in `newGame`, at `start` and at `replay`, and `setup` runs it again.
- The gamemaster sets the defaults and can hide an option, which then keeps its default.
- `presets` are combinations of options and `applyPreset` normalizes them, so a preset cannot bypass a constraint; no screen of the app offers them.

## How an engine is wired in

- `@<slug>/engine` exports its definition as `GAME` and re-exports the kit (`export * from "@pbgo/engine-kit"`).
- The binding's `src/index.ts` re-exports `GAME`; its `src/server.ts` re-exports `./index` and adds `loadSetupData`, `loadGameData` and `ROUTES`.
- The registry (`@pbgo/games`) imports `@pbgo-game/<slug>/server` on the first request for the game and gives core a `GameModule` (`packages/core/lib/binding.ts`). Core never imports a game.
- A binding without `GAME` is not playable: its page on the hub says "Coming soon" and its tables and API answer not found. With one, `isPlayable` makes it playable outside production, and in production once it is `live` in the registry.
- `ERROR_CODES` lists the codes core cannot word ([Errors](02-contract.md#errors)); `ROUTES` adds routes outside the contract.

From `template/src/index.ts`:

```ts
export { GAME } from "@template/engine"
export * from "./lib/site"
```

## What an engine never does

- **I/O.** No database, network, file or Sanity read; what the rules need from outside arrives as `SetupData`. The only dependency of an engine package is `@pbgo/engine-kit`.
- **The clock.** No `Date.now()` or `new Date()`: the contract has no time ([Limits](04-turns-and-absent-players.md#limits)).
- **Randomness outside the seed.** No `Math.random` ([Determinism](03-state-and-determinism.md#determinism)).
- **Display data in the state** ([Lean state](03-state-and-determinism.md#lean-state)).
- **Mutation** ([Nothing is mutated](03-state-and-determinism.md#nothing-is-mutated)).
- **UI.** No React, no board, no import of `@pbgo/core`.

## Testing an engine

- Tests sit next to the code (`*.test.ts`) and run with Vitest: `pnpm --filter @<slug>/engine test`, and `typecheck` for the types.
- Flip 7's tests are the model: each rule on its own; whole games to the end over many seeds and table sizes, with invariants checked after every move; views checked for hidden information; a state given back with its keys in another order; junk actions refused; absent players played for.
- The patterns are in [State and determinism](03-state-and-determinism.md) and [Turns and absent players](04-turns-and-absent-players.md#testing-turns).
