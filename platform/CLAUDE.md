# Platform · the platform's own Sanity project

`playboardgamesonline` (project `mhgqs6fe`, dataset `production`, public): what the hub says about games, apart from each game's own project. Package `@pbgo/platform`. The detail (the model and why, the seed, the pictures, what to publish first) is `docs/platform-sanity.md`; this file is the map.

## Structure
- `apps/studio` — `platform-studio`, built with `createStandaloneStudioConfig` of `@pbgo/studio-kit` (none of a game's shared singletons). `pnpm dev:studio platform`; deployed at `pbgo.sanity.studio`
  - `schemaTypes/` — `game`, `creator`, `publisher`, `category` (the catalog), `article`, `changelogEntry`, `announcement` (the editorial), the `gameCreator` line of a game's credits, the rules of validation they share (`rules.ts`) and the lists the seed shares (`constants.ts`: no import from Sanity there)
  - `structure.ts` — the sidebar, three blocks: Catalog, Editorial and Shop (empty on purpose: no document type for it yet), and the "Games" tab of a creator and of a publisher; `views/` holds that tab (`games-of.ts` the query, `games-of-view.tsx` the part that needs the Studio)
  - `studio-forms.test.ts` (the rules of the forms of the skill `game-sanity-create`), `schemaTypes/model.test.ts` (the model as agreed: change it only on purpose), `schemaTypes/rules.test.ts`, `views/games-of.test.ts` (the queries, run by a GROQ engine)
- `content/` — the seed, run by the shared `@pbgo/content-kit`
  - `seed.ts` (`runSeedCli` with a `content` that reads Notion), `fetch-art.ts` (the Notion pictures into a folder outside the repo), `notion.ts` (the games in the order the hub used to list them, the Editors rows) with `notion/` (the Notion reader and `hubOrder`: the hub reads this project now, PLT-90, and Notion is only this seed's source), `art-files.ts` (what to download and how), `config.ts` (project, dataset, token name)
  - `data/` — the documents: `games.ts`, `taxonomy.ts` (creators, publishers, categories), `art.ts` (the slots), `ids.ts`, `index.ts`; the fixtures and tests (`data.test.ts` the documents, `schema.test.ts` against the Studio's own types, `run.test.ts` through the runner and an in-memory dataset)

## Rules
- English everywhere, the texts of the Studio included: the translation system of Sanity comes later. The one multilingual thing is the link to the rules, a field per language
- The seed writes drafts only and publishes nothing, and writes its references weak and marked to be made strong on publication (the dataset refuses a strong one to a document that is not published, a draft's included). Creators, publishers and categories are published before the games; `related` is weak for good. Never run `content:seed --apply` or deploy the Studio without the owner's go
- The Studio forms follow the skill `game-sanity-create`: no description under a field, the title says it; the `game` in tabs
- A document type added to the seed gets its tests in `data/` and a line in `docs/platform-sanity.md`; the model's shape is pinned by `schemaTypes/model.test.ts`

## Commands (from the root)
- `pnpm --filter @pbgo/platform content:seed [--dry-run | --apply] [--art-dir <folder>]` — `--help` for the options
- `pnpm --filter @pbgo/platform content:art --out <folder> [--apply]` — the Notion pictures, into a folder outside the repo
- `pnpm --filter @pbgo/platform test` · `typecheck`, `pnpm --filter platform-studio test` · `typecheck`
- `pnpm --filter @pbgo/platform deploy:studio` — only with the owner's go

## Commits
Gitmoji format: `<emoji>(platform): <description>`
