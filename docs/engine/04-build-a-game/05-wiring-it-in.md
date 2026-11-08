# Wiring the engine into the app

The engine reaches the app through the binding, the package `@pbgo-game/<slug>`, which the registry of `@pbgo/games` ([The registry](#the-registry)) lists. Core never imports a game: the server receives it as a `GameModule` and the browser reads it from the `BindingProvider`. The contract is `packages/core/lib/binding.ts`.

## The binding

| File | Runs | It exports |
| --- | --- | --- |
| `src/index.ts` | Server and client | `GAME`, the constants of `src/lib/site.ts`, and when the game sets them `DEFAULT_SKIN`, `SETTINGS_DEFAULTS`, `UI_THEME`, `SOUNDS` and `REACTIONS` |
| `src/server.ts` | Server only | Everything of `index.ts`, and when the game has them `loadSetupData`, `loadGameData` and `ROUTES` |
| `src/ui.tsx` | Client | `Logo` and `Game`, the board, loaded on demand and not on the server |
| `src/runtime.tsx` | Client | The default `Runtime`: the game's styles and the `BindingProvider` |

- `exports` in the binding's `package.json` are the entries of the contract: `.` (`GameBinding`), `./ui` (`UiBinding`), `./server` (`ServerBinding`), `./runtime` and `./styles.css`.
- `GAME` is optional in `GameBinding`, and a binding without it is not playable ([How an engine is wired in](#exporting-game)).
- `Game` takes `BoardProps` (`game`, `data`, `onUpdate`, `onLeave`) and is loaded with `dynamic` and no server render, so the screens around the board pull in no three.js ([Lazy loading](04-composing-a-board.md#lazy-loading)).
- The binding draws a logo and the board; the rest of what a table shows is core's ([In-game UI](../../design/04-in-game/index.md)).

From `template/src/runtime.tsx`:

```ts
const BINDING: ClientBinding = { ...shared, Logo, Game }
```

## Exporting `GAME`

- `@<slug>/engine` exports its definition as `GAME` and re-exports the kit (`export * from "@pbgo/engine-kit"`). It is a dependency of the binding: `src/index.ts` re-exports `GAME` from it, and `src/server.ts` re-exports `./index` and adds `loadSetupData`, `loadGameData` and `ROUTES`.
- The registry (`@pbgo/games`) imports `@pbgo-game/<slug>/server` on the first request for the game and gives core a `GameModule` (`packages/core/lib/binding.ts`). Core never imports a game.
- A binding without `GAME` is not playable: its page on the hub says "Coming soon" and its tables and API answer not found. With one, `isPlayable` makes it playable outside production, and in production once it is `live` in the registry.
- An engine that takes `SetupData` needs a `loadSetupData` ([Data for the engine and the board](#data-for-the-engine-and-the-board)).

From `template/src/index.ts`:

```ts
export { GAME } from "@template/engine"
export * from "./lib/site"
```

## Error codes

- `ERROR_CODES` in `src/lib/site.ts` lists the codes of the game's own refusals: what the engine throws that every game does not share. The shared codes ([The shared codes](../01-the-game/05-actions.md#the-shared-codes)) are worded by the platform and stay out of it. From `template/src/lib/site.ts`:

  ```ts
  export const ERROR_CODES = ["INVALID_BID"]
  ```

- Their messages are written in Sanity (Gamemaster › Copy › Errors), never in the code; a listed code with no message there reads `[missing: errorMessages.<CODE>]` ([Errors](../01-the-game/05-actions.md#errors)).
- The codes the platform words are `CORE_ERROR_MESSAGES` (`packages/core/lib/api.ts`). The Copy page lists them too, with the platform's wording as the fallback, so a game can word one its own way.
- `src/error-codes.test.ts` keeps the list and the engine in step ([Keeping the vocabulary honest](../01-the-game/05-actions.md#keeping-the-vocabulary-honest)).

## Data for the engine and the board

- `loadSetupData` gives `GAME.setup` its `data`; `loadGameData` gives the board its `data` prop; `ROUTES` are the game's own routes, at `/api/<slug>/games/<code>/<route>`. Each is optional and server only.
- A new mutating route starts with `await rateLimit(game.slug, request, "<rule>")`.
- The engine never reads Sanity: what its rules need from outside arrives as `SetupData` ([What an engine never does](../01-the-game/11-the-contract.md#what-an-engine-never-does)). Courtisans loads its missions that way ([Setup data](../05-examples/02-an-engine-with-setup-data.md#setup-data)).

## The registry

A game is known to the app by the registry, `packages/games`: it holds the game in `GAMES`, `LOADERS` and `RUNTIMES`, and as a dependency. `pnpm new-game` writes all of them.

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

- `live` makes the game playable in production. Off, a game with a `GAME` is playable outside production only; in production its page on the hub is that of a game to come, and its tables and API answer `GAME_NOT_FOUND` (`docs/routing.md`, [How an engine is wired in](#exporting-game)).
- `indexable` lets search engines in (sitemap, no `noindex`). Only a live game can be indexable, and a live game needs a real Sanity project id: `registry.test.ts`.
- The gamemaster renders the previews of any game that has an engine (`hasEngine`), live or not.
- `pnpm go-live` sets neither: both change in `GAMES` when the game is ready.

## No home page and no lobby

- A game has none of its own (PLT-106, `docs/routing.md`). A table is opened, joined and started on the platform's page of the game, which `/<slug>` shows ([Starting a game](../01-the-game/01-how-a-game-runs.md#starting-a-game)); the table's own address, `/<slug>/game/<code>`, shows the board once the table is started.
- A binding exports no home and no lobby component, and an engine option reaches a table only when an expansion or a helper of the game carries its key ([Expansions and helpers](../01-the-game/07-parameters.md#expansions-and-helpers)).
- To see it: `pnpm dev`, then `http://localhost:3100/<slug>`.
