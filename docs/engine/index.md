# Engine

The engine of a game is its rules as pure TypeScript, with no UI and no I/O, in the package `@<slug>/engine`. What it agrees on with the web app is `GameDefinition` of `@pbgo/engine-kit`.

These pages are what to read before writing or reviewing an engine.

## The rules of an engine

1. [Pure and tested](01-how-a-game-runs.md#what-an-engine-never-does): functions of a state, with no I/O, no clock and no UI, and a Vitest test for every rule.
2. [Lean state](03-state-and-determinism.md#lean-state): ids and numbers only, no display data, no derived value, no log.
3. [Deterministic from a seed](03-state-and-determinism.md#determinism): everything random comes from the game's seed, never from `Math.random` or `Date.now`.
4. [Every order comes from an array](03-state-and-determinism.md#every-order-comes-from-an-array): `jsonb` does not keep the order of the keys of an object.
5. [The engine says who the game waits for](04-turns-and-absent-players.md#what-the-game-waits-for): `waitingFor` and `autoPlayFor`.
6. [A player's mistake is an `EngineError`](02-contract.md#errors): any other failure is a bug of the game and throws a plain error.

## Pages

- [How a game runs](01-how-a-game-runs.md): who owns what, the life of an action, how a game starts and how an engine is plugged in.
- [The engine contract](02-contract.md): `GameDefinition` field by field, the types around it, errors.
- [State and determinism](03-state-and-determinism.md): the lean state, the seed, orders, hidden information.
- [Turns and absent players](04-turns-and-absent-players.md): `waitingFor`, `autoPlayFor`, simultaneous steps, the takeover, the limits.
- [The 3D scene](05-scene/index.md): the table, the cards and everything else on a board, one page for each item.

## Where things live

| What | Where | Package |
| --- | --- | --- |
| The contract and its helpers | `packages/engine-kit` | `@pbgo/engine-kit` |
| A game's engine | `games/<slug>/packages/engine` | `@<slug>/engine` |
| The engine a new game starts from, the demo "La Plus Haute" | `template/packages/engine` | `@template/engine` |
| The binding that hands the engine to the app | `games/<slug>/src` | `@pbgo-game/<slug>` |
| The code that runs an engine on the server | `packages/core/server`, `packages/core/routes/api/games` | `@pbgo/core` |
| The tests | `pnpm --filter @<slug>/engine test`, `pnpm --filter @pbgo/engine-kit test`, `pnpm --filter @pbgo/core test` | Vitest |

## What these pages do not cover

- The reference of each module of the kit is `packages/engine-kit/README.md`; starting a new game is `template/docs/GAME_GUIDE.md`.
- What the shared UI draws around the board (announcements, ticker, players strip, game over) is in [In-game UI](../design/04-in-game.md); worked examples are the engines in `games/flip-7/packages/engine` and `games/courtisans/packages/engine`.

## How these pages are made

They are the markdown files of `docs/engine/`, shown at `/docs/engine`. A number in front of a file name sets its place in the menu and is not part of its address, and a new file needs a restart of `pnpm dev` to get its page.

A page says a rule in a line and names the constant or the function that holds it; it never writes the value itself (a limit, a delay, a count).
