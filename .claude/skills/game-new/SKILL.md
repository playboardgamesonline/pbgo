---
name: game-new
description: "[GAME agent] Start a new game from nothing. Asks the owner the name, the rulebook PDFs and the issue, checks what it can, shows what leaves the machine (code from the template, Sanity project, Studio, rules PDFs, environment) and creates it only after an explicit ok, one script at a time, then hands over to game-sanity-create for the fields. Use when the owner wants a new game, when /add-game reaches the game's folder, or when the owner runs /game-new <slug>."
---

# Start a new game

`/add-game` runs this skill as its fifth step, after the scout, the catalog entry, the rules spec and the platform assets: it hands over the name, the slug, the rulebook and the rules spec, and the skill starts at the game's folder. It also runs alone, as `/game-new <slug>`, for a game with none of that.

Four scripts do the plumbing, the agent asks the questions, runs the checks and shows what leaves the machine, and the fields of the Studio are proposed from the rulebook before anything is built. The job ends when the owner has the Studio open and the plan of its fields in front of them. The argument is the slug of the game, or its name; ask if there is none.

The rules of the fields (kinds, categories, order, don'ts, guards) are not repeated here: `game-sanity-create` is their only copy.

When this skill runs as a sub-agent of `/add-game`, it cannot ask the owner: every question below goes back to the orchestrator as `STATUS: questions`, with the default it recommends, and the explicit yes of step 3 is sent to it before step 4.

## 1. Where is the game?

Look before asking.

- No `games/<slug>`: the whole flow, from step 2.
- `games/<slug>` exists and its entry in `packages/games/src/registry.ts` still says `sanityProjectId: "__SANITY_PROJECT_ID__"`: an earlier run stopped half-way, or only `pnpm new-game` was run. `pnpm new-game` refuses an existing slug, so never run it again: run what is left, in order (`pnpm go-live <slug>`, then `pnpm game-rules <slug> --rules <lang>=<file.pdf>` for each rulebook, then `pnpm setup-env`), then go to step 5.
- A project id of the right shape is not a project: the ids of the games that came with the old standalone repositories are those of projects that are gone (their Studio says `Project with ID "<id>" not found`), and `pnpm go-live` stops on one. Ask Sanity first, it changes nothing: `pnpm check:game <slug> --only scaffold --online`.
  - It passes (the project's production dataset answers): the project is there. Go to step 5.
  - It fails with "is not found": the project is gone and the game needs a new one. Steps 3 and 4 below apply to it as they are, with one change: `pnpm go-live <slug> --new-project` makes the project anew, with its dataset, CORS, token and Studio, and writes its id over the old one in the registry, the Studio's files and `content/config.ts` (the game's `CLAUDE.md` still names the old id: change it by hand), then `pnpm game-rules` and `pnpm setup-env`, then step 5. Without the flag `go-live` stops on a dead id and makes nothing. In `/add-game` this is the step's repair round: `pnpm game-flow begin <slug> game-new` opens it for a game that has its folder when the gate's check (`check:game <slug> --stage scaffold --online`) fails, its brief says what fails and not to run `pnpm new-game`, and the step is validated by that same check once the project is made.

## 2. Ask first, create nothing

**One batch**, each question with a recommended default so that "ok" is enough, in the language the owner writes in. What `/add-game` handed over is not asked again.

1. **Name and address.** The name the hub prints, and the slug (`playboardgamesonline.app/<slug>`). Default: the slug the name makes (The Crew → `the-crew`). The slug is lowercase letters, digits and hyphens, free, and not a route of the app: `packages/games/src/slug.ts` is the one definition, `slug.test.ts` keeps it, and `pnpm new-game` reports a problem in a sentence before it makes anything.
2. **Rulebooks.** One PDF per language (`fr`, `en`, `es`, `de`), as absolute paths: a relative path is read from where the command is typed. Default: the PDFs the owner has (from `/add-game`, the rulebook it fetched is `~/Companies/PBGO/assets/<slug>/rules.pdf`, English when the scout found an English one); none is fine (`pnpm game-rules` adds one later, whatever its size).
3. **Issue and branch.** The Linear issue the game's first pull request names (from `/add-game`, the issue of this step, never the parent); the branch is named after it (`gam-<n>-<slug>`), cut from `origin/main` (`git fetch && git switch -c <branch> origin/main`, then `git branch --unset-upstream`). Default: the issue the owner names, else offer to create it.
4. **Commit.** Nothing is committed or pushed by the scripts. Default: one commit that carries the game and, later, the fields, ending with the usual `Co-Authored-By` line. The rules spec that an earlier step left in the working tree, uncommitted (`docs/games/<slug>/`), goes into that first commit with the game.

## 3. Check, show what leaves the machine, then wait

These change nothing:

```bash
bash scripts/setup-env.sh --check
git branch --show-current
git diff --name-only origin/main...HEAD -- supabase/migrations
node --disable-warning=ExperimentalWarning packages/content-kit/src/rulebook-bin.ts check --rules en=/abs/rules.pdf --rules fr=/abs/regles.pdf
```

`setup-env --check` says which setting is missing (Supabase values, the Vercel team) before anything is created; stop on it and tell the owner. The last line reads each PDF and says what it is (nothing is sent, no token): leave it out when there is no rulebook. When the branch is not `main`, `git diff` must print nothing, or `pnpm setup-env` would apply an unmerged migration to production: if it prints something, stop and tell the owner.

Say plainly what the real run does outside the repo: it creates a Sanity project named after the slug (5 new projects an hour at most; for a game whose project is gone, the same, with `--new-project`) with its public `production` dataset and CORS, creates a write token that goes into `apps/web/.env.local`, deploys the Studio at `https://<host>.sanity.studio`, puts the rulebooks in the draft of Settings, applies the pending Supabase migrations to the preview project then to production, and pushes the variables of `apps/web` to the Vercel project `pbgo`. None of it is easy to undo.

Wait for a clear yes in chat. An ok to "make the game" or to the plan is not an ok to these effects.

## 4. Create

Four scripts, in this order, each run only when the one before succeeded (`go-live` needs the folder, `game-rules` needs the Sanity project it makes, `setup-env` needs both):

```bash
pnpm new-game <slug> --name "<Name>"
pnpm go-live <slug>
pnpm game-rules <slug> --rules en=/abs/rules.pdf --rules fr=/abs/regles.pdf
pnpm setup-env
```

`new-game` makes `games/<slug>` from the template and registers it with `live: false` and `indexable: false`. `go-live` makes or finds the Sanity project, its dataset, CORS, the write token and the deployed Studio; it can be run again, every step already done is skipped, and its last lines give the Studio's address. It asks Sanity about an id that is already in the registry, and about a write token that is already in `apps/web/.env.local`: a token that the project does not take is replaced by a new one. `game-rules` is for the rulebooks only: leave it out when there are none. `setup-env` applies the migrations and pushes the environment.

A step that fails stops what needs it: when `new-game` or `go-live` fails, stop and say why; when `game-rules` or `setup-env` fails, still run the other, then say what is left to fix and which command to run again once the cause is dealt with. Never run a step again that succeeded, except `go-live`.

Then check the result. `go-live` ends its Studio part with `✓ Studio: https://<host>.sanity.studio` when `sanity deploy` worked (the host is the slug unless `games/<slug>/apps/studio/sanity.cli.ts` names another). The Studio's address answers 404 to `curl` even when it is deployed, so a request to it proves nothing; the check is the gate of the step, which also asks Sanity whether the game's project is there:

```bash
pnpm check:game <slug> --stage scaffold --online
```

What exists afterwards: `games/<slug>` from the template, registered with `live: false` and `indexable: false`; the Sanity project; its Studio with the shared singletons (Identity & Mechanics, Visual, Audio, Copy), the template's `game` document in tabs (Board, Card backs) and `studio-forms.test.ts`; the rules PDFs in the **draft** of Settings (Mechanics tab).

Give the owner the Studio link and `pnpm dev` → `http://localhost:3100/<slug>`.

## 5. Propose the fields

Hand over to `game-sanity-create` from its section 1: read the rulebook (the PDF the owner gave, with `pages` for a long one), ask its batch of questions with defaults, give the plan as a table and wait for the ok. No schema before it.

A rulebook added later: `pnpm game-rules <slug> --rules fr=regles.pdf` (`--dry-run` first, `--overwrite` to replace one). Like the first ones it goes into the draft of Settings, which is what the Studio shows, whatever its size. The gamemaster's Mechanics page takes a PDF too, up to 4.4 MB (Vercel's body limit).

## Don'ts

- Never run `pnpm go-live` or `pnpm setup-env` to try them: they create a Sanity project and push variables to Vercel. `setup-env --check` and `rulebook-bin.ts check` are the safe ones.
- Nothing is published: the owner publishes in the Studio. The game stays `live: false` and `indexable: false` until the owner sets them in the registry.
- No token is printed or written anywhere but `apps/web/.env.local`; env files, `.sanity-project-id` and `.vercel` stay out of every commit.
- Never push without the owner's ask, and never merge.

## Checks

The pieces are tested, none of them by running the scripts for real: the slug and the name in `packages/games/src/slug.test.ts` and `registry.test.ts`, the rulebooks in `packages/content-kit/src/rulebook.test.ts` and `rulebook-cli.test.ts`. The gate of the step is `pnpm check:game <slug> --stage scaffold --online`; the guard of the fields is `game-sanity-create`'s (`studio-forms.test.ts`).
