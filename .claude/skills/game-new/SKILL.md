---
name: game-new
description: "[GAME agent] Start a new game from nothing. Asks the owner the name and the rulebook PDFs, shows what pnpm add-game would create (code from the template, Sanity project, Studio, rules PDFs, environment) and runs it only after an explicit ok, then hands over to game-sanity-create for the fields. Use when the owner wants a new game, or runs /game-new <slug> after pnpm add-game."
---

# Start a new game

The script does the plumbing (`scripts/add-game.sh`), the agent asks the questions and shows what leaves the machine, and the fields of the Studio are proposed from the rulebook before anything is built. The job ends when the owner has the Studio open and the plan of its fields in front of them. The argument is the slug of a game `pnpm add-game` already created, or the name of a game to create; ask if there is none.

The rules of the fields (kinds, categories, order, don'ts, guards) are not repeated here: `game-sanity-create` is their only copy.

## 1. Where is the game?

Look before asking.

- No `games/<slug>`: the whole flow, from step 2.
- `games/<slug>` exists and its entry in `packages/games/src/registry.ts` still says `sanityProjectId: "__SANITY_PROJECT_ID__"`: `add-game` stopped half-way, or only `pnpm new-game` was run. It refuses an existing slug, so never run it again: run what it printed under "Left to fix" (`pnpm go-live <slug>`, then `pnpm game-rules <slug> --rules <lang>=<file.pdf>` for each rulebook, then `pnpm setup-env`), then go to step 5.
- A real project id: the owner ran `pnpm add-game` themselves. Go to step 5.

## 2. Ask first, create nothing

**One batch**, each question with a recommended default so that "ok" is enough, in the language the owner writes in.

1. **Name and address.** The name the hub prints, and the slug (`playboardgamesonline.app/<slug>`). Default: the slug the name makes (The Crew → `the-crew`). The slug is lowercase letters, digits and hyphens, free, and not a route of the app: `packages/games/src/slug.ts` is the one definition, `slug.test.ts` keeps it, and `--dry-run` reports a problem in a sentence.
2. **Rulebooks.** One PDF per language (`fr`, `en`, `es`, `de`), as absolute paths: a relative path is read from where the command is typed. Default: the PDFs the owner has; none is fine (`pnpm game-rules` adds one later, whatever its size).
3. **Issue and branch.** The Linear issue of the game; the branch is named after it (`gam-<n>-<slug>`), cut from `origin/main` (`git fetch && git switch -c <branch> origin/main`, then `git branch --unset-upstream`). Default: the issue the owner names, else offer to create it.
4. **Commit.** `--push` makes the script commit the new game alone and push the branch. Default: no, so the commit carries the fields too and ends with the usual `Co-Authored-By` line.

## 3. Show what leaves the machine, then wait

A tool call is not a terminal: the script asks nothing and opens no browser. Its `--dry-run` runs every check (the settings of `setup-env --check`, the name and the slug, the PDFs read) and prints the summary, creating nothing:

```bash
pnpm add-game --name "<Name>" [<slug>] --rules en=/abs/rules.pdf --rules fr=/abs/regles.pdf --dry-run
```

Relay the summary in the owner's language, and say plainly what the real run does outside the repo: it creates a Sanity project named after the slug (5 new projects an hour at most) with its public `production` dataset and CORS, creates a write token that goes into `apps/web/.env.local`, deploys the Studio at `https://<host>.sanity.studio`, applies the pending Supabase migrations to the preview project then to production, and pushes the variables of `apps/web` to the Vercel project `pbgo`. None of it is easy to undo.

When the summary warns that the branch is not `main`, check that it carries no unmerged migration: `git diff --name-only origin/main...HEAD -- supabase/migrations` must print nothing, or production would get the migration before it is merged. If it prints something, stop and tell the owner.

Wait for a clear yes in chat. An ok to "make the game" or to the plan is not an ok to these effects.

## 4. Create

The same command with `--yes` instead of `--dry-run`:

```bash
pnpm add-game --name "<Name>" [<slug>] --rules en=/abs/rules.pdf --rules fr=/abs/regles.pdf --yes
```

It runs `new-game`, `go-live`, the rules PDFs, `setup-env`, then checks the Studio is deployed. A step that fails does not hide the others: the run ends with "Left to fix" and a command per problem. Tell the owner, and run those commands once the cause is fixed.

What exists afterwards: `games/<slug>` from the template, registered with `live: false` and `indexable: false`; the Sanity project; its Studio with the shared singletons (Identity & Mechanics, Visual, Audio, Copy), the template's `game` document in tabs (Board, Card backs) and `studio-forms.test.ts`; the rules PDFs in the **draft** of Settings (Mechanics tab).

Give the owner the Studio link (`https://<host>.sanity.studio`, printed under "Your turn") and `pnpm dev` → `http://localhost:3100/<slug>`.

## 5. Propose the fields

Hand over to `game-sanity-create` from its section 1: read the rulebook (the PDF the owner gave, with `pages` for a long one), ask its batch of questions with defaults, give the plan as a table and wait for the ok. No schema before it.

A rulebook added later: `pnpm game-rules <slug> --rules fr=regles.pdf` (`--dry-run` first, `--overwrite` to replace one). Like the first ones it goes into the draft of Settings, which is what the Studio shows, whatever its size. The gamemaster's Mechanics page takes a PDF too, up to 4.4 MB (Vercel's body limit).

## Don'ts

- Never run `pnpm add-game`, `pnpm go-live` or `pnpm setup-env` to try them: they create a Sanity project and push variables to Vercel. `add-game --dry-run` and `setup-env --check` are the safe ones.
- Nothing is published: the owner publishes in the Studio. The game stays `live: false` and `indexable: false` until the owner sets them in the registry.
- No token is printed or written anywhere but `apps/web/.env.local`; env files, `.sanity-project-id` and `.vercel` stay out of every commit.
- Never push without the owner's ask, and never merge.

## Checks

The pieces are tested, none of them by running the script for real: the slug and the name in `packages/games/src/slug.test.ts` and `registry.test.ts`, the rulebooks in `packages/content-kit/src/rulebook.test.ts` and `rulebook-cli.test.ts`. The guard of the fields is `game-sanity-create`'s (`studio-forms.test.ts`).
