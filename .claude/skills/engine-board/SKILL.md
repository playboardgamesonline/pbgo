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
- The controls lie in the middle band of the table, never in the bottom strip that the cookie banner covers (`docs/design/01-guidelines/04-in-game-rules.md`): a paper laid in front of the viewer's line is pressed through the banner.
- A card that lies face down shows no glow: the halo and the outline face the card's face, and the shine, the frame and the sparkle lie on it. To make a pile glow, turn its top card up with the back as its picture (`top.front` of `Pile`), as `games/flip-7/src/components/board/scene.tsx` does.
- A game with a range of seats (3 to 8) has its knobs for both ends and goes between them (`tableOf` in `games/flip-7/src/components/board/layout.ts`): one ring crowds the full table or leaves the small one empty. Check the fewest, a middle one and the most seats from the first slice.
- Fit the camera to the window, not to a laptop: the platform draws boxes over the board (the log of the turns, the menu, the list of the players) that hide the seats of a fixed camera in a smaller window or with more seats. List what must stay in view and clear of them as rectangles (`tableFootprints`), and stand the camera as near as it can with all of it in the window (`fitCamera` in `camera.ts`). The rig backs the camera off below a 16:10 window (`aspectScale`, exported by `@pbgo/table`): fit with the distance it really stands at.
- A move that turns over several cards (a Flip Three, the opening deal) is paced from the lines of the log: give each card of the last move its own `from` with a `delay` taken from the order of the events, not the `stagger` of a zone, which is a card's place in its list and makes a card that comes alone wait for its rank. Hold back what the move ends with, the announcements and the words under a seat, until it has played out, and let a table that is opened or reloaded play nothing (`games/flip-7/src/components/board/pacing.ts` and `game.tsx`, [Events and the log](../../../docs/engine/01-the-game/12-events-and-the-log.md)).

## 5. Tune

The debug panel and the settings objects of each block ([Tuning](../../../docs/engine/04-build-a-game/07-tuning.md)) tune the feel on the real board; it never runs in production. A change that must not change the look (a refactor, a copy of a template file) is checked with the same screenshot before and after, taken in the same headless browser at the same size.

## 6. Check it in a browser

Every pull request is checked, and says how. `pnpm check:board <slug>` does what a machine can of it (`docs/scripts.md`, "`pnpm check:board` in full"); the rest is for a person or an agent, and the pull request says what was seen.

- **Run it.** `pnpm dev <slug>` in one terminal, then `pnpm check:board <slug>` in another, in the background: every check at three counts of seats takes about twenty minutes, and `--players 3`, `--checks sizes` or `--scenarios bust` cut it to what changed. It needs a Chromium in Playwright's cache (`npx playwright install chromium`) and ffmpeg (`brew install ffmpeg`), names the Supabase project the server writes to before it opens a table (`pbgo-preview`: previews and local development) and refuses production. It is no part of the six gates. Read `report.json` for the problems (they fail the run) and the warnings (to look at), then **look at the sheets** it wrote: it measures, it does not judge a picture.
- **Write the game's `check-board.config.mjs` from the second slice on** (`games/flip-7/check-board.config.mjs` is the model; the keys are in `docs/scripts.md`): how its seats play (`bot`), the situations to photograph in every window (`scenes`), what the viewer presses and where (`presses`: `plan` says what is next, `find` picks the control from what the board offers, so no coordinate is copied from the layout), and the cases that `GAME.debug` can rig (`scenarios`). With no file the tool still checks what is the platform's: a board that draws, the windows, the engine's `turn` and `over`, a reload, the start, a player who is away.
- **Press what a player presses** (`presses`). The board has to offer a control for each thing a player can do, at a pixel that a pointer reaches, and a press of it has to move the table (its version changes): a press that does nothing is a control under the banner, the HUD or another card, and the report names what lies over it. The other seats play through the API. List what a player presses in `plan` (the draw pile, a paper, a plate, a card of the hand) and rig the situations that are luck (`prepare`).
- **A move is checked in frames, not in a screenshot** (`scenarios`). A flight lasts under a second: the tool records the page with a screencast over the DevTools protocol and tiles nine frames from the first change of the page's text, and the cases are reached with the engine's debug commands (`GAME.debug`: rig the deck, `turn`, `over`) instead of playing until they happen. List in the config each action or special card, a bust, a save, and the end of a game; check them with the fewest and the most seats, once with `--reduced-motion`. `reload` is a reload in the middle of a game, where nothing flies in again; `opening` is the normal start with the ready check; `absent` leaves the other seats away for 85 s and presses the platform's "Play for them".
- **Every window the platform lets in** (`sizes`): from 900 px wide up, a laptop (1280 by 720 and 800, 1440 by 900), a big screen (1920 by 1080, an ultra-wide) and a tablet held across (1024 by 768) and upright (900 by 1200, 1024 by 1366), for the fewest, a middle and the most seats, on the viewer's turn and between two rounds (the config's `scenes`). The sheet has a window to a tile; no plate, line, pile or button under a box of the platform. `--sizes` changes the list.
- **A phone and a finger**: 390 wide, with touch, nothing scrolling sideways, every control reachable. Then reduced motion on. Below 900 px the platform covers the game pages with its desktop-only screen (`interface.desktopOnly`, true by default): when the game has not turned it off, say that the phone was not checked. The tool does not decide that: `--sizes 390x844` photographs whatever the page shows.
- **By hand** (a person, or the viewer's browser on `localhost` with the others through the API): **two seats need two hosts**: `http://alice.localhost:3100` and `http://bob.localhost:3100` have separate cookies and storage; `127.0.0.1` serves the page but does not hydrate. **The pictures come from the game's Sanity CDN, whose CORS lists `http://localhost:3100`, the production domain and the Studio only**: on `alice.localhost` every card reads a stand-in, so look at the board as the viewer on `localhost` and seat the others through the API: from each host, `POST /api/<slug>/games` makes the table, `…/<code>/join` seats the guest and `…/<code>/debug` with `{ "command": "start" }` starts it (outside production only). Say which Supabase project `.env.local` points at before creating a table. Lobby and rematch are not in the tool: play them once, with a visitor who does not sit at a started table getting "This game has already started" (there is no spectator).
- **Pixels need frames.** The Browser pane of the app does not paint while the session is out of view; the tool drives a headless Chromium over the DevTools protocol instead, and so can anything that has to look at the 3D board.
- **No screenshot in a pull request**: write what was checked and what was seen. The report and the sheets stay in the folder the tool wrote them to, outside the repo.

## 7. Hand over

- `pnpm check:game <slug> --stage board` exits 0, `pnpm check:board <slug>` has run with no problem (what it warned of is looked at, and the pull request says what was seen on the sheets), and the six gates of the repo pass from the root: `pnpm check:catalog`, `check:public`, `typecheck`, `lint`, `test`, `build`.
- The plan in `CLAUDE.md` is true again: the board's zones, the keys it asks of Sanity, the friction with the table's blocks.
- Say what is left: the texts and pictures in the game's Sanity (`game-sanity-create`, and the owner's assets), then `game-go-live`.
