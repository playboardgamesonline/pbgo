# The platform's Sanity project

`playboardgamesonline` (project `mhgqs6fe`, dataset `production`, public): the content of the hub itself, apart from the games' own projects. It holds the **catalog** (every game the hub lists, with the people, publishers and categories it points at), the **editorial** documents (articles, changelog, announcements) and, one day, the **shop**. The hub reads the catalog from it, in place of the Notion Games database, once PLT-90 lands; until then it still reads Notion and this project is filled by a seed. Notion stays the internal tracker (what is being built, in which order). Part of PLT-19.

It is not a game's Sanity project: a game's project holds what is played (cards, board, sounds) and its texts in four languages, this one holds what the hub says about games.

## Where it lives

| What | Where |
| --- | --- |
| The Studio | `platform/apps/studio`, package `platform-studio`, built with `createStandaloneStudioConfig` of `@pbgo/studio-kit`. `pnpm dev:studio platform`; deployed at `pbgo.sanity.studio` (`pnpm --filter @pbgo/platform deploy:studio`) |
| The seed | `platform/content`, package `@pbgo/platform`: `content:seed` (Notion → drafts) and `content:art` (Notion pictures → a folder) |
| The model | `platform/apps/studio/schemaTypes/`, the lists it shares with the seed in `constants.ts` |
| Tests | `pnpm --filter platform-studio test` (the model, the rules, the queries of the Games tab) and `pnpm --filter @pbgo/platform test` (the seed against the Studio's schema, the art step) |

## The model

The Studio's sidebar has three blocks: **Catalog**, **Editorial** and **Shop**. The shop block is empty on purpose: there is no document type for it, no skin, until we have looked at how Discord builds its shop.

### Catalog

| Type | Fields |
| --- | --- |
| `game` | **Identity**: `name`, `slug`, `bggId`, `kind` (game · expansion · reimplementation), `baseGame` (→ game), `order`. **Facts**: `playersMin`, `playersMax` (empty: or more), `duration` (minutes), `minAge`, `complexity` (1 to 5, BoardGameGeek's weight), `releaseDate`, `categories` (→ category). **Credits**: `creators` (a list: one creator with one or several roles per line), `publishers` (→ publisher). **Texts**: `tagline`, `description`, in English. **Rules**: `rulesFr`, `rulesEn`, `rulesEs`, `rulesDe` (links). **Visuals**: `cover`, `logo`, `icon`, `background`, `boxFront` (the box, front). **Related**: `related` (→ game) |
| `creator` | `name`, `photo`, `website`, `bggId`, and a read-only **Games** tab |
| `publisher` | `name`, `website`, `logo`, `bggId`, and a read-only **Games** tab |
| `category` | `name`, `icon`, `color` (#rrggbb), `description` |

### Editorial

| Type | Fields |
| --- | --- |
| `article` | `title`, `slug`, `excerpt`, `body` (rich text), `cover`, `publishedAt`, `author`, `games` |
| `changelogEntry` | `title`, `date`, `kind` (new game · feature · improvement · fix), `body` (rich text), `image`, `games` |
| `announcement` | `title`, `message`, `tone` (info · success · alert), `startsAt`, `endsAt`, `link` (address and label), `dismissible`, `game` |

### What was decided, and why

- **English for now.** Every text is in English; the translation system of Sanity (field-level or document-level) comes later and will need a migration of the fields. The one multilingual thing is the link to the rules, one field per language of the platform (`LANGUAGES` of `@pbgo/studio-kit`). The French, Spanish and German descriptions of the Notion rows are not imported: after PLT-90 the hub shows English until the translations are plugged in.
- **The roles are on the line of the game, not on the person.** A person is a designer of one game, an artist of another, both on a third: `game.creators` holds one line per person with all their roles on that game, and `creator` has no role. The roles are BoardGameGeek's credits, in its words: Designer, Solo designer, Developer, Artist, Graphic designer, Editor, Sculptor, Writer, Insert designer (`CREATOR_ROLES`). Its "Editor" is who edits the text, the rules or the cards, not the publisher, which is a `publisher` apart: that is why the list is `creators` and not `credits`, which would include the publishers. Left out: "Accessory designer" (it credits accessories, not games) and "Honored designs" (awards). A person has one `bggId`, the number in the address of their BoardGameGeek page.
- **The link is stored on the game only.** A creator and a publisher do not list their games: the other side is computed, by the **Games** tab of their form in the Studio (a query on the games, with the roles of a creator on each) and by a reverse query for the hub, `*[_type == "game" && $id in creators[].creator._ref]`. Two stored sides would one day disagree.
- **A document for what is shared.** Creators, publishers and categories are documents of their own, referenced by the games, not names written on each game: a name is written once, a person has a photo and a website, a category an icon and a color.
- **References are strong once published, except `related`.** A strong reference needs the document it points at to be published first, and keeps it from being deleted. The dataset refuses a strong reference to a document that is not published, a draft's included, so the seed writes each reference as the Studio does while the target is a draft: weak (`_weak`) and marked `_strengthenOnPublish`, which makes the Studio turn it strong when the draft is published. That is why the order is: creators, publishers and categories, then the games that have no `baseGame`, then the games that have one. `related` is the exception: two games are related both ways, so strong references would each wait for the other to be published; it is weak for good (`weak: true` in the schema, and `weak` in the mark the seed writes). The editorial documents point at games strongly.
- **No `status` and no `live` flag.** Whether a game is playable and indexable stays in the registry (`packages/games/src/registry.ts`, PLT-83): one switch, in the code that serves the game. `order` is a number that lists the games, lowest first; the seed numbers them 10, 20, 30… in the order the hub lists them now, so that one can be slipped between two.
- **`cover` and `boxFront` are two pictures.** The cover is the game's picture on the hub, the box front the front of its box (the games' own Studios call it `boxFront` too). Notion has neither.
- **A rich body, later.** `body` is a list of blocks that holds text only for now; pictures and the like are more kinds of block in that list, added with no migration.

## The seed (`platform/content`)

It imports today's Notion Games rows, as the hub reads them (`@pbgo/catalog/notion`, `readNotionGames`, then `buildCatalog` for the order), so it sees the very rows the hub sees. Like the games' seeds (`docs/content-pipeline.md`, which holds the guarantees) it writes **drafts only**, in one transaction, fills what is empty and keeps what was edited in the Studio, reads the dataset back to check that running it again does nothing, and never publishes: the owner publishes in the Studio.

| Document | Made from |
| --- | --- |
| `game-<slug>` | each game of the catalog: the name, the slug, the figures, `bggId`, `releaseDate`, the categories, the publishers, the credits, the English description, the links to the rules, `related` (both ways: the row's own links first, then the games that name it). A standalone expansion (Flip 7 Vengeance) is a `reimplementation` of its base game; every other game is a `game` |
| `creator-<name>` | each person in a `Designers` or `Artists` cell: the people of `Designers` get the role Designer, those of `Artists` the role Artist, and a person in both cells of one game has both roles on one line. The other seven roles have no source in Notion: they are filled in the Studio |
| `publisher-<name>` | each publisher a game lists, with its website |
| `category-<name>` | each tag a game lists |

- The id of a person, a publisher or a category is made of its name, accents and capitals gone (`creator-emilie-menard`); two names that make one id stop the seed, to be settled in Notion. The expansions of the Notion rows (25 today) are not imported, and neither are `Relation kind`, the fonts, the Creators' `Photo` and `Website` (empty today), the Editors' `Country`, the descriptions in the other languages, and a game's cover and box, which Notion has not.
- Only the documents of these four types are the seed's: a game made by hand in the Studio is reported as "in the dataset but not in the seed" and left alone, and the editorial documents are written in the Studio.
- **Token and run**, from the repo root: `SANITY_API_WRITE_TOKEN_PLATFORM` (an Editor token of the project, in `apps/web/.env.local` only: it is not pushed to Vercel, since the hub will read the public dataset with no token) and `NOTION_API_KEY` (the one of `docs/catalog.md`). `pnpm --filter @pbgo/platform content:seed --dry-run` says what would change, `--apply` writes the drafts. The options are the ones of the pipeline (`--only`, `--overwrite`, `--verbose`).

### The pictures: a second step

Notion hosts the pictures (the games' logo, icon and background, a publisher's logo) behind links that expire after about an hour, so they are copied in two commands, not one:

1. `pnpm --filter @pbgo/platform content:art --out <folder>` reads the links fresh and downloads the pictures the rows hold into a folder **outside the repo** (say `~/Companies/PBGO/assets/platform`), named after the slot each fills: `game-<slug>-logo.png`, `game-<slug>-icon`, `game-<slug>-background`, `publisher-<name>-logo`. A dry run by default, `--apply` downloads; a file that is already there is left as it is. A picture of a kind the art step does not read (a GIF, an icon file) is reported: convert it and put it in the folder by hand. A cell that holds something that is not a picture (a video, say) is reported as "not a picture" and left out.
2. `pnpm --filter @pbgo/platform content:seed --art-dir <folder>` normalizes the pictures (WebP, an SVG is kept), uploads those the dataset does not hold and places them; `--apply` to write. A picture never carries a credit: the sources are unknown.

## Publishing

The seed never publishes. In the Studio, publish the creators, publishers and categories first, then the games (see the references above): the Studio's Publish makes the references strong. A publication by the API leaves them weak, which the hub reads just as well but which keeps nothing from being deleted. Once published, a document is public (a public dataset: its published documents can be read with no token).

## What reads it

Nothing yet: the hub reads Notion until PLT-90. That one will read the published documents with the public API and these queries: the games in `order`, `slug.current`, the credits grouped by role, the publishers and categories by dereference (`categories[]->name`). The shapes of the hub's `NotionGame` map field by field: `players` is `playersMin` and `playersMax`, `age` is `minAge`, `authors` and `illustrators` are the creators with the role designer and artist.
