---
name: game-sanity-create
description: "[GAME agent] Build or reshape a game's Sanity content model. Asks the owner which categories of elements the game has (cards, colors, tiles, boards…), applies the Studio-form rules and the don'ts, writes the schemas, guards and seed, then redeploys the Studio. Use when a game gets its Sanity content or when a Studio form is added or changed."
---

# Create a game's Sanity content

The owner fills these forms in the Studio, so every game's forms are short and in the same order. The rules below are the only copy: other docs point here, and the tests of step 5 keep them true. The game is the slug given with the skill; ask if there is none.

Courtisans is live and predates the card rules. GAM-23 brought its Studio to them where it was cheap (no `Rule` field on a role, the mission's engine data titled `Condition`, no dead field in `game`); leave the rest of its forms alone unless the owner says go.

## 1. Ask first, write nothing

Read the rulebook (the PDF linked in the game's `settings`, or the file the owner gives), then ask the owner **one batch** of questions, each with a recommended default so that "ok" is enough. Ask in the language the owner writes in.

1. **Kinds.** Which kinds of cards or pieces does the game have (number cards, action cards, tiles, tokens…)? Default: the kinds the rulebook names. Each kind is one list in the Studio.
2. **Categories.** Which categories do the pieces belong to (colors, families, roles, kinds of action)? Default: only the ones players see on the table. A category is a document of its own, listed first.
3. **Identity.** What tells two pieces of a kind apart: a value and a category (a red 3), or a word (a kind of action)? Default: what the engine already calls them.
4. **Copies.** Which kinds come in several copies? They get a `quantity`.
5. **Pictures that are not on a piece.** Mat, card backs, tokens, box… They go in the `game` document, one tab per family of pictures. Default tabs: Board, Card backs.
6. **Texts and sounds.** Anything players read or hear that is not on a piece? It goes in the shared `texts` and `audio` documents, which every Studio has: add keys, not new types.

Then give the owner the plan as a table (one row per list: fields in order, translated or not, the tab of each `game` picture) and wait for their ok. No schema before it.

## 2. The rules

1. **One list per kind.** One document type is one list of the Studio (`collections`), never a `kind` field. A game whose cards are the faces of one deck has one `card` list, next to the list of its colors.
2. **No `Effect` or `Rule` field** on a card. What a card does is the engine's; the rules reach players as the publisher's PDF links in `settings` (Mechanics). No `rules` document.
3. **No `description`** (the grey sub-label under a field) anywhere in a Studio schema, the shared singletons and `game` included. The `title` says it; a format hint goes in the validation message (`.error("One letter")`). The subtitle of the list preview stays (`× 3`).
4. **Order of the fields.** Identity first (the game key, or the value and the category), then the rest, the quantity second-to-last, the visual (an image) last.
5. **Translations belong to the categories, not to the pieces.** A category or a kind named by a word (a family, a color, a role, a kind of action) has a multilingual `name` (`localeString`). A piece named by a figure or a value (a 7, a +2) has no `name` at all. Every document the engine picks has an English `key` ("Game key", a dropdown of the keys the engine knows): the engine, the seed and the board read the key, the name is only shown.
6. **The `game` document is in tabs** (Sanity `groups`): exactly one tab open by default, every field in a tab.

## 3. Don'ts

- No translation that is not shown: not for a figure, not for a card named by its value, not for a technical field.
- No `reference` between seeded documents: a reference to a document that only exists as a draft does not survive publishing, in any order. Pick from a dropdown of English keys shared by the schema and the seed (`schemaTypes/constants.ts`), as Hanabi's card picks its color.
- No text, translation, image or sound of the game in code or in `apps/web/public/<slug>/` as a fallback: a game's content lives in Sanity only (the owner's ruling), so a missing value shows instead of being hidden.
- Nothing invented: what the rulebook or the owner does not give stays empty and is listed in the report. A translation the agent wrote itself is flagged, for the owner to read.
- Nothing published from code (the seed writes drafts, the owner publishes in the Studio) and no token printed, or written anywhere but `apps/web/.env.local`.

## 4. Build

In `games/<slug>/apps/studio/` (models: `games/hanabi/apps/studio` for the lists, `template/apps/studio/schemaTypes/game.ts` for the tabs):

- `schemaTypes/constants.ts`: the lists the Studio and the seed share (keys, values, titles).
- One file per document type, `game.ts` with its tabs, and `index.ts` exporting `gameTypes`.
- `sanity.config.ts`: `createStudioConfig({ title, projectId, dataset, gameTypes, collections })`. `collections` is the sidebar after the shared singletons: categories first, then the pieces. A game type with the same name as a shared one replaces it (`createTexts(extra)` gives a `texts` with the game's own labels).
- `pnpm --filter <slug>-studio typegen` after every schema change.

## 5. Guards

- `studio-forms.test.ts` next to `sanity.config.ts` (`pnpm new-game` copies it): `formProblems(studioTypes(studio))` of `@pbgo/content-kit/form-rules` finds a `description` anywhere and a `game` document that is not in tabs.
- The card-like types get a "forms of the cards" block in the game's `content/data/schema.test.ts`: no `effect` or `rule` field, the visual last with the quantity right before it, an English `key` whenever there is a `name`. Model: `CARD_FORMS` in Hanabi's.
- Run `pnpm --filter <slug>-studio test` and `pnpm --filter @pbgo-game/<slug> test`.

## 6. Seed the drafts

`docs/content-pipeline.md` ("Starting the pipeline for another game") has the package scripts, `content/config.ts`, `content/seed.ts`, `content/data/` and the art manifest. Then `pnpm --filter @pbgo-game/<slug> content:seed --dry-run`, show the owner what it would write, and `--apply` only on their go. Drafts only, idempotent, never overwrites what was edited in the Studio. The art folder is outside the repo and goes in with an absolute `--art-dir`.

## 7. Deploy and hand over

`pnpm --filter <slug>-studio exec sanity deploy --yes`, so the hosted Studio (`https://<slug>.sanity.studio`) shows the change; a change to `@pbgo/studio-kit` means every Studio. Locally: `pnpm dev:studio <slug>`.

Tell the owner which lists to open, how many drafts each holds, what stays empty (pictures, translations) and that they publish. The gamemaster (`/gamemaster/<slug>`) edits the shared singletons only (`settings`, `interface`, `audio`, `texts`); the cards and the `game` pictures are edited in the Studio.
