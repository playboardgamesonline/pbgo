---
name: game-go-live
description: "[GAME agent] Put a finished game live. Checks that every earlier stage passes (`pnpm check:game <slug> --stage content`), that the content, the catalog entry and the environment are ready, plays the game on the preview, then flips `live` and `indexable` in the registry in a pull request and verifies production once it is merged. Use when a game is playable and its content is in Sanity and the owner wants it online."
---

# Put a game live

Going live is two switches, `live` and `indexable`, in `packages/games/src/registry.ts`, and everything that must be true before they are turned. The job ends when the game is playable in production and the hub lists it. Nothing here is hurried: the registry is the last thing to change. The argument is the slug; ask if there is none.

## 1. Is it ready?

`pnpm check:game <slug> --stage content` must exit 0: the entry and its Sanity project, an engine of its own, `GAME` exported, the binding's tests, a board that loads lazily, the Studio's guard of forms. Each failure names the skill that does the step (`engine-rules`, `engine-board`, `game-sanity-create`). Then the six gates of the repo from the root (`pnpm check:catalog`, `check:public`, `typecheck`, `lint`, `test`, `build`).

## 2. What only a person can say

Ask the owner one batch, each question with its default, and wait for the answers: nothing goes live on a guess.

1. **The content is published.** The seed writes drafts and the owner publishes them in the Studio; nothing is published from code. Default: the owner publishes now, and the agent reads back what the hub will show.
2. **The words and the art are theirs.** Every text in the languages the game ships in, and the pictures and sounds handed over: no placeholder is left on the board, and a translation the agent wrote itself is flagged for the owner to read. Default: English and French; the others later.
3. **The catalog entry.** The game's published `game` in the platform's Sanity project (`docs/platform-sanity.md`): name, logo, icon, background, description, players, duration, the rulebook links. `pnpm catalog:list` shows what the hub would list and which games of the Studio it leaves out and why: the game must be listed.
4. **The environment.** The game's write token is on the Vercel project (`pnpm setup-env --check` says; the owner runs `pnpm setup-env` from an up-to-date `main`), so that its page of the gamemaster works in production.
5. **Personal data.** A game that keeps anything new about its players changes the legal pages and their inventory in the same pull request (`docs/legal.md`). Default: nothing new.

## 3. Play it on the preview

Every pull request has a preview. On it, with two browsers (two private windows have separate cookies), play a whole table: the game's page on the hub, create, join, start, the ready check, a whole game, the end. The preview points at `pbgo-preview`. Check a phone too. Fix what shows before going on.

## 4. Flip the switches

One small pull request, named after the issue: in `GAMES`, `live: true` and `indexable: true` for the game, and nothing else ([`live` and `indexable`](../../../docs/engine/04-build-a-game/05-wiring-it-in.md#live-and-indexable)). Only a live game can be indexable, and a live game needs a real Sanity project id: `registry.test.ts` keeps both. The owner reads it and merges it; nobody merges their own.

## 5. Check production

After the merge and the deployment, with requests that change nothing:

- `/<slug>` shows the hub page of the game with its play button, no longer "Coming soon".
- `/sitemap.xml` lists `/game/<slug>`, and the page has no `noindex`.
- The game's API answers for the game (`/api/<slug>/games/…`) instead of `GAME_NOT_FOUND`.
- The share image and the metadata of the page are the game's own.

**The owner plays the first table in production.** An agent does not create accounts or tables on the live service.

## 6. Hand over

Say what was checked and what is left: the announcement (an entry of the platform's editorial, the owner's to write), the other languages, the expansions, each as its own work. Update the plan in the game's `CLAUDE.md` with the date, and ask before closing the game's issues in Linear.
