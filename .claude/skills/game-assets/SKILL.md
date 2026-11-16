---
name: game-assets
description: "[GAME agent] Bring a game's own art into its own Sanity project: from the component list of its rules spec and the art slots of its seed, sort the owner's source files (a folder they point to, or the images of its rulebook or press kit with their approval) into the agreed art folder, each named after its slot, dry-run the game's seed, and upload as drafts after the owner's yes; the owner then previews in the game's Studio and in local dev. Never makes, edits, crops or upscales a picture. Runs in a session of the owner's own. Use after game-sanity-create, or when the owner runs /game-assets <slug>."
---

# Bring a game's art into its Sanity project

The step between the Studio's forms (`game-sanity-create`) and the board (`engine-board`): the game's own art, its cards, boards, tokens, backgrounds and sounds, gets into the game's own Sanity project, where the board reads it. The seed does the work (`docs/content-pipeline.md`, "Art"): it takes the files someone gives it, named after their slots; this skill sorts and names them, shows what would happen, and uploads after the owner's yes. The job ends when the art the owner handed over is in the drafts of the game's Studio and the owner has looked at it there and in local dev. It uploads, so it runs in **a session where the owner approves each command** (`pnpm add-game` opens one for it): never headless.

The argument is the game's slug (`pnpm add-game` gives it); ask if there is none. The owner hands every asset over: **never make a picture**, no SVG drawn, no image generated, no animation, no sound.

## What the owner decides, and the default

1. **Where the art is.** A folder of their own files (default: ask for its path), or `~/Companies/PBGO/assets/<slug>` where it already is. Extracting the images of the rulebook or of a press kit is possible with their approval and with a tool they approve (nothing is installed without asking); default: they hand the files over.
2. **Which slots.** The ones the game's seed defines, set against the component list of its rules spec (`docs/games/<slug>/rules.md`, when there is one). A component with art and no slot, or a slot with no component, is a gap to tell, not to fix here: `game-sanity-create` owns the slots.
3. **A slot with no file.** Stays empty, and the board uses a plain placeholder from the page's own tokens until the owner hands one over.
4. **Publisher visuals.** Not the platform's to publish without the owner's word (`docs/content-pipeline.md`): the yes of step 6 is that word, asked before anything is uploaded, and where each file comes from goes to `SOURCES.md`.

## 1. Where is the game?

`pnpm check:game <slug>`: `scaffold` must pass, and `games/<slug>/content/seed.ts` must exist. If not, stop and say which skill comes first (`game-new`, then `game-sanity-create`).

## 2. The slots and the components

The slots are what the seed says it takes: run it without writing anything (a dry run is the default) on the folder the art will be in:

```bash
pnpm -C games/<slug> content:seed --dry-run --art-dir ~/Companies/PBGO/assets/<slug>
```

Give an absolute path (the shell expands `~`). Its "Art" section lists the slots, which have a file, which have none, and the files that match no slot. Read the component table of the rules spec and set the two side by side: one line per slot, with the component it is for.

## 3. The source files

Ask the owner for the folder that holds their files. Look at it (`ls`, `file`, `sips -g pixelWidth -g pixelHeight`), and propose, as one table, which file fills which slot: name, pixels, slot. The owner corrects it. The seed reads the **top level** of `~/Companies/PBGO/assets/<slug>` only, and names are matched case-blind with spaces and underscores as hyphens (`Card_Red 3.PNG` is `card-red-3.png`); a file in a sub-folder is copied next to the others. Never move, rename, edit or delete one of the owner's originals: copy (`cp`) each file into the folder, named after its slot, and never over a file that is there already. Several files for one slot stop the seed: keep one.

Images that are inside the rulebook or a press kit: only when the owner asks, with the tool they approve (`pdfimages` of poppler or PyMuPDF, `unzip`), the image as it is embedded, never a page rendered and cropped. List what is there before extracting anything.

## 4. Say where each comes from

Write `SOURCES.md` in `~/Companies/PBGO/assets/<slug>/`: for each file its slot, its name, where it came from (the owner's folder, the rulebook page, the press kit), the day (`date +%F`) and its pixels. The seed does not know where an image comes from, so this file is where it is kept.

## 5. The dry run

Run the seed again as in step 2. Fix what it says: a name with a typo, a file that matches no slot, proportions off by more than 3 % (a warning: say it, and ask whether to keep the file). Do not go on while a slot the owner wants is missing or a file is wrong.

## 6. Ask, then wait

Show what the next command does: it uploads these N images to the game's own Sanity project (a public dataset) and puts them in the **drafts** of its documents; nothing is public until the owner publishes. Wait for a clear yes. A yes to something else, an answer that mixes a yes and a change, or silence is not one.

## 7. Upload as drafts

```bash
pnpm -C games/<slug> content:seed --apply --art-dir ~/Companies/PBGO/assets/<slug>
```

The command reads the write token itself: never read it, never print it. A picture that is already placed is kept (the report says "Kept as edited in Sanity"); replacing one is `--overwrite --only <id>`, which replaces every value of that document that differs from the seed: read the dry-run list first and ask.

## 8. The gate: look at it

Give the owner the two places to look: the game's Studio (`https://<host>.sanity.studio`, the `studioHost` of `games/<slug>/apps/studio/sanity.cli.ts`), where the drafts are, and, once they have published the documents there, `pnpm dev` and `http://localhost:3100/<slug>`. A draft is not read by the game: the owner publishes in the Studio, or hands the publishing over to the agent (`game-go-live`, step 2, item 1).

`pnpm add-game` runs the seed's dry run once more when the owner leaves the session and again when they validate, and shows its "Art" part at its gate: the step is validated for a game whose seed can run, and the owner may leave slots empty.

Print this, in the owner's language, and stop:

```
Sample Game (sample-game): art
Placed      24 of 26 slots: 21 card faces, the back, 2 backgrounds
Missing     card-front-9 and card-front-10: no file (the board keeps a placeholder)
Warnings    background.png is 4:3, expected 16:9: kept, the owner said so
Sources     ~/Companies/PBGO/assets/sample-game/SOURCES.md
Drafts      https://sample-game.sanity.studio
Look at     the drafts in the Studio, then http://localhost:3100/sample-game after publishing
```

## Don'ts

- Nothing uploaded without the yes of step 6, nothing published by code unless the owner handed that over.
- Never make, edit, crop, recolour, upscale or convert a picture, and never touch the owner's originals.
- No `--overwrite` without `--only` and the owner's yes; no `content:seed` of another game; no write in the repo, no commit, no push.
- No token printed or read from a file.

## Tools

`Read`, `Write` (`SOURCES.md` only), `Bash` (`pnpm check:game`, `pnpm -C games/<slug> content:seed`, `ls`, `file`, `sips`, `cp`, `mkdir -p`, `date`, and the extraction tools the owner approved), `WebFetch` for a press kit's page.

## Checks

The flags this file names are the seed's (`packages/content-kit/src/cli.ts`, kept by `packages/content-kit/src/game-assets-skill.test.ts`); the folder layout is the one of `docs/content-pipeline.md`.

## Hand over

Say what is in and what is missing, and the next step: the engine and the board (`engine-rules`, then `engine-board`) read these assets and show a plain placeholder for the slots that have none.
