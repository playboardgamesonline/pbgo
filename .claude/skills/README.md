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
| Identify the game: edition, publisher, rules version | `/game-scout` (GAM-32) | the owner confirms the edition | to write |
| Catalog entry in the platform's Sanity (a draft) | `platform-catalog-entry` (PLT-98) | the owner publishes it | to write |
| Rules spec and the list of components | `game-rules-spec` (GAM-33) | the owner validates the spec | to write; `engine-rules` step 2 does the plan meanwhile |
| Platform assets, game assets | `platform-assets` (PLT-99), `game-assets` (GAM-34) | the owner has handed the art over | to write |
| The game's folder, its Sanity project and Studio | `game-new` | the Studio is open | written |
| The Studio's forms, the seed | `game-sanity-create` | the drafts are seeded | written |
| The engine | `engine-rules` | `check:game --stage engine` exits 0 | written |
| The binding and the board | `engine-board` | `check:game --stage board` exits 0 | written |
| Content and go-live | `game-go-live` | `check:game --stage content` exits 0, then the switches are turned | written |

The terminal pipeline planned in PLT-97 will run these steps in this order, one gate each; the engine, the board, the content and go-live, the last four rows, are the steps its first version leaves out. A gap in the blocks of the kit or the table found while planning is not worked around in the game: it goes to the engine lane (`engine-rules` step 2), and the first game of a family tells the engine lane what was awkward ("Friction" in its plan).

## Skills

### GAME
- `game-new` — start a new game from nothing: the questions to ask the owner, `pnpm add-game` (code from the template, Sanity project, Studio, rules PDFs, environment) run after an explicit ok, then the hand-over to `game-sanity-create` for the fields
- `game-sanity-create` — build or reshape a game's Sanity content model: the questions to ask the owner, the Studio-form rules and don'ts, the schemas, the guards, the seed and the Studio deploy
- `game-go-live` — put a finished game live: the gate `check:game --stage content`, what only a person can say, the preview, the two switches of the registry, the checks of production

### ENGINE
- `engine-rules` — write a game's engine from its rulebook: the plan first (rules as coded, the cases left open, who sees what, the blocks and the gaps), the slices, the tests and the contract suite, the gate `check:game --stage engine`
- `engine-board` — (written by the engine lane, carried out by whoever mounts a board, usually the GAME agent) hand an engine to the app and draw its board on `@pbgo/table`: the binding and its three tests, the board from the blocks of the table, tuning, the checks in a browser (`pnpm check:board <slug>`: the windows, the controls pressed with the mouse, the cases of `GAME.debug` as frames, a reload, the start, a player who is away; two seats and a phone for the rest), the gate `check:game --stage board`

### PLATFORM
None yet.

## Writing a skill
1. One job per skill: `.claude/skills/<prefix>-<job>/SKILL.md`, `name` = the folder.
2. Frontmatter: `name`, and a `description` that starts with `[<CATEGORY> agent]`, then what the skill does and when to use it.
3. Body: what the owner decides first (each question with a recommended default), the rules and don'ts, the steps with their exact commands, the checks, the hand-over.
4. A rule a test can check gets a test, and the skill names it. A rule about the state of a game in the repo is a check of `scripts/check-game.mjs`, so that the gate says it.
5. Add the skill to the list above and to the Notion Skills database (one row pointing to its `SKILL.md`).
