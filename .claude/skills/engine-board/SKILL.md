---
name: engine-board
description: "[ENGINE agent] Hand a game's engine to the app and draw its board on @pbgo/table. Wires `GAME` and the error codes into the binding, adds the three binding tests, composes the board from the blocks of the table, tunes it with the debug panel, and checks it in a browser with two seats and on a phone, until `pnpm check:game <slug> --stage board` passes. Use when a game's engine passes its gate and the game must become playable."
---

# Mount a game's board

The binding is what hands the engine, the look and the board to the app; the board is the 3D scene a table is played on, made of the blocks of `@pbgo/table`. The job ends when the game is playable outside production with two seats, `pnpm check:game <slug> --stage board` exits 0, and the pull requests say how it was checked. The files and their rules are in `docs/engine/04-build-a-game/` ([Wiring it in](../../../docs/engine/04-build-a-game/05-wiring-it-in.md), [Composing a board](../../../docs/engine/04-build-a-game/04-composing-a-board.md), [Tuning](../../../docs/engine/04-build-a-game/07-tuning.md)); the blocks are in [Components](../../../docs/engine/02-components/index.md). The argument is the slug; ask if there is none.

## 1. Where is the game?

Look before asking: `pnpm check:game <slug>`.

- `engine` fails: the rules are not done. Stop and run `engine-rules`.
- `binding` fails: start at step 3. `binding` passes and `board` fails: start at step 4.
- Read the game's `CLAUDE.md` (the plan: the blocks table, the glossary) and `games/flip-7` or `template/` for a model; a board's files are **copies** of the template's, so a later change to the template does not reach a board that exists.

## 2. Ask first, draw nothing

One batch, each question with a recommended default so that "ok" is enough, in the language the owner writes in.

1. **Art.** What pictures and sounds the game's Sanity already holds (read a whole document of the type and list the assets before saying that one is missing). Default: use what is there. **Never make an image, an SVG, an animation or a sound**: the owner hands every asset over. Until they do, a plain placeholder from the page's tokens, and the plan says where the real one goes.
2. **Colours.** Default: the game's `settings.theme`, `skin.playerColors` and fonts, set in `/gamemaster/<slug>`, and no hex in the board, so that the owner can change them without code.
3. **What the table shows.** From the plan's blocks table: where each zone lies (hands, piles, markets, tracks, the middle), how many seats, which camera. Default: the layout of the template, moved to the game's own zones.
4. **What is written.** Words and the sentences of the history come from the game's Sanity (`texts`), by key, in English first. Default: the keys the engine's events name, one line each.
5. **Aids and sounds.** Default: none, until the game is playable and the owner asks.

Give the owner the plan of the board as a table (zone, block, what a player can press there) and wait for the ok.

## 3. The binding

One pull request, before any board. In `games/<slug>/`:

- `package.json`: the engine, `@<slug>/engine`, is a **dependency** of the binding, since `src/index.ts` imports it at runtime (`check:game` fails on a dev dependency), and `@pbgo/engine-kit` a dev dependency, for the `testing` entry the tests import. `pnpm install` rewrites the lockfile: it is part of the pull request.
- `src/index.ts` re-exports `GAME` from the engine; `src/lib/site.ts` lists the engine's own error codes in `ERROR_CODES` and only those: what the engine throws minus `SHARED_ERROR_CODES` of the kit, which the platform words. Flip 7 throws seven codes and lists one (`error-codes.test.ts` says which is which: do not list from the notes).
- The message of each listed code is a draft in the game's seed (`errorMessages` of `content/data/texts.ts`: `_key` is the code, as the Copy page keys it, four languages, the Spanish and German for the owner to read), with a parity test that keeps the seed and `ERROR_CODES` equal. A code with no message reads `[missing: errorMessages.<CODE>]`.
- **`vitest.config.ts` must include `src/**/*.test.ts`** (and `content/**/*.test.ts` where the game has a seed). The older games ran only `content/**`, so tests added to `src` would have passed by never running; `check:game` fails on it.
- The three binding tests, copied from the template and adapted: `src/conformance.test.ts` (with the game's `secretsFor`; if the engine step ran the suite from the engine package, **move** it here: it plays whole games and takes 15 s a time, so two copies cost twice for nothing), `src/takeover.test.ts` (only its `humanMove` knows the game: give the game the shortest length its option allows so that it ends fast, and assert what holds for every seed, the game ends, each absent player was played for, everybody has a result, rather than counts of moves) and `src/error-codes.test.ts`. All three green: `pnpm --filter @pbgo-game/<slug> test`.
- In the Studio, the guard of the forms: `apps/studio/studio-forms.test.ts` with the `test` script, the `vitest` and `@pbgo/content-kit` dev dependencies and `allowImportingTsExtensions` in the tsconfig, all of them the template's: a guard with no `test` script never runs (`check:game` fails on it).
- Not in this pull request: `DEFAULT_SKIN` and `UI_THEME`. The look is the board's, where the owner is asked for the colours (step 2); the shared in-game UI keeps the platform's own look until then.
- Until the board exists `src/ui.tsx` exports `Logo` alone. **A binding that exports `GAME` and has no `Game` is playable outside production up to a table that never loads** ([How an engine is wired in](../../../docs/engine/04-build-a-game/05-wiring-it-in.md#exporting-game)): the page of a started table reads "Loading the table" for as long as it stays open after a debug start, and after a normal start nobody can press "I'm here" without a board, so the check gives up after a minute and takes everybody back to the game's page. Only previews and local development see it, since in production a game that is not `live` stays "coming soon". The pull request says so, and the board follows before anyone is asked to try a preview.
- Check it for real before the pull request, through the API as step 6 says: create, join, start with the debug route, one legal move, one refused with `NOT_YOUR_TURN`, `over` to see the results. It proves that the registry loads the binding and that the routes accept the game's actions.

## 4. The board

Start from `template/src/components/board/` (`scene.tsx`, `layout.ts`, `camera.ts`, `textures.ts`, `glows.ts`, `layout.test.ts`) and replace what is the demo's. Slices, each a pull request:

1. **The table with what is static.** The seats, the zones, the cards or pieces in place, from a view.
2. **What a player can do.** Each press calls a handler and `onUpdate` posts the action; the board holds no rule and sends intents.
3. **What happens to others.** The events of the log turned into motion and into sentences.
4. **The edges.** Game over, an absent player, a reload in the middle of a game.

The rules of a board (the last page of [Components](../../../docs/engine/02-components/index.md), "Rules of the board", and the in-game rules in `docs/design/01-guidelines/04-in-game-rules.md`):

- A block exists for it: use it. A thing no block holds is a gap for the engine lane, written in the plan, not a copy in the game ([Not built yet](../../../docs/engine/03-not-built-yet.md)).
- `@pbgo/table` and three.js are imported from the board folder only (`check:game` fails on it), and `src/ui.tsx` loads `Game` with `dynamic`, so the hub carries none of it.
- The scene is a function of the view: the same view gives the same poses on every client, and a pose never calls `Math.random`.
- No word in code: texts, translations and labels come from Sanity. No picture, sound or text kept in `apps/web/public`.
- The screen around the table (HUD, players, chat, the menu) is core's: do not redraw it. In the board, only what lies on the table.
- A visitor who asks for less motion gets it from the table; do not add animation of your own that ignores it.

## 5. Tune

The debug panel and the settings objects of each block ([Tuning](../../../docs/engine/04-build-a-game/07-tuning.md)) tune the feel on the real board; it never runs in production. A change that must not change the look (a refactor, a copy of a template file) is checked with the same screenshot before and after, taken in the same headless browser at the same size.

## 6. Check it in a browser

Every pull request is checked, and says how.

- **Two seats need two hosts.** `http://alice.localhost:3100` and `http://bob.localhost:3100` have separate cookies and storage; `127.0.0.1` serves the page but does not hydrate. `pnpm dev <slug>` prints the address. Say which Supabase project `.env.local` points at before creating a table: previews and local development use `pbgo-preview`.
- **Drive a table without the screen** when a flow is long: from each host, `POST /api/<slug>/games` makes the table, `…/<code>/join` seats the guest and `…/<code>/debug` with `{ "command": "start" }` starts it (outside production only).
- **Play a whole game**: lobby, start, the ready check, every phase of a turn, the end, the rematch. Then reload in the middle of a game; leave a seat and let the others take over; open a third tab as a spectator.
- **A phone and a finger**: 390 wide, with touch, nothing scrolling sideways, every control reachable. Then reduced motion on.
- **Pixels need frames.** The Browser pane of the app does not paint while the session is out of view; for a check of the 3D board drive a headless Chromium over the DevTools protocol.
- **No screenshot in a pull request**: write what was checked and what was seen.

## 7. Hand over

- `pnpm check:game <slug> --stage board` exits 0, and the six gates of the repo pass from the root: `pnpm check:catalog`, `check:public`, `typecheck`, `lint`, `test`, `build`.
- The plan in `CLAUDE.md` is true again: the board's zones, the keys it asks of Sanity, the friction with the table's blocks.
- Say what is left: the texts and pictures in the game's Sanity (`game-sanity-create`, and the owner's assets), then `game-go-live`.
