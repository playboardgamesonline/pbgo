# Skills by agent category

A skill is a procedure an agent follows for a recurring job: the questions to ask the owner, the rules and don'ts, the commands, how to check and hand over. Procedures live here, not in `CLAUDE.md`: `CLAUDE.md` describes the codebase, a skill says how to do a job in it. A rule of a recurring job is written once, in its skill; other docs point to it.

## Categories

The category is the type of agent that carries the skill out. It is the prefix of the folder and the first words of the description (`[GAME agent] …`), because the harness lists skills flat.

| Prefix | Agent | Linear lane | Typical areas |
| --- | --- | --- | --- |
| `game-` | GAME | Game lane | a game's content and look: `games/<slug>/src` (binding, board), its Studio (`apps/studio`) and `content/`, `template/`, `packages/studio-kit`, `packages/content-kit` |
| `engine-` | ENGINE | Engine lane | the rules code: `packages/engine-kit`, `games/<slug>/packages/engine`, the turn and absent-player logic |
| `platform-` | PLATFORM | Platform lane | the shared app: `apps/web`, `packages/core`, `packages/ui`, the gamemaster, `supabase/migrations`, the scripts, deployment |

Two more agents run in Claude Cowork, outside the repo, and have no skill here: GAME CONTENT (Game content lane: a game's assets from official sources and the Catalog data, handed to GAME for the Sanity seed) and SUPERVISOR (keeps Notion, Linear and this repo aligned, writes no code). Their skills live in the Notion Skills database, which also indexes the skills of this folder.

A job that crosses categories is split: each skill does its part and names the skill that does the rest.

## A game from A to Z

A game goes through six stages, and `pnpm check:game <slug>` says which it has reached from what is in the repo: `scaffold` → `engine` → `binding` → `board` → `content` → `live`. `pnpm check:game <slug> --stage <stage>` is the gate: it exits 1 while a check up to that stage fails, so "ready for the next step" is a command and not an opinion. `pnpm check:game --all` shows every game of the registry and what stops it. The checks it cannot make, the words of the rules, the look of the board, a table played with two seats, are in the skills; the board itself is checked in a real browser by `pnpm check:board <slug>` (it needs `pnpm dev`, a Chromium in Playwright's cache and ffmpeg, and is no gate: `docs/scripts.md`).

| Step | Skill | Ends when | State |
| --- | --- | --- | --- |
| Identify the game: edition, publisher, rules version | `/game-scout` (GAM-32) | the owner confirms the edition | written |
| Catalog entry in the platform's Sanity (a draft) | `platform-catalog-entry` (PLT-98) | the owner publishes it | written |
| Rules spec and the list of components | `game-rules-spec` (GAM-33) | the owner validates the spec | written |
| Platform assets: the pictures of the catalog entry | `platform-assets` (PLT-99) | the owner approved the pictures and they are published | written |
| Game assets: the art of the game's own Sanity | `game-assets` (GAM-34) | the owner has handed the art over and looked at it | written |
| The game's folder, its Sanity project and Studio | `game-new` | the Studio is open | written |
| The Studio's forms, the seed | `game-sanity-create` | the drafts are seeded | written |
| The engine | `engine-rules` | `check:game --stage engine` exits 0 | written |
| The binding and the board | `engine-board` | `check:game --stage board` exits 0 | written |
| Content and go-live | `game-go-live` | `check:game --stage content` exits 0, then the switches are turned | written |

`pnpm add-game "<name>"` (PLT-97, `packages/pipeline`, `docs/scripts.md`) runs these rows in this order, one gate each, up to the game's art (the first three work alone, each a headless call; the pictures and the art are sessions of the owner's own, where they approve each download, upload and publication), the folder of the game being made between the two by `game-new`; the other rows are the steps its next versions add (a skill, a `StepDefinition` in `packages/pipeline/src/steps.ts`, and the row above). A gap in the blocks of the kit or the table found while planning is not worked around in the game: it goes to the engine lane (`engine-rules` step 2), and the first game of a family tells the engine lane what was awkward ("Friction" in its plan).

## Skills

### GAME
- `game-assets` — bring a game's own art into its own Sanity project: from the component list of its rules spec and the art slots of its seed, sort the owner's source files into the agreed art folder (`~/Companies/PBGO/assets/<slug>`, each file named after its slot, the originals never touched), dry-run the game's seed, and upload as drafts after the owner's yes; never makes, edits, crops or upscales a picture; runs in a session of the owner's own (`packages/content-kit/src/game-assets-skill.test.ts` keeps it to what exists)
- `game-scout` — identify a game before it is added: the edition (publisher, year, rules version), its BoardGameGeek popularity and complexity, its figures, an English slug and a type (an expansion or a reimplementation is suggested, with a base game of the platform's catalog), as a short report and a `scout.json` that `platform-catalog-entry` and the pipeline read, checked by `pnpm check:scout`, then a gate (`packages/games/src/scout.test.ts` keeps the shape of the file and the skill's example)
- `game-rules-spec` — write a game's rules spec before its engine: from the rulebook the scout found (and the publisher's FAQ and errata), the component list and the rules as the engine will follow them, one page of the docs, `docs/games/<slug>/rules.md`, with the cases the rulebook leaves open and a reading proposed for each, checked by `pnpm check:rules`, then a gate until the owner validates (`packages/games/src/rules-spec.test.ts` keeps the shape of the page and the skill's examples)
- `game-new` — start a new game from nothing: the questions to ask the owner, `pnpm add-game` (code from the template, Sanity project, Studio, rules PDFs, environment) run after an explicit ok, then the hand-over to `game-sanity-create` for the fields
- `game-sanity-create` — build or reshape a game's Sanity content model: the questions to ask the owner, the Studio-form rules and don'ts, the schemas, the guards, the seed and the Studio deploy
- `game-go-live` — put a finished game live: the gate `check:game --stage content`, what only a person can say, the preview, the two switches of the registry, the checks of production

### ENGINE
- `engine-rules` — write a game's engine from its rulebook: the plan first (rules as coded, the cases left open, who sees what, the blocks and the gaps), the slices, the tests and the contract suite, the gate `check:game --stage engine`
- `engine-board` — (written by the engine lane, carried out by whoever mounts a board, usually the GAME agent) hand an engine to the app and draw its board on `@pbgo/table`: the binding and its three tests, the board from the blocks of the table, tuning, the checks in a browser (`pnpm check:board <slug>`: the windows, the controls pressed with the mouse, the cases of `GAME.debug` as frames, a reload, the start, a player who is away; two seats and a phone for the rest), the gate `check:game --stage board`

### PLATFORM
- `platform-assets` — place a game's pictures in its catalog entry: the cover (4:3), logo, icon, background and box front, from official sources only (extraction only: never edited, cropped, upscaled or made), brought into a folder with the owner's approval of each command, their sources written down, placed as a draft with `pnpm --filter @pbgo/platform content:attach-art` and published only on the owner's yes; runs in a session of the owner's own (`platform/content/platform-assets-skill.test.ts` keeps it to what exists)
- `platform-catalog-entry` — create or complete a game's entry in the platform's Sanity project as a draft, from the `/game-scout` file and official sources (English, official facts only, no pictures): what the catalog has already, what each field of each type gets, the link to the draft in the Studio, the gate, and the publication only on the owner's yes (`platform/apps/studio/catalog-entry-skill.test.ts` keeps its tables and skeletons the Studio's fields)

## Writing a skill
1. One job per skill: `.claude/skills/<prefix>-<job>/SKILL.md`, `name` = the folder.
2. Frontmatter: `name`, and a `description` that starts with `[<CATEGORY> agent]`, then what the skill does and when to use it.
3. Body: what the owner decides first (each question with a recommended default), the rules and don'ts, the steps with their exact commands, the checks, the hand-over.
4. A rule a test can check gets a test, and the skill names it. A rule about the state of a game in the repo is a check of `scripts/check-game.mjs`, so that the gate says it.
5. Add the skill to the list above and to the Notion Skills database (one row pointing to its `SKILL.md`).
