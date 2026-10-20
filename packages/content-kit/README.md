# @pbgo/content-kit

The seed pipeline of a game's Sanity content, shared by every game. A game describes its documents and its images in TypeScript (`games/<slug>/content`); the kit reads the dataset, plans, and writes the documents as **drafts**: idempotent, never overwriting what was edited in the Studio, never publishing. No UI, no engine. The package is consumed as source (`exports` point at `src/*.ts`) and run directly by Node (type stripping, no build). How to run it and what the summary means is in [`docs/content-pipeline.md`](../../docs/content-pipeline.md); this file is for whoever writes a game's content or changes the kit.

```ts
// games/<slug>/content/seed.ts: the whole command of a game
import { runSeedCli } from "@pbgo/content-kit/seed"
import { DATASET, ENV_FILE, PROJECT_ID, SLUG } from "./config.ts"
import { ART_SLOTS } from "./data/art-manifest.ts"
import { buildSeedDocs } from "./data/index.ts"

await runSeedCli({ slug: SLUG, projectId: PROJECT_ID, dataset: DATASET, envFile: ENV_FILE, docs: buildSeedDocs, slots: ART_SLOTS })
```

- [What a game provides](#what-a-game-provides) · [Conventions](#conventions)
- [Reference](#reference): [The data side](#the-data-side) · [The runner](#the-runner) · [The test helpers](#the-test-helpers)
- [Adding a game](#adding-a-game) · [Tests](#tests)

## What a game provides

| File in `games/<slug>/content/` | Holds |
| --- | --- |
| `config.ts` | `SLUG`, `PROJECT_ID` (the game's Sanity project), `DATASET` (fixed in code), `ENV_FILE` (`apps/web/.env.local`) |
| `seed.ts` | The command: `runSeedCli(config)` |
| `data/index.ts` | `buildSeedDocs(): SeedDoc[]`, every document of the game |
| `data/art-manifest.ts` | `ART_SLOTS: ArtSlot[]`, every image the content needs and where it goes |
| `data/*.test.ts`, `seed.test.ts` | The game's data, against the Studio's own types and through the runner |
| `tsconfig.json` | Typechecks `content/` on its own (`tsc -p content`) |
| `parity/` (optional) | Tests of the seed against the game's engine, read by Vitest only, with their own `tsconfig.json` (`tsc -p content/parity`). Exploding Kittens |

Everything else (the options, the token, the plan, the art, the report) is the kit's. A game never talks to Sanity itself.

## Conventions

- **Drafts only.** The one function that writes (`writeDrafts` of `store.ts`) refuses any id that is not `drafts.<id>`. A seed id is a plain document id (`assertSeedId`): a dot would make it a draft, a release version or a private path.
- **`store.ts` is the only file that talks to the API.** Everything else works against the `SeedStore` interface (`types.ts`), which `MemoryStore` implements for the tests with the same rules (drafts only, `createIfNotExists`, `ifRevisionID`).
- **Four entry points**, so that a data file does not load what it does not need:
  - `.` (`index.ts`): the data side. No Sanity client, no `sharp`
  - `./seed` (`seed.ts`): the runner side, for `content/seed.ts` and the tests of the command
  - `./testing` (`testing.ts`): for the game's content tests
  - `./form-rules` (`form-rules.ts`): the rules of the Studio forms, for a Studio's own test. Pure, no Sanity client, no `sharp`, nothing else of the kit
- **Run by Node, as source.** Relative imports carry their `.ts` extension, type-only imports are `import type` (or `export type … from`, which is erased: `index.ts` re-exports `ArtSlot` without loading `sharp`), and only erasable syntax is used (no `enum`, no parameter properties). The tsconfig of the kit and the one of each game's `content/` set the same three flags (`allowImportingTsExtensions`, `verbatimModuleSyntax`, `erasableSyntaxOnly`), because TypeScript compiles the kit's sources under the options of the project that imports them. A Studio that imports `./form-rules` for its test only needs `allowImportingTsExtensions` (its tsconfig).
- **The kit declares its own dependencies** (`@sanity/client`, `sharp`, `@pbgo/core`, `@pbgo/studio-kit`). Node refuses to strip types under `node_modules`; pnpm's workspace links resolve to their real path, outside it, and a bare import is resolved from the importing file's real path, so the kit's own imports must resolve from the kit.
- **Two imports of other packages are deliberate**: `@pbgo/core/sanity/env.ts` (the API version and the name of the write token, one definition for the web app and the seed) and `@pbgo/studio-kit/constants` (the site languages). Both are data only. Core never imports a game, and the kit never imports a game either: the game hands it everything.
- **Games stay out of each other's way.** A game's `content/` typechecks without the Studio graph or the engine: the tests that need the Studio configuration load it by a computed path.

## Reference

### The data side

`import … from "@pbgo/content-kit"`

- **`localeString(values)` / `localeText(values)`**: a `localeString` / `localeText` value of the shared Studio schema. `values` is a `Localized` (`Record<LanguageId, string>`): adding a language to `LANGUAGES` makes every call fail to typecheck. At run time a missing or blank language throws, and a `localeString` that spans several lines does. `LANGUAGE_IDS` lists the languages.
- **`SeedDoc`**: `{ _id, _type, … }`. `_id` is the published id; the seed only ever writes `drafts.<_id>`.
- **`ArtSlot`**: one image the content needs.
  - `name`, `aliases?`: the file name (without extension) that fills the slot. Case does not matter, and spaces and underscores count as hyphens
  - `label`: what the report calls it
  - `ratio?`: `[width, height]`; a file that is off by more than 3 % is placed with a warning
  - `maxSize`: the longest side kept, in pixels (never enlarged)
  - `docId`: the published id of the document that holds the image; it has to be in the seed
  - `place(doc, image)`: puts the image where it belongs in that document
- **`setField(field)`**: a `place` that sets a field of the document.
- **`setItemField(list, key, field)`**: a `place` that sets a field of one item of an array, found by its `_key` (it throws when the item is not there).
- **`assertSeedId(id)`**, **`ImageValue`**.

### The runner

`import … from "@pbgo/content-kit/seed"`

- **`runSeedCli(config, argv?)`**: the command of a game. Reads the options (a wrong one stops here, before the token is read), the token, builds the content, runs it and prints the report. An error prints its message only, the token replaced by `[token]`, and sets a failure exit code.
  - `config`: `{ slug, projectId, dataset, envFile, docs, slots }`. `docs` is a function, called after the options and the token are checked, so `--help` and a wrong option never build the data. `dataset` is fixed by the game on purpose: an exported `NEXT_PUBLIC_SANITY_DATASET` must not redirect the writes
- **`run({ store, docs, slots, options })`**: one run, for the tests and for anything that is not the command. `options` is `{ apply, overwrite, only, artDir? }`. In order:
  1. refuses `overwrite` without `only`, and a seed with a bad id, a duplicate id, a missing `_type`, or an art slot whose document is not in the seed
  2. keeps the documents `only` selects (ids or types; a name that matches nothing is an error)
  3. with `artDir`, scans the folder, normalises the images and looks them up in the dataset by content
  4. plans (read only), and lists the documents of the seed's types that the seed does not know (`orphans`)
  5. dry run: stops here. `apply`: uploads the missing images, writes every draft in one transaction, then plans again and throws if anything is left to do
- **`parseCli(argv)`**, **`HELP`**, **`UsageError`**, **`readToken({ slug, envFile })`** (`SANITY_API_WRITE_TOKEN_<SLUG>` from the environment, else from the env file; the value is never printed), **`formatReport(result, { projectId, dataset, verbose })`**, **`connect({ projectId, dataset, apiVersion, token })`** (a `SeedStore` on a real dataset).

### The test helpers

`import … from "@pbgo/content-kit/testing"`

- **`MemoryStore`**: an in-memory dataset. `docs` (a `Map`), `writes` (each transaction), `uploads`, and the Studio's gestures: `edit(id, fn)` changes a document, `publish(id)` turns a draft into a published document.
- **`documentProblems(doc, types)`**, **`problemsOf(value, def, path, types)`**, **`constraintsOf(validation)`**, **`emptyFields(…)`**, **`imageFields(typeName, types)`**, **`imageFieldOf(typeName, path)`**: the emulator of the Studio's validation. It checks a seed document against the types of the game's own Studio (field names, kinds, option lists, `required`, `min`, `max`…), and lists the fields a form shows and the seed forgot. It does not follow `reference` fields: a type that points at another uses a plain key.
- **`imageOf(color, size?, format?)`**, **`imageValue(name)`**, **`imagesOf(value)`**, **`TempFolders`** (temporary art folders, removed by `cleanUp()` from `afterEach`), **`Doc`** (a seed document read loosely), **`Size`**.

### The rules of the Studio forms

`import … from "@pbgo/content-kit/form-rules"`

- **`formProblems(types)`**: what breaks the Studio-form rules of the skill `game-sanity-create` in a schema, as a list of sentences (empty when the forms are right): a `description` on any type, field or array member (the grey sub-label, shared singletons included), and a `game` document that is not split into tabs (no `groups`, not exactly one default tab, a field in no tab or in a tab the document does not declare).
- **`studioTypes(config)`**: the types a Studio registers, by name, from the default export of its `sanity.config.ts`.

A Studio keeps them in a test of its own, `studio-forms.test.ts` (the template's is copied by `pnpm new-game`):

```ts
import { formProblems, studioTypes } from "@pbgo/content-kit/form-rules"
import { expect, it } from "vitest"
import studio from "./sanity.config"

it("follows the rules of the Studio forms", () => {
  expect(formProblems(studioTypes(studio))).toEqual([])
})
```

## Adding a game

1. The game's Studio types, with a `schemaTypes/constants.ts` for the lists the seed shares.
2. `games/<slug>/package.json`: `@pbgo/content-kit` and `@pbgo/studio-kit` (`workspace:*`) and `vitest` (`catalog:`) as dev dependencies, and the scripts `typecheck` (`tsc --noEmit && tsc --noEmit -p content`), `test` (`vitest run`) and `content:seed` (`node --disable-warning=ExperimentalWarning content/seed.ts`).
3. `content/config.ts`, `seed.ts`, `tsconfig.json`, `data/` (the documents, `index.ts`, `art-manifest.ts`) and the game's tests. `games/exploding-kittens` is the smallest model, `games/hanabi` the one with the most documents.

The step-by-step is in [`docs/content-pipeline.md`](../../docs/content-pipeline.md#starting-the-pipeline-for-another-game).

## Tests

```bash
pnpm --filter @pbgo/content-kit test
pnpm --filter @pbgo/content-kit typecheck
```

They need no network. The guarantees (drafts only, idempotent, fill the gaps and keep the edits, one transaction with a revision check, the token never printed) are tested against `MemoryStore`, and each was checked by breaking it on purpose and watching a test fail. The `sharp` tests use small generated images; the art tests use temporary folders that are removed after each test.
