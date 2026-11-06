# Wiring the engine into the app

The engine reaches the app through the binding, the package `@pbgo-game/<slug>`, and the registry of `@pbgo/games`. Core never imports a game: the server receives it as a `GameModule` and the browser reads it from the `BindingProvider`. The contract is `packages/core/lib/binding.ts`.

## The binding

| File | Runs | It exports |
| --- | --- | --- |
| `src/index.ts` | Server and client | `GAME`, the constants of `src/lib/site.ts`, and when the game sets them `DEFAULT_SKIN`, `SETTINGS_DEFAULTS`, `UI_THEME`, `SOUNDS` and `REACTIONS` |
| `src/server.ts` | Server only | Everything of `index.ts`, and when the game has them `loadSetupData`, `loadGameData` and `ROUTES` |
| `src/ui.tsx` | Client | `Logo` and `Game`, the board, loaded on demand and not on the server |
| `src/runtime.tsx` | Client | The default `Runtime`: the game's styles and the `BindingProvider` |

- `exports` in the binding's `package.json` are the entries of the contract: `.` (`GameBinding`), `./ui` (`UiBinding`), `./server` (`ServerBinding`), `./runtime` and `./styles.css`.
- `GAME` is optional in `GameBinding`, and a binding without it is not playable ([How an engine is wired in](../01-how-a-game-runs.md#how-an-engine-is-wired-in)).
- `Game` takes `BoardProps` (`game`, `data`, `onUpdate`, `onLeave`) and is loaded with `dynamic` and no server render, so the screens around the board pull in no three.js ([Lazy loading](../05-scene/23-composing-a-board.md#lazy-loading)).
- The binding draws a logo and the board; the rest of what a table shows is core's ([In-game UI](../../design/04-in-game/index.md)).

From `template/src/runtime.tsx`:

```ts
const BINDING: ClientBinding = { ...shared, Logo, Game }
```

## Exporting `GAME`

- `src/index.ts` re-exports it from the engine package, `@<slug>/engine`, which is a dependency of the binding.
- An engine that takes `SetupData` needs a `loadSetupData` ([Data for the engine and the board](#data-for-the-engine-and-the-board)).

## Error codes

- `ERROR_CODES` in `src/lib/site.ts` lists the codes the engine throws and core does not word. From `template/src/lib/site.ts`:

  ```ts
  export const ERROR_CODES = ["INVALID_PHASE", "INVALID_BID"]
  ```

- Their messages are written in Sanity (Gamemaster › Copy › Errors), never in the code; a listed code with no message there reads `[missing: errorMessages.<CODE>]` ([Errors](../02-contract.md#errors)).
- The codes core words itself are `CORE_ERROR_MESSAGES` (`packages/core/lib/api.ts`).

## Data for the engine and the board

- `loadSetupData` gives `GAME.setup` its `data`; `loadGameData` gives the board its `data` prop; `ROUTES` are the game's own routes, at `/api/<slug>/games/<code>/<route>`. Each is optional and server only.
- A new mutating route starts with `await rateLimit(game.slug, request, "<rule>")`.
- The engine never reads Sanity: what its rules need from outside arrives as `SetupData` ([What an engine never does](../01-how-a-game-runs.md#what-an-engine-never-does)). Courtisans loads its missions that way ([Setup data](../08-examples/02-courtisans.md#setup-data)).

## The registry

`packages/games` holds the game in `GAMES`, `LOADERS` and `RUNTIMES`, and as a dependency. `pnpm new-game` writes all of them.

| Place | File | Holds | `pnpm new-game` writes |
| --- | --- | --- | --- |
| `GAMES` | `packages/games/src/registry.ts` | Pure data: `slug`, `name`, `tagline`, `sanityProjectId`, `live`, `indexable`, and `players` and `duration` when known | An entry with `live: false`, `indexable: false` and a placeholder project id |
| `LOADERS` | `packages/games/src/index.ts` | Slug to `() => import("@pbgo-game/<slug>/server")`, loaded on the first request for the game | The line |
| `RUNTIMES` | `packages/games/src/runtime.tsx` | Slug to `dynamic(() => import("@pbgo-game/<slug>/runtime"))`, mounted by the `[game]` layout | The line |
| Dependency | `packages/games/package.json` | `@pbgo-game/<slug>`, `workspace:*` | The line, keys sorted |

- `LOADERS` and `RUNTIMES` are typed `Record<GameSlug, …>`, so `pnpm typecheck` fails on a game missing from either.
- A page loads only its game's code and the hub none: never import a game package statically from shared code.
- `pnpm go-live` replaces the placeholder project id. `transpilePackages` takes `@pbgo-game/<slug>` and `@<slug>/engine` from `GAMES` (`apps/web/next.config.ts`), so nothing else in the app changes.

From `packages/games/src/registry.ts`, the entry of a game that is not live:

```ts
{
  slug: "flip-7",
  name: "Flip 7",
  // …
  live: false,
  indexable: false,
},
```

## `live` and `indexable`

- `live` makes the game playable in production. Off, a game with a `GAME` is playable outside production only; in production its page on the hub is that of a game to come, and its tables and API answer `GAME_NOT_FOUND` (`docs/routing.md`, [How an engine is wired in](../01-how-a-game-runs.md#how-an-engine-is-wired-in)).
- `indexable` lets search engines in (sitemap, no `noindex`). Only a live game can be indexable, and a live game needs a real Sanity project id: `registry.test.ts`.
- The gamemaster renders the previews of any game that has an engine (`hasEngine`), live or not.
- `pnpm go-live` sets neither: both change in `GAMES` when the game is ready.

## No home page and no lobby

- A game has none of its own (PLT-106, `docs/routing.md`). A table is opened, joined and started on the platform's page of the game, which `/<slug>` shows ([Starting a game](../01-how-a-game-runs.md#starting-a-game)); the table's own address, `/<slug>/game/<code>`, shows the board once the table is started.
- A binding exports no home and no lobby component, and an engine option reaches a table only when an expansion or a helper of the game carries its key ([Options and presets](../01-how-a-game-runs.md#options-and-presets)).
- To see it: `pnpm dev`, then `http://localhost:3100/<slug>`.
