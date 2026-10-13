# Content pipeline

How a game's Sanity content (cards, rules in four languages, credits, art) is created from code instead of typed by hand. The generic part is one shared package, `@pbgo/content-kit` (`packages/content-kit`, see its README); a game keeps only its data and its config in `games/<slug>/content`. First built for Hanabi (GAM-11), shared with Exploding Kittens (GAM-12); the next game starts from the same two pieces.

The content is described in versioned TypeScript. A seed script writes it to the game's Sanity project as **drafts**. Running it again is safe: it never replaces what someone edited in the Studio, and nothing is published until a human publishes it there.

## What it does, and what it does not

It does:
- create the game's documents (cards or card types, editions, the game's tables, rules, credits, rulebook links) as drafts
- fill the gaps of drafts that already exist, and report everything else it finds different
- normalise images dropped in a folder (WebP) and place them in the right documents
- print a summary first (`--dry-run`), then do the same thing for real (`--apply`)

It does not:
- publish: that stays a Studio action
- delete anything: documents found in the dataset that the seed does not know are only listed
- overwrite a value edited in the Studio, unless asked with `--overwrite --only <what>`
- download or generate art, or change the original files
- touch the engine, the UI, the registry or the deployed Studio

## The process, per game

| # | Step | Who | What |
| --- | --- | --- | --- |
| 1 | Inventory | content agent | Open every raw file, say what it is and what is missing. Raw files stay outside the repo and are never modified |
| 2 | Describe | content agent | Write the documents in `content/data/` and the image slots in `content/data/art-manifest.ts`. Rules text is paraphrased from the game's spec, never copied from a rulebook |
| 3 | Dry run | content agent | `content:seed --dry-run` reads the dataset and prints the summary. Nothing is written |
| 4 | Go | owner | The owner reads the summary and says yes |
| 5 | Apply | content agent | `content:seed --apply` writes the drafts, then plans again and checks that nothing is left to do |
| 6 | Publish | owner | Review the drafts in the Studio and publish them |
| 7 | Art | whoever has it | Put the files in the game's art folder (outside the repo), dry run with `--art-dir`, apply (see Art) |

Deploy the game's Studio before asking anyone to review in the hosted Studio: a new document type only shows there once the schema is deployed (`pnpm --filter @pbgo-game/<slug> deploy:studio`). The local Studio (`pnpm dev:studio <slug>`) shows it at once.

## Folder

The generic code, the same for every game:

```
packages/content-kit/src/        @pbgo/content-kit: HOW to write it
  index.ts                       entry ".": what a game's data files import (localeString, localeText, setField, setItemField, assertSeedId, the types)
  seed.ts                        entry "./seed": what content/seed.ts and its tests import (runSeedCli, run, parseCli, HELP…)
  testing.ts                     entry "./testing": MemoryStore, the schema checker, the image and folder fixtures
  seed-cli.ts                    runSeedCli(config): the command, from the options to the report
  cli.ts env.ts report.ts        the options, the token (never printed), the summary
  run.ts                         one run: plan, write, plan again
  plan.ts merge.ts               what to create, what to fill, what to leave alone
  art.ts                         find, normalise, upload and place images
  store.ts                       the Sanity adapter (the only file that talks to the API)
  memory-store.ts                an in-memory dataset with the same rules, for the tests
  schema-check.ts                checks a document against the Studio's own types, for the tests
  locale.ts place.ts types.ts    localized fields, the two ways a slot places an image, the shared types
  test-fixtures.ts               test images and temporary art folders
  *.test.ts
```

What a game provides:

```
games/<slug>/content/
  seed.ts              the command: runSeedCli({ slug, projectId, dataset, envFile, docs, slots })
  config.ts            slug, Sanity project id, dataset (fixed), env file
  tsconfig.json        typechecks content/ on its own (tsc -p content)
  seed.test.ts         the paths of the command that end before the token is read
  data/                WHAT to write, specific to the game
    index.ts           buildSeedDocs(): every document of the game
    suits.ts cards.ts bonus-tiles.ts game.ts rules.ts settings.ts          Hanabi
    card-types.ts edition.ts game.ts rules.ts settings.ts                  Exploding Kittens
    art-manifest.ts    every image the content needs, and where it goes
    *.test.ts          the documents, against the Studio's types, through the runner
```

The Studio types the documents follow are in `games/<slug>/apps/studio/schemaTypes/`. The lists shared by the Studio and the seed (Hanabi: suit keys, ranks, rating keys, bonus tile numbers; Exploding Kittens: card type keys, kinds, edition keys) live in `schemaTypes/constants.ts`; the seed imports that file with its `.ts` extension, the Studio without.

## Running it

From the repository root (or any folder, with `pnpm -C games/<slug>`):

```bash
pnpm --filter @pbgo-game/<slug> content:seed --dry-run
pnpm --filter @pbgo-game/<slug> content:seed --apply
```

| Option | Effect |
| --- | --- |
| `--dry-run` | Read the dataset and print what would happen. Writes nothing. This is the default |
| `--apply` | Write the drafts, and upload the art given with `--art-dir` |
| `--art-dir <dir>` | Normalise the images of this folder and place them. Without it the art is left alone. Give an absolute path: a relative one is read from the folder the command runs in (`games/<slug>` through `pnpm --filter`) |
| `--only <a,b>` | Limit the run to documents, by id or by type (repeatable): `--only rules,settings`, `--only card-red-3` (a Hanabi card), `--only card-type-defuse` (an Exploding Kittens card type), `--only cardType` (all of them). A name that matches nothing stops the run |
| `--overwrite` | Replace the values edited in the Studio with the seed's. Needs `--only` |
| `--verbose`, `-v` | List every document, not only the ones that change |
| `--help`, `-h` | The usage |

The write token is `SANITY_API_WRITE_TOKEN_<SLUG>` (slug upper-cased, `-` becomes `_`: `SANITY_API_WRITE_TOKEN_EXPLODING_KITTENS`), read from the environment, else from `apps/web/.env.local`. It is needed for a dry run too. It is never printed, not even in an error. A mistake in the options stops the command before the token is read.

### Reading the summary

The first lines say which mode ran: `DRY RUN: nothing was written or uploaded`, or `APPLIED: n draft(s) written. Nothing is published`. Then the documents are counted by outcome and by type (`card  35  35 new`), followed by:

| Line | Meaning |
| --- | --- |
| `new draft` | Neither a draft nor a published document exists: a draft is created |
| `new draft made from the published document, gaps filled` | The document was published and has no draft: a draft is created from it, with the gaps filled, so publishing it again keeps the editor's work |
| `existing draft, gaps filled` | A draft exists: only its empty values are filled. `Gaps filled in existing documents` lists which |
| `nothing to add` | The document already holds everything the seed has |
| `Kept as edited in Sanity` | A value differs from the seed: the Studio value stays. Both are shown. `--overwrite --only <id>` replaces it |
| `Replaced with the seed's value` | Only with `--overwrite`: what was there and what it became |
| `Art (<dir>)` | Slots, matched files, what would be uploaded, warnings, files that match no slot, slots still missing. Without `--art-dir`: `Art: not processed` |
| `In the dataset but not in the seed` | Documents of the seed's types that it does not know. Left alone, never deleted |

After `--apply` the last line is `Verified: planning again after the write finds nothing to do`. A dry run ends with `Next: check this summary, then run with --apply`, or with `Next: nothing to add` when no document and no image is left to write; the `DRY RUN` line at the top asks for `--apply` in the first case only.

## Guarantees

- **Drafts only.** Every write goes through one function that refuses any id that is not `drafts.<id>`: a published document, a release version or a malformed id stops the whole run.
- **Idempotent.** Ids are stable (below). Documents are created with `createIfNotExists`, so a second run cannot duplicate or replace anything. After `--apply` the seed plans again and fails loudly if anything is still to do.
- **Fill the gaps, keep the edits.** An empty value (missing, `null`, blank text, empty list) takes the seed's value. Objects are merged key by key, so what only Sanity has (a hotspot, a crop, a language added later) survives. Lists of keyed items are merged by `_key`: a missing item is inserted after the seed item that precedes it. Any other difference is kept as it is in Sanity and reported.
- **One transaction, one revision check.** All the writes of a run are sent together, and a patch carries the revision it was planned from (`ifRevisionID`). If someone edits a draft between the read and the write, nothing is written and the run can simply be repeated.
- **Deleting in the Studio is not final.** A section or an item removed from a draft is added back by the next run, because it is a gap.
- **Nothing outside the dataset changes.** The seed writes to the one project and the `production` dataset named in `config.ts`; an exported `NEXT_PUBLIC_SANITY_DATASET` does not redirect it.

Undoing a first run: discard the drafts it listed in the Studio. Uploaded images stay in the media library, unused.

## Art

The seed does not make art and does not fetch it. It takes the files someone gives it.

1. Put the images in one folder outside the repo (Hanabi: `~/Companies/PBGO/assets/hanabi`, the same folder as the raw files; Exploding Kittens: `~/Companies/PBGO/assets/exploding-kittens`). The seed only reads it: it never writes, moves or deletes anything there. Only the top level is read, so files kept in a sub-folder (the Exploding Kittens spec keeps its cards in `cards/`) are copied next to the others. Files starting with a dot are skipped, and a file whose name is not a slot is only listed.
2. Name each file after its slot (tables below). Case does not matter, and spaces and underscores count as hyphens: `Card_Red 3.PNG` is `card-red-3.png`, and the names of the Exploding Kittens spec (`DEFUSE_3`, `TACOCAT`, `BACK`) fill their slots as they are.
3. Accepted formats: `png`, `jpg`, `jpeg`, `webp`, `svg`. Rasters become WebP (quality 86, alpha kept, orientation applied, metadata dropped); they are never enlarged, only reduced to the longest side of the slot. An SVG is kept as it is, and refused if it holds a script or an event handler.
4. Run `content:seed --dry-run --art-dir <the folder>`, with its absolute path (the shell expands `~`). The summary says how many slots have a file, which are missing, which files match no slot (a typo in the name) and which images are off the expected proportions (more than 3 %, a warning, not an error). Two files for one slot (`card-red-3.png` next to `card-red-3.jpg`) stop the run: keep one.
5. Run it with `--apply`. Missing images are uploaded, the dataset is searched by content first, so the same image is never uploaded twice. The images are placed in the **drafts**.

Image assets have no draft state: an uploaded image is in the media library at once, but nothing uses it until a draft points at it.

Replacing an image that is already placed: a plain run uploads the new file but the draft keeps the old picture, and says so under "Kept as edited in Sanity". Use `--overwrite --only <id>`. This replaces **every** value of that document that differs from the seed, not just the picture: read the dry-run list first.

The seed does not know where an image comes from. Publisher press visuals are not ours to publish: ask before uploading any, and write the art credit once the source is known.

### Hanabi slots (66)

| File name (without extension) | Count | Placed in | Proportions | Longest side |
| --- | --- | --- | --- | --- |
| `suit-<key>`, key in white, red, blue, yellow, green, multi, black (`suit-rainbow` also accepted for multi) | 7 | `suit-<key>` › `symbolImage` | 1:1 | 512 |
| `card-<key>-<1..5>` (`card-rainbow-<n>` also accepted) | 35 | `card-<key>-<n>` › `card` | 5:7 | 1400 |
| `card-back` | 1 | `game` › `cardBack` | 5:7 | 1400 |
| `mat` (optional) | 1 | `game` › `mat` | any | 2400 |
| `clue-token`, `clue-token-spent`, `fuse-token`, `fuse-token-exploded` | 4 | `game` › `clueToken`, `clueTokenSpent`, `fuseToken`, `fuseTokenExploded` | any | 512 |
| `value-1` … `value-5` | 5 | `game` › `valueGlyphs` › glyph of that value | any | 256 |
| `rating-<key>`, key in risible, mediocre, honorable, excellent, extraordinary, legendary, divine | 7 | `game` › `scoreScale` › badge of that rating | any | 512 |
| `bonus-1` … `bonus-6` | 6 | `bonus-tile-<n>` › `icon` | any | 512 |

### Exploding Kittens slots (46)

Card faces are numbered from 1, one per printed illustration of the card type: the same card can be drawn several ways. The five cats have a single illustration each.

| File name (without extension) | Count | Placed in | Proportions | Longest side |
| --- | --- | --- | --- | --- |
| `<card-type>-<1..n>`, card type in exploding-kitten (4), defuse (6), attack (4), skip (4), favor (4), shuffle (4), see-the-future (5), nope (5) | 36 | `card-type-<key>` › `illustrations` › item `art-<n>` › `image` | 5:7 | 1400 |
| `tacocat`, `cattermelon`, `hairy-potato-cat`, `beard-cat`, `rainbow-ralphing-cat` (`<key>-1` also accepted) | 5 | `card-type-<key>` › `illustrations` › item `art-1` › `image` | 5:7 | 1400 |
| `card-back` (`back` also accepted) | 1 | `game` › `cardBack` | 5:7 | 1400 |
| `box-front` | 1 | `game` › `boxFront` | any | 2000 |
| `box-back` (optional) | 1 | `game` › `boxBack` | any | 2000 |
| `mat` (optional) | 1 | `game` › `mat` | any | 2400 |
| `logo` | 1 | `settings` › `logo` | any | 1024 |

The card faces carry no text of their own in these slots: whether the printed art is the publisher's localised scans or the English art with PBGO's titles drawn over it is undecided, and the slots are the same either way. Localised scans would need one slot per language.

## What Hanabi gets

51 documents. Ids are plain published ids; the writer adds `drafts.`.

| Id | Type | Count | Holds |
| --- | --- | --- | --- |
| `suit-<key>` | `suit` | 7 | Name in four languages, colour, letter, symbol, pattern (so suits can be told apart without colour), extension, direction (black is built downwards) |
| `card-<suit>-<rank>` | `card` | 35 | Suit, value, quantity. One document per suit and value: 70 cards in all, 50 / 60 / 70 depending on the extensions |
| `bonus-tile-<n>` | `bonusTile` | 6 | Name and effect in four languages (Flamboyants extension) |
| `game` | `game` | 1 | Value glyph list, the seven score ratings (from score, label and line in four languages). Its images come with the art |
| `rules` | `rules` | 1 | Our own rules text: an introduction and 13 sections (goal, setup, turn, clue, discard, play, end, score, avalanche, blackPowder, flamboyants, bouquetFinal, online), each in FR, EN, ES and DE |
| `settings` | `settings` | 1 | Credits (author, publisher, link to the publisher) and the links to the publisher's rulebook PDFs: French (covers every extension) and English (base game). Spanish and German have none, the toolbar's Rules button then opens the English one |

Three of them are singletons, addressed in the Studio by the name of their type: `game`, `rules`, `settings`.

## What Exploding Kittens gets

17 documents, for the Original Edition only.

| Id | Type | Count | Holds |
| --- | --- | --- | --- |
| `card-type-<key>` | `cardType` | 13 | One per kind of card, keyed like the engine's catalogue (kebab-case: `exploding-kitten`, `defuse`, `attack`, `skip`, `favor`, `shuffle`, `see-the-future`, `nope`, `tacocat`, `cattermelon`, `hairy-potato-cat`, `beard-cat`, `rainbow-ralphing-cat`). Its kind (bomb, defuse, action, reaction, cat), its name and a one-sentence effect in four languages, and one `illustrations` entry per printed illustration (41 in all) that the art fills |
| `edition-original` | `edition` | 1 | The Original Edition, 56 cards: each line is a card type and its copies (4 Exploding Kitten, 6 Defuse, 4 Attack, 4 Skip, 4 Favor, 4 Shuffle, 5 See the Future, 5 Nope, 4 of each of the five cats). Name in four languages |
| `game` | `game` | 1 | Empty: the card back, the box and the mat come with the art |
| `rules` | `rules` | 1 | Our own rules text: an introduction and 10 sections (goal, setup, turn, explosion, cards, combos, nope, attack, end, online), each in FR, EN, ES and DE. The standard rules, the Nope reaction window and the optional five-different combination (off by default) |
| `settings` | `settings` | 1 | Credits (Elan Lee, Matthew Inman and Shane Small; publisher Exploding Kittens Inc. with its link) and the link to the publisher's English rulebook. French, Spanish and German have none, the toolbar's Rules button then opens the English one. No illustrator line until the art arrives |

Three of them are singletons: `game`, `rules`, `settings`.

### Editions that are not in the seed

The seed holds the Original Edition only. Each of the others would be one more `edition` document (and the card types it adds), written the same way. Their rulebooks, for when that work starts:

| Edition | Cards | Differs from the Original | Rulebook |
| --- | --- | --- | --- |
| NSFW | 56 | Same cards, adult art; cats Bikini Cat, Cat's Schrödinger, Momma Cat, Shy Bladder Cat, Zombie Cat | `https://cdn.shopify.com/s/files/1/0345/9180/1483/files/EKG-NSFW_Instructions_20OCT23.pdf` |
| Cat Burglar | 56 | Same cards and cats, other art | `https://ek-instructions.s3.amazonaws.com/cat-burglar/EKCB_instructions_17SEP21_r11.pdf` |
| Party Pack | 120 | Up to 10 players; adds Alter the Future, Draw From the Bottom, Feral Cat, Targeted Attack | `https://dumekj556jp75.cloudfront.net/ek-party-pack/EK_Party_Pack-Rules_wAttack.pdf` |
| Recipes for Disaster | 121 | Deck-building recipes; also holds cards of the three expansions | `https://dumekj556jp75.cloudfront.net/recipes-for-disaster/RFD_instructions.pdf` |
| Good vs. Evil | 55 | Godcat and Devilcat on a playmat, Armageddon; cats Horse, Knight, Mercat, Troll | `https://cdn.shopify.com/s/files/1/0345/9180/1483/files/EK-GVE-6_Instructions_09NOV2022_R2.pdf` |
| Zombie Kittens | 61 | Zombie Kittens instead of Defuses; dead players can come back and act | `https://ek-instructions.s3.amazonaws.com/ek-zombie-kittens/zombie-kittens-rules.pdf` |
| 2-Player | 32 | 1 Exploding Kitten, 3 Defuse, three cats | `https://dumekj556jp75.cloudfront.net/ek-2player/ek2p-English.pdf` |
| Imploding Kittens (expansion) | 20 | Up to 6 players; Imploding Kitten, Reverse, Alter the Future | `https://dumekj556jp75.cloudfront.net/imploding-kittens/imploding-english.pdf` (image-only PDF) |
| Streaking Kittens (expansion) | 15 | Streaking Kitten, Catomic Bomb, Curse of the Cat Butt | `https://ek-instructions.s3.amazonaws.com/streaking-kittens/streaking-kittens-rules.pdf` |
| Barking Kittens (expansion) | 20 | Barking Kitten, Bury, Personal Attack | `https://dumekj556jp75.cloudfront.net/barking-kittens/barking-kittens-rules.pdf` (image-only PDF) |

## Rules text

- Written in our own words from the game's spec and the rulebook read for understanding. Nothing is copied. The publisher's PDF is linked, not reproduced.
- One register per language: FR "vous", EN "you", ES "tú", DE "du". Typographic apostrophe (’), never the straight one.
- Hanabi: the French text is the reference. EN, ES and DE are written by the content agent and are meant for a native read before the game goes live: terms of the game (clue, fuse, firework, avalanche…) are the first thing to check.
- Exploding Kittens: the spec is in English, so the four languages were written side by side from it. FR, ES and DE are meant for a native read. The five cats keep their English names in every language; the other cards take the spec's glossary (a Defuse is a Kit de désamorçage, a Desactivación, an Entschärfung). Two German words come from that glossary and are worth a look: Pärchen for a pair, Fünfling for five different cards.
- The text only describes the game as the spec defines it, variants and options included. What the engine does is a separate piece of work. Exploding Kittens leaves out two things its spec leaves open (a "Faster game" option and the classic deal), so the rules page does not mention them.

## Tests

```bash
pnpm --filter @pbgo/content-kit test
pnpm --filter @pbgo-game/<slug> test
pnpm --filter @pbgo-game/<slug> typecheck
```

They need no network and write nothing. A game's `typecheck` covers `content/` too (`tsc -p content`).

In the kit (`packages/content-kit/src/*.test.ts`, 416 tests): the guarantees above, checked against an in-memory dataset that refuses what the real API refuses (`memory-store.ts`); the options, the token, the art folder, the report and the command.

In each game:
- `content/data/data.test.ts` checks the documents themselves, and every text in them: it exists in the four languages and is written in its own, no stray space or straight apostrophe, no placeholder, at most 4 000 characters. Hanabi: the deck is the one of the rulebook (50 / 60 / 70 cards, the black firework counted the other way round), the score scale covers 0 to 30 once. Exploding Kittens: the card types are the engine's thirteen keys, the Original Edition is the 56 cards of the box and deals as the rulebook says (35 / 29 / 23 / 16 cards in the pile for 2 to 5 players), the rules text gives the same figures in every language.
- `content/data/schema.test.ts` loads the real Studio configuration and checks every seed document against the Studio's own types (field names, option lists, validation rules), and every art slot against a real image field. A field renamed or a rule tightened in the Studio fails here, not in front of an editor.
- `content/data/run.test.ts` runs the game's seed and art slots through the kit's runner against an in-memory dataset: drafts only, nothing the second time, nothing after a publication, art placed by slot.
- `content/seed.test.ts` runs the command itself for the paths that end before the token is read.

Each guarantee was checked by breaking it on purpose and watching a test fail.

Code in the kit and in `content/` runs directly with Node (type stripping, no build): relative imports carry their `.ts` extension, type-only imports use `import type`, and only syntax that can be erased is used (`erasableSyntaxOnly`). The root `pnpm lint` does not cover game packages or the kit; they are linted with the shared config when needed.

## Starting the pipeline for another game

1. `pnpm new-game <slug>` and `pnpm go-live <slug>` give the game its package, its Sanity project and its write token (`apps/web/.env.local`).
2. Define the document types in `games/<slug>/apps/studio/schemaTypes/` with a `constants.ts` for the lists the seed shares, and register them in `sanity.config.ts` (`gameTypes`, and `collections` for the lists in the Studio's sidebar).
3. Add `@pbgo/content-kit` and `@pbgo/studio-kit` (`workspace:*`) and `vitest` (`catalog:`) to the game's dev dependencies, with the `typecheck` (`tsc --noEmit && tsc --noEmit -p content`), `test` (`vitest run`) and `content:seed` (`node --disable-warning=ExperimentalWarning content/seed.ts`) scripts and a `vitest.config.ts` that includes `content/**/*.test.ts`. `games/exploding-kittens` is the smallest model.
4. Write `content/config.ts` (slug, project id), `content/seed.ts` (`runSeedCli` with the game's `buildSeedDocs` and `ART_SLOTS`), `content/tsconfig.json` and `content/data/`: the game's documents, and `art-manifest.ts` with its image slots. There is nothing to copy from the kit: it stays where it is.
5. Run the tests, then follow the process above.

## Known limits

- Neither Hanabi's binding nor Exploding Kittens' reads the `rules` document yet: the table UI is a separate piece of work. Until then the toolbar's Rules button opens the publisher's PDF.
- The seed fills but never reconciles: a value changed in the Studio that the seed now says differently is reported, not merged.
- Only the types the seed manages are checked for leftovers (the "not in the seed" list).
- An upgrade of `sharp` can change the bytes of a normalised image: a re-run then uploads a new asset and reports the old picture as kept.
- Art that arrives without a source cannot be credited. The credits line names the authors and links the publisher, nothing about the artwork until that is known.
- The schema checker used by the tests (`schema-check.ts`) does not follow `reference` fields: a document type that links to another needs a plain key instead, as the Exploding Kittens edition does for its card types.
