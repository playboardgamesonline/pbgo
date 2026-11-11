---
name: engine-rules
description: "[ENGINE agent] Write a game's engine from its rulebook. Plans first (the rules as coded, the cases the rulebook leaves open, who sees what, the blocks of the kit and the table each rule rests on, and the gaps), asks the owner one batch of questions, then writes the engine in slices with its tests until `pnpm check:game <slug> --stage engine` passes. Use when a game has its folder (game-new) and its rulebook and needs its rules in code."
---

# Write a game's engine

The engine is the rules: pure TypeScript on `@pbgo/engine-kit`, tested with Vitest, knowing nothing of the screen. The job ends when the engine passes `pnpm check:game <slug> --stage engine`, the contract suite and the checklist, and the owner has validated the cases the rulebook leaves open. The files, the rule each one keeps and the tests are in `docs/engine/04-build-a-game/` and `docs/engine/01-the-game/`; this skill is the order to do them in and the questions to ask, not a second copy of them. The argument is the slug; ask if there is none.

## 1. Where is the game?

Look before asking: `pnpm check:game <slug>` says how far the game has got.

- `scaffold` fails: the game has no folder or no Sanity project yet. Stop and run `game-new`.
- `engine` fails on "own engine": the template's demo is still there. Go to step 2.
- A plan is in `games/<slug>/CLAUDE.md` and part of the engine exists: read both, and carry on from the slice the plan names.

### An engine that is already written

The first engines were written before the kit settled: `check:game` passes `engine` and reports `up to date` as a `warn`. Bring such an engine up to date before anything is built on it, in one slice, in this order (the pilot, Flip 7, went this way):

1. **Run the contract suite** from a test file in the engine package, `conformance.test.ts`, with the game's `secretsFor`, and keep it until the binding exists, which takes the file over (`engine-board` moves it, it does not copy it). Its sentences are the list of what the engine breaks. `secretsFor` returns what the view would hold: the opaque ids of the kit are numbers, so return numbers (a string never matches a number in a view).
2. **Words become keys.** An option or a line of score that carries a `label` or a `help` loses it; the keys are `option.<key>.label`, `option.<key>.help` and `score.<line>`, and the definition lists `scoreLines`. The words are a seed of the game's `texts` (`content/data/texts.ts`, Flip 7's is the model) with a parity test against `engineTextKeys(GAME)`. French is the engine's own words, English the base; a Spanish or German text the agent wrote is flagged for the owner to read.
3. **`standings` and `progress`.** A game that counts points while it goes puts `standings` in its view (one `{ playerId, score }` per seat, in seat order, the same for every viewer); the definition has a `progress` that is itself between 0 and 100.
4. **The readings to validate.** Each case the notes call "to validate" goes to the owner as one batch, with the publisher's answer where the publisher has one and the reading to keep by default.

`pnpm check:game <slug> --stage engine` must show `up to date` as `ok`.

## 2. Plan first, no code

Read the rulebook (the PDF in the game's settings, or the rules spec the owner gives; `pages` for a long one) and the game's `CLAUDE.md`. Then ask **one batch** of questions, each with a recommended default so that "ok" is enough, in the language the owner writes in.

1. **Which rules.** The edition and the version of the booklet (Flip 7 is ruleset 3.1). Default: the base game as it is played in real life; each expansion and each variant is its own later work, and no room is kept for it in the code.
2. **The table.** The fewest and the most players the engine seats. Default: the booklet's, within the platform's bounds.
3. **Who sees what.** What each player may see of the others: hands, the order of the draw pile, a secret role ([Hidden information](../../../docs/engine/01-the-game/10-views.md#hidden-information)). Default: only what players could see at a real table.
4. **Who is waited for.** One player at a time, or all of them on a simultaneous step ([Turns](../../../docs/engine/01-the-game/03-turns.md)). Default: what the booklet says.
5. **Time.** Whether a step has a clock ([Timers](../../../docs/engine/02-components/20-timers.md)). Default: none; a clock is the game's own option when it has one.
6. **The end.** Who wins, ties, a table that wins or loses together, how the game ends for each player ([Results](../../../docs/engine/01-the-game/06-victory.md)). Default: the booklet's.
7. **Where the booklet is silent.** List each case with the reading you propose and where it comes from. A reading that comes from a third-party rules site is not the booklet's: say so. Default: the usual reading, marked "to validate". Never decide one in silence.
8. **Options and aids.** Which rules the lobby may switch. Default: none, and no aid (a risk helper, a hint) until the game is playable and the owner asks.

Then write the plan in the game's `CLAUDE.md`, replacing what the template left there, and give it to the owner. Wait for the ok: **no code in `packages/engine/src` before it.** The plan holds:

- **Rules as coded**, each with the page of the booklet; **what the booklet leaves open**, each case with its reading; **who sees what**; the **glossary** of the game's words with the English names the code uses.
- **The blocks.** One row for each thing the game has (a hand, a market, a die, a track, a map, a sheet of boxes, tiles, a clock…): the block of the kit and of the table that carries it, or "gap". Read it from [Components](../../../docs/engine/02-components/index.md) and [Words and names](../../../docs/engine/02-components/00-words-and-names.md); what no block holds is on [Not built yet](../../../docs/engine/03-not-built-yet.md).
- **The state** as a sketch (ids and numbers), the **actions**, and the **slices** (step 3).

**A gap is not coded in the game.** A one-off in a game is how two games end up with two versions of a die. Name the gap in the plan, say what holds meanwhile, and hand it to the engine lane as an issue (ask the owner before writing in Linear). The game waits for that block or goes on with the parts that do not need it.

## 3. Write, in slices

Each slice is a branch (named after the issue, `gam-<n>-<slug>-<topic>`) and a pull request, started only when the owner says go.

1. **The skeleton.** Types, `setup`, `waitingFor`, one turn, `results`, and `autoPlayFor` that finishes a game, so that a whole game is played by the engine itself, even with reduced rules. The contract suite is green from this first slice and stays green.
2. **The rules, one part each.** A file and its test, with the page of the booklet in the test. The order of the files is in [Writing the engine](../../../docs/engine/04-build-a-game/03-writing-the-engine.md).
3. **The cases left open**, once the owner has validated them, the options and the debug commands.

## 4. The rules that are easy to break

The checklist ([Before you hand the engine over](../../../docs/engine/04-build-a-game/08-checklist.md)) is the only copy of the rules; run through it before every hand-over. The ones that cost the most when they are broken late:

- The state is lean (ids and numbers: no display data, no derived value, no log), every order comes from an array, and everything random comes from the seed with its stream carried from step to step.
- `apply` and `step` never mutate their argument. A player's mistake is an `EngineError` with a code; a bug is a plain error.
- A view shows nothing hidden to any viewer, `null` and a stranger included; `waitingFor` is public and lists nothing hidden.
- The engine holds no text: its options and the lines of its score name keys, and the words are written in the game's Sanity ([The words of options and scores](../../../docs/engine/01-the-game/07-parameters.md#the-words-of-options-and-scores)). The contract suite fails on a label written in the engine.

## 5. Tests

The layers, with a model file for each, are in [Testing the engine](../../../docs/engine/04-build-a-game/06-testing.md). On top of them:

- **The contract suite from the first slice.** `conformanceProblems(GAME, { errorCodes, secretsFor })` of `@pbgo/engine-kit/testing` plays the engine the way the server does. While the binding does not exist, run it from a test file in the engine package; the binding takes it over in `engine-board` (moved, not copied: it plays whole games and takes about 15 s). `secretsFor` lists what a viewer must never see: write it with care, since it is what proves the views keep their secrets.
- **A simulation** that plays whole games with random legal moves at every table size and checks the invariants of the rules after every move, and writes the expected score again from the names of the faces.
- **Refusals by code**, the order of keys, a state frozen with `deepFreeze`, and absent players with `playFor`.

`pnpm --filter @<slug>/engine test` and `typecheck` run the engine's tests.

## 6. Hand over

- `pnpm check:game <slug> --stage engine` exits 0 and the checklist has no line that is not true.
- The plan in `CLAUDE.md` says what was coded and what the owner decided. Under "Friction" it lists everything in the kit that was awkward and each gap: the engine lane reads it.
- The commit follows the repo's form, `✨(<slug>): …`, the pull request names the issue, and nobody merges their own.
- Say what the next step needs: the binding and the board (`engine-board`), and the texts of the options and the score lines in the game's Sanity (`game-sanity-create`).
