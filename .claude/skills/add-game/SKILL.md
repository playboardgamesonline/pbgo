---
name: add-game
description: "[GAME agent] Add a game to the platform, from its name to live, in the owner's session: it reads the game's state (`pnpm game-flow status`), says where the game stands, runs the next step as a sub-agent with that step's skill, runs the step's machine check, stops for the owner's answer in the chat (ok, or what to change), then updates the state and the step's Linear sub-issue and goes on. Ten steps: game-scout, platform-catalog-entry, game-rules-spec, platform-assets, game-new, game-sanity-create, game-assets, engine-rules, engine-board, game-go-live. Resumable from any session. Use when the owner wants to add a game, or runs /add-game <name or slug>."
---

# Add a game

You are the orchestrator of the ten steps that take a game from its name to live. **You never do a step yourself**: each one is carried out by a sub-agent that follows the skill of that step, you run the machine's check of what it left, and the owner answers at a gate, here, in the chat. The state of the game is one file outside the repo, `~/Companies/PBGO/assets/<slug>/pipeline.json`, and you are its only writer, through `pnpm game-flow` (`packages/pipeline`, `docs/scripts.md`), so that any session can pick the game up where it stopped and nothing is improvised.

The argument is the game's name as the owner says it, or its slug; with none, `pnpm game-flow status` lists the games in the flow, offer them or ask for a name. Talk to the owner in the language they write in.

## The ten steps

| # | Step | Skill (the sub-agent's) | The machine's check | The owner's ok validates |
| --- | --- | --- | --- | --- |
| 1 | scout | `game-scout` | `check:scout <file> --online` | the edition |
| 2 | catalog entry | `platform-catalog-entry` | the documents of its report are published | the drafts, then the word `publish` |
| 3 | rules spec | `game-rules-spec` | `check:rules <slug> --name` | the spec (and the readings it proposes: `validate` stamps the page) |
| 4 | platform assets | `platform-assets` | `catalog:pictures <slug>` | the pictures, placed and published |
| 5 | game folder | `game-new` | `check:game <slug> --stage scaffold` | the creation (Sanity, Studio, environment) |
| 6 | studio forms | `game-sanity-create` | `check:game <slug> --only content` | the fields and the seed |
| 7 | game assets | `game-assets` | the seed's dry run on the art folder | the art |
| 8 | engine | `engine-rules` | `check:game <slug> --stage engine` | the engine |
| 9 | board | `engine-board` | `check:game <slug> --stage board` | the board |
| 10 | go live | `game-go-live` | `check:game <slug> --stage live` | going live |

A step does not begin before the one before it is validated, and steps 6 to 10 wait for `games/<slug>` in this checkout. `pnpm game-flow` enforces both and says so.

## 0. Before the first step

- The sub-agents read and write `~/Companies/PBGO/assets/<slug>/`. When a read or a write there is refused, ask for access to that folder for this session (once).
- Your temp folder (the scratchpad of your system prompt) is what you pass as `--scratch`: the briefs, the reports and the Linear answers go there.
- Commands run from the root of this checkout, which has had `pnpm install`.

## 1. Where is the game?

`pnpm game-flow status "<game>"` (a name as typed, or a slug).

- **Not in the flow yet.** Say the ten steps and where the work lands: files in `~/Companies/PBGO/assets/<slug>/`, drafts then documents in the platform's Sanity (the owner's word `publish` makes them public), the game's code in this checkout, and Linear (a parent issue and ten sub-issues in the Games team, project Game factory: they are written in the owner's workspace, so ask first). On their ok, `pnpm game-flow start "<Name>"`. A game that has a folder in the repo is refused: show `pnpm check:game <slug>` and propose `start "<Name>" --adopt-through <step>` for the last step it has really passed, and ask; the scout never runs for a game that exists.
- **In the flow.** Show the table that `status` printed and say in one sentence where the game stands and what is next. The line `Next:` is the action: `begin` (run the step), `wait-owner` (the step waits at its gate: show it again), `reopen` (it was interrupted or failed: begin again), `make-folder` (the folder is already there: `gate` with no sub-agent), `wait-folder` (tell the owner to switch to the branch or the worktree that has `games/<slug>`), `done` (`pnpm check:game <slug>` says the rest).

## 2. The loop, step by step

**a. Open the step.** `pnpm game-flow begin <slug> <step> --scratch <your temp folder>` writes the brief of the sub-agent (its skill, its argument, the paths, the rules that bind it, the shape of its report) and says what to give it. Before the rules spec, run `pnpm game-flow rulebook <slug>` once: it fetches the rulebook the scout found to `rules.pdf` (exit 1: tell the owner where to put the PDF, and go on, a rulebook that is a web page is read as it is).

**b. Run the sub-agent.** Agent tool, `subagent_type: "general-purpose"`, a short description (`<step> · <Name>`), the prompt the command printed (`Read <brief> and follow it.`), no `model` (the owner's own: an engine is not written with the cheapest). It runs in the background: say in one line what it is doing and end your turn. Do not poll, do not wait, never say what it will answer; its report arrives as a notification. Keep its agent id for this step.

**c. Read its answer.** The report ends with `STATUS:`.
- `questions`: it cannot talk to the owner. Put each question to them here, with its options and the default it recommends (so that "ok" is enough), and send their answers back **word for word** with `SendMessage` to the same agent. Repeat until `done`.
- `blocked`: say why, `pnpm game-flow fail <slug> <step> --reason "<why>"`, and ask the owner what to do.
- `done`: go to d.

**d. The check and the gate.** `pnpm game-flow gate <slug> <step> --report <the report path>` records the report, runs the step's check and prints the gate. Exit 1 means the check failed: the gate is still to be shown. Tell the owner, in their language: what was done, the check (what passes, what stops), the links, what was not verified, and ask **"ok, or what to change?"**. Then stop and wait: a gate is the owner's, never validate on your own judgment or on a green check alone.

**e. The owner answers.**
- **ok** → `pnpm game-flow validate <slug> <step>`: it judges the check again (the files may have changed), refuses a step that does not pass, and does what the ok does (the scout's folder follows the slug it settled, the rules spec is stamped as validated). Then Linear (f) and the next step. For the catalog entry the first ok only says the drafts are right: `validate` prints the second gate, which lists the documents that publish would make public. Ask for the word `publish` and nothing else, send it to the same agent with the owner's words, read its report, `pnpm game-flow check <slug> catalog-entry` (the platform's Sanity is asked whether they are published), then `validate` again.
- **a change** → `pnpm game-flow begin <slug> <step> --change`, send the owner's words to the agent that did the step, and ask it to write its new report to the path printed; back to c. When that agent is gone (another session, an app that was quit), give a fresh agent the brief the command wrote and the owner's words.
- An ok at a gate is not an ok for what a sub-agent asks to do (an upload, a publication, a Sanity project, `setup-env`, a push, a pull request): it asks through `questions`, and you relay the answer it is given, never more.

**f. Linear.** After a step is validated, and once when the game starts (after the owner's ok): `pnpm game-flow linear <slug> --scratch <your temp folder>` says "nothing to do" or writes a brief. Give it to a small sub-agent (Agent tool, `model: "haiku"`, the prompt the command printed), and when it answers `pnpm game-flow linear-record <slug> --scratch <your temp folder>`. It runs in the background while you go on with the next step; record its answer when it arrives, and never run two at once. A failure is told in one line and never stops the game: the next point brings Linear up to date.

## 3. Where the game's code lives

Steps 5 to 10 write code in this checkout. Their skills cut branches from `origin/main` named after the issue (`gam-<n>-<slug>-<topic>`), one pull request per slice, and each pull request names the issue of its own step (`pnpm game-flow status` shows it), never the parent. The sub-agents push, open and merge nothing without the owner's go that you relayed, and nobody merges their own pull request. The next step works on the same branch while a pull request waits: the gate says what is still open.

## 4. Coming back

- After a restart, a compaction or another session: `pnpm game-flow status "<game>"` is the whole memory. A step at its gate shows again (`status <game> --step <step>` prints its report and check); an interrupted or failed one is opened again by `begin`, which gives the fresh sub-agent a brief that says to look at what exists and carry on. A sub-agent you cannot reach is replaced, never waited for.
- `pnpm game-flow redo <slug> <step>` takes a step and the ones after it back to not started (the skills fill and never replace).
- `pnpm game-flow status` with no game lists the games in the flow.

## Don'ts

- Never run a step's skill yourself, never answer a sub-agent's question for the owner, never write `pipeline.json` by hand.
- Never validate without the owner's ok in this chat, and never let an ok stand for a word that acts (`publish`, an upload, a push).
- Never paste or print a secret; the commands read the tokens themselves.
- Never create an account or type a password for the owner.

## Checks

`packages/pipeline/src/add-game-skill.test.ts` keeps the table above to the steps, and every `pnpm game-flow` verb named here to the command. The command's own tests are `packages/pipeline/src/*.test.ts`.
