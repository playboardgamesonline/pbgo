# The files of a game

A game is one folder, `games/<slug>/`, with its packages in it: the binding, the engine and the Studio. `pnpm new-game` copies it from `template/`, which is the reference for every file below.

## The tree

```text
games/<slug>/
├── CLAUDE.md                  notes for the agents: glossary, rules as coded
├── README.md                  the commands of the game
├── package.json               @pbgo-game/<slug>
├── tsconfig.json, .gitignore
├── vitest.config.ts           which tests the binding runs
├── assets/                    sources (PDF, PSD, HD visuals), ignored by git
├── src/                       the binding
│   ├── index.ts               GAME, site constants, skin and in-game theme, for server and client
│   ├── server.ts              server only: index.ts and the loaders
│   ├── ui.tsx                 client: Logo and Game
│   ├── runtime.tsx            client: styles and BindingProvider
│   ├── styles.css
│   ├── takeover.test.ts       a whole game in which players never come back
│   ├── lib/                   site.ts, skin.ts, ui-theme.ts
│   └── components/
│       ├── logo.tsx
│       ├── game/              game.tsx: the HUD around the board
│       └── board/             the 3D scene: scene.tsx, layout.ts, camera.ts, textures.ts…
├── packages/engine/           @<slug>/engine
│   ├── package.json
│   ├── tsconfig.json
│   └── src/                   the rules; index.ts exports GAME
├── apps/studio/               <slug>-studio
│   ├── package.json, tsconfig.json, .env.example
│   ├── sanity.config.ts, sanity.cli.ts
│   ├── schemaTypes/           game.ts, then the game's own document types
│   └── studio-forms.test.ts
└── content/                   the Sanity content as code, once the game has a seed
```

## The packages

| Package | Name | Folder | Holds |
| --- | --- | --- | --- |
| The binding | `@pbgo-game/<slug>` | `games/<slug>` | What `@pbgo/games` loads: `GAME`, the site constants, the look and the board |
| The engine | `@<slug>/engine` | `games/<slug>/packages/engine` | The rules, pure TypeScript, tested with Vitest |
| The Studio | `<slug>-studio` | `games/<slug>/apps/studio` | The game's Sanity Studio |

The template's are `@pbgo-game/template`, `@template/engine` and `template-studio`. Target a package with `--filter`: `pnpm --filter @<slug>/engine test`.

## Rules

- The workspace finds the packages through the globs of `pnpm-workspace.yaml`: a game adds nothing to it.
- The engine depends on `@pbgo/engine-kit` only, and its `tsconfig.json` extends `@pbgo/tsconfig/library.json`, which has no DOM types ([What an engine never does](../01-the-game/11-the-contract.md#what-an-engine-never-does)).
- The binding depends on its engine, `@pbgo/core`, `@pbgo/ui` and, for a board, `@pbgo/table`. Every external dependency comes from the pnpm catalog (`pnpm check:catalog`).
- A game's pictures, sounds and texts live in its Sanity project, never in the repo. `assets/` holds sources only and is ignored by git; the seed's art folder is outside the repo (`docs/content-pipeline.md`).
- The `exports` of the binding's `package.json` are the entries of its contract: [The binding](05-wiring-it-in.md#the-binding).

## What `pnpm new-game` does

- Copies `template/` without `node_modules`, `.next`, `dist`, `.vercel`, `.sanity`, `.sanity-project-id`, the `.env` files, `*.tsbuildinfo`, `assets` and `docs`, then makes an empty `assets/`.
- Renames `@pbgo-game/template`, `@template/engine` and `template-studio` in the sources, JSON, Markdown and CSS of the copy.
- Writes `SLUG` and `NAME` in `src/lib/site.ts`, the title in the Studio's `sanity.config.ts`, the `description` of `package.json`, a new head of `CLAUDE.md` (the sections after it are the template's, to rewrite) and a `README.md`.
- Registers the game and adds its write token variable to `apps/web/.env.example` ([The registry](05-wiring-it-in.md#the-registry)), then runs `pnpm install`.
- Leaves the demo as it is: the engine in the `src/demo` folder of the engine package, the board, the skin and the in-game theme, and the Studio's `game` document. Those are what the game replaces.
