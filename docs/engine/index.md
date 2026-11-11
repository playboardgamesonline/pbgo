---
icon: cpu
description: How the rules of a board game become code, and how that code plugs into the site.
---

# Engine

To try every component at once, open the [playground](/docs/playground): one table with all of them on it, to move, tune and play with.

The engine of a game is its rules as pure TypeScript, with no UI and no I/O, in the package `@<slug>/engine`. What it agrees on with the web app is `GameDefinition` of `@pbgo/engine-kit`. These pages describe what a game is made of, piece by piece, then how to put one together.

## The map

- [The game](01-the-game/index.md): what every game has: players, turns and phases, actions, victory, parameters, data, state and views, and the contract.
- [Components](02-components/index.md): the building blocks a game is made of: cards, piles, zones, dice, a text field, pieces, counters, tracks, boards, cups, bags, dragging, timers, drawing, maps, seats, a score. Each with its side in the engine and its side on the board, and the list of the ones still to build.
- [Not built yet](03-not-built-yet.md): what games ask for and no tool provides: the art of a map, a filter of what players write or draw, a bar of progress.
- [Build a game](04-build-a-game/index.md): from the rules to a playable game, in order.
- [Examples](05-examples/index.md): the engines of Flip 7 and Courtisans, file by file.

## The rules of an engine

1. [Pure and tested](01-the-game/11-the-contract.md#what-an-engine-never-does): functions of a state, with no I/O, no clock and no UI, and a Vitest test for every rule.
2. [Lean state](01-the-game/09-state.md#lean-state): ids and numbers only, no display data, no derived value, no log.
3. [Deterministic from a seed](01-the-game/09-state.md#determinism): everything random comes from the game's seed, never from `Math.random` or `Date.now`.
4. [Every order comes from an array](01-the-game/09-state.md#every-order-comes-from-an-array): `jsonb` does not keep the order of the keys of an object.
5. [The engine says who the game waits for](01-the-game/03-turns.md#waitingfor): `waitingFor` and `autoPlayFor`.
6. [A player's mistake is an `EngineError`](01-the-game/05-actions.md#errors): any other failure is a bug of the game and throws a plain error.

## Where things live

| What | Where | Package |
| --- | --- | --- |
| The contract and its helpers | `packages/engine-kit` | `@pbgo/engine-kit` |
| A game's engine | `games/<slug>/packages/engine` | `@<slug>/engine` |
| The engine a new game starts from, the demo "La Plus Haute" | `template/packages/engine` | `@template/engine` |
| The binding that hands the engine to the app | `games/<slug>/src` | `@pbgo-game/<slug>` |
| The tools of the board | `packages/table` | `@pbgo/table` |
| The code that runs an engine on the server | `packages/core/server`, `packages/core/routes/api/games` | `@pbgo/core` |
| The tests | `pnpm --filter @<slug>/engine test`, `pnpm --filter @pbgo/engine-kit test`, `pnpm --filter @pbgo/table test`, `pnpm --filter @pbgo/core test` | Vitest |

## What these pages do not cover

- What the shared UI draws around the board (announcements, ticker, players strip, game over) is in [In-game UI](../design/04-in-game/index.md).
- A game's content in Sanity and its look are the game lane's: the skills `game-new` and `game-sanity-create` (`.claude/skills/README.md`) and `docs/content-pipeline.md`.
- Ranks and achievements are the platform's, the hub and its accounts, not an engine's.

## Writing these pages

A page says a rule in a line and names the constant or the function that holds it; it never writes the value itself (a limit, a delay, a count). A number in front of a file name sets its place in the menu and is not part of its address, and a new file needs a restart of `pnpm dev` to get its page.
