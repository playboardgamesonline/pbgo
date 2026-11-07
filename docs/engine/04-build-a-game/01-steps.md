# From the rules to a playable game

The engineering path of a new game, in the order it is walked. Each step links to the page that explains it; the content steps are the game lane's, with its skills.

1. **Read the rulebook and write the plan** in the game's `CLAUDE.md`: the rules the engine codes, the cases the rulebook leaves open, what each player may see ([Hidden information](../01-the-game/10-views.md#hidden-information)) and the glossary of the game's words with the English names the code gives them.
2. **Create the game** with `pnpm add-game` (the code, the Sanity project and its Studio, the rulebook PDFs and the environment) or `pnpm new-game <slug>` (the code alone). Both register it as not live: [The files of a game](02-files-of-a-game.md), [The registry](05-wiring-it-in.md#the-registry).
3. **Write the engine and its tests** in `games/<slug>/packages/engine/src`, in place of the demo game: [Writing the engine](03-writing-the-engine.md), [Testing the engine](06-testing.md).
4. **Hand the engine to the app**: export `GAME` from the binding and list the engine's error codes: [Wiring the engine into the app](05-wiring-it-in.md).
5. **Draw the board** with the tools of `@pbgo/table`: [Components](../02-components/index.md), [Composing a board](04-composing-a-board.md). Adapt `src/takeover.test.ts` to the new engine.
6. **Fill the content in Sanity**: the fields of the Studio, the seed (`docs/content-pipeline.md`) and the rulebook links are the skills' work (`game-sanity-create`, which `game-new` leads into; `pnpm game-rules` for a rulebook added later).
7. **Go live**: `pnpm go-live <slug>` is the Sanity side only and `pnpm add-game` already ran it; `live` and `indexable` stay false until they are set in `GAMES` ([`live` and `indexable`](05-wiring-it-in.md#live-and-indexable)).

When the engine is done, [Before you hand the engine over](08-checklist.md) lists what to check.

## What the commands create

| Command | What it creates |
| --- | --- |
| `pnpm new-game <slug> [--name "<Game Name>"]` | `games/<slug>` from `template/`, registered in `packages/games`, not live |
| `pnpm go-live <slug>` | The game's Sanity project, its public dataset and CORS, a write token in `apps/web/.env.local`, the deployed Studio and the project id in the registry; it can be run again |
| `pnpm add-game [<slug>] [--name "<Game Name>"]` | `new-game`, `go-live`, the rulebook PDFs in the draft of the game's settings, `setup-env` and a check that the Studio is deployed |

## Rules

- `pnpm add-game` checks first, lists what leaves the machine (a Sanity project, Supabase migrations, Vercel variables) and asks before creating anything; `--dry-run` stops after the list. The real run is hard to undo, so it waits for a yes (skill `game-new`).
- A slug is lowercase words joined by dashes and is not a route of the app: `RESERVED_SLUGS` of `packages/games/src/slug.ts`, kept by `slug.test.ts`.
- Nothing is published from code: the seed writes drafts and the content is published in the Studio.
