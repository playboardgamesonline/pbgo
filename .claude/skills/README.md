# Skills by agent category

A skill is a procedure an agent follows for a recurring job: the questions to ask the owner, the rules and don'ts, the commands, how to check and hand over. Procedures live here, not in `CLAUDE.md`: `CLAUDE.md` describes the codebase, a skill says how to do a job in it. A rule of a recurring job is written once, in its skill; other docs point to it.

## Categories

The category is the type of agent that carries the skill out. It is the prefix of the folder and the first words of the description (`[GAME agent] …`), because the harness lists skills flat.

| Prefix | Agent | Typical areas |
| --- | --- | --- |
| `game-` | GAME | a game's content and look: `games/<slug>/src` (binding, board), its Studio (`apps/studio`) and `content/`, `template/`, `packages/studio-kit`, `packages/content-kit` |
| `engine-` | ENGINE | the rules code: `packages/engine-kit`, `games/<slug>/packages/engine`, the turn and absent-player logic |
| `platform-` | PLATFORM | the shared app: `apps/web`, `packages/core`, `packages/ui`, the gamemaster, `supabase/migrations`, the scripts, deployment |

A job that crosses categories is split: each skill does its part and names the skill that does the rest.

## Skills

### GAME
- `game-new` — start a new game from nothing: the questions to ask the owner, `pnpm add-game` (code from the template, Sanity project, Studio, rules PDFs, environment) run after an explicit ok, then the hand-over to `game-sanity-create` for the fields
- `game-sanity-create` — build or reshape a game's Sanity content model: the questions to ask the owner, the Studio-form rules and don'ts, the schemas, the guards, the seed and the Studio deploy

### ENGINE
None yet.

### PLATFORM
None yet.

## Writing a skill
1. One job per skill: `.claude/skills/<prefix>-<job>/SKILL.md`, `name` = the folder.
2. Frontmatter: `name`, and a `description` that starts with `[<CATEGORY> agent]`, then what the skill does and when to use it.
3. Body: what the owner decides first (each question with a recommended default), the rules and don'ts, the steps with their exact commands, the checks, the hand-over.
4. A rule a test can check gets a test, and the skill names it.
5. Add the skill to the list above.
