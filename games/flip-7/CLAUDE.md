# Flip 7 · Play Board Games Online

Flip 7 (Eric Olsen, The OP Games), served by `apps/web` at `/flip-7`. The engine is written (ruleset 3.1 of the booklet) and so is the Sanity content, but the binding does not export `GAME` yet, so the game is not playable: without it, its home page says "coming soon" and its table pages answer 404. Listed nowhere until `live` is set in the registry. 3 to 18 players, about 20 minutes; the web edition is not official.

## Structure
- `package.json` — `@pbgo-game/flip-7`, the binding package that `@pbgo/games` loads on demand
  - `src/lib/site.ts` — `SLUG`, `asset()`, name, tagline, description, keywords, genres (player-facing copy in French)
  - `src/index.ts` — the binding shared by the server and the client: site constants and the default look (logo, icon, share image and colors), replaced by what is set in `/gamemaster/flip-7`. No `GAME` yet
  - `src/ui.tsx` — `Logo` · `src/runtime.tsx` — client runtime (styles, `BindingProvider`) · `src/server.ts` — server side (`SEO`)
- `packages/engine` — `@flip-7/engine`, the whole game: pure TypeScript on the engine-kit helpers, tested with Vitest (see Engine)
- `apps/studio` — `flip-7-studio`, Sanity Studio of the project `fj3grahy` (https://flip-7.sanity.studio). Its own document types (`cardType`, and the `game` singleton) are in `schemaTypes/`, the lists they share with the seed (card face keys, kinds) in `schemaTypes/constants.ts`
- `content/` — the Sanity content as versioned code (the game's data and config) and the seed script, run by the shared `@pbgo/content-kit` (see Content); `vitest.config.ts` runs its tests
- Static files: `apps/web/public/flip-7/` (served at `/flip-7/...`)

## Glossary (FR → EN)
manche → `round` · donneur → `dealer` · ligne (les cartes devant un joueur) → `line` · carte Nombre → number card · carte Bonus / Modificateur de score → `modifier` (`plus`, `times`) · carte Action → action card · Gel → `freeze` · Flip Three → `flip-three` · Seconde chance → `second-chance` · piocher / « encore » (Hit) → `hit` · rester / « stop » (Stay) → `stay` · bust (doublon, éliminé de la manche) → `bust`, status `busted` · mettre en banque → bank · joueur actif → active player (status `active`) · cible → `target` · Flip 7 (sept nombres différents) → `flip7` · pioche → `deck` · défausse → `discard` · score à atteindre → `targetScore`

## Engine (`packages/engine/src`)
- `types.ts` — `State`, `Frame`, `Status`, `Action` (`CLIENT_ACTIONS`), the views (`PlayerView`, `PublicPhase`, `PublicSeat`), the events (`Flip7Event`), the error codes (`FLIP7_ERROR_CODES`)
- `catalogue.ts` — `CARDS` (the 22 faces), `DECK` (their copies, 94 cards), `CATALOGUE` (the 94 cards, by face) · `scoring.ts` — the scores of the booklet (`lineScore`, `isFlip7`) · `options.ts` — `OPTIONS`
- `machine.ts` — what every rule is written with: `open` / `close` of a step, the cards and the lines, the scores, `waitingFor`, `targetsOf` · `round.ts` — how a round goes: `receive` (a card turned over), `giveCard`, `endRound`, `startRound`, `run`
- `actions.ts` — `hit`, `stay`, `chooseTarget`, `dealRound` and `step(state, action)`, the one entry point · `setup.ts` — `setupGame` · `autoplay.ts` — `autoPlayFor` · `results.ts` · `view.ts` — `playerView` · `debug.ts` · `game.ts` — `GAME` · `index.ts` — the exports (`@pbgo/engine-kit` too)
- `test-utils.ts` — helpers of the tests (`layout` builds a rigged table from the names of the cards), not exported

### How a game goes
- `step(state, action)` gives `{ state, events }`; `GAME.apply` keeps the state. The events (`Flip7LogEntry`) are for the platform to store: the state holds no log and the view none either (PLT-45). Nothing is hidden in Flip 7, so no entry has a `to` or a `masked`
- A step is `open` (a private copy of the state, the stream picked up where the last step left it), a few mutations, `close`. Nothing mutates its input, and there is no `Math.random` nor `Date.now`
- Lean state: ids and numbers only. A card is the opaque id it holds (`ids` of the engine-kit); its face comes from the catalogue, never stored. `deck` and `discard` are top first; every order comes from an array (`seats`, `lines`, the piles), never from the keys of an object (`jsonb`). `lines[seat]` are the cards in front of each player, in the order they came; `status[seat]` is `active`, `stayed`, `frozen` or `busted`
- The round is a stack of `Frame`s that the engine plays by itself until it needs a player (`run`): `deal` (the opening deal), `turn` (a player hits or stays), `flip` (a Flip Three on a player), `target` (a player holds an action card and chooses who gets it). A settled state is either an empty stack (between two rounds) or ends with a `turn` or a `target`: `waitingFor` is always one player, nobody once the game is over
- Between two rounds the next dealer deals (`deal`): the board shows the finished round (the lines stay in front of the players) until then. `isOver` and the winners come from the scores of the finished rounds (`rounds[round][seat]`, `sumRounds` of the engine-kit), never stored
- Everything is public but the order of the draw pile: the view gives its size and the faces it still holds (what the players could count themselves), never the id of one of its cards (tests check every field of the view)

### Rules as coded (booklet, ruleset 3.1)
- 94 cards: twelve 12s, eleven 11s … two 2s, one 1, one 0; +2, +4, +6, +8, +10 and x2 once each; three Freeze, three Flip Three, three Second Chance. 3 to 18 players. First to 200 at the end of a round wins
- Opening deal: one card face up to each player, the player on the left of the dealer first, the dealer last. An action card pauses the deal until it is played; then the first turn is the player on the left of the dealer
- A turn is one hit or one stay. A hit turns the top card over in front of the player; a number they already hold busts them (nothing scored, out of the round) unless they hold a Second Chance. A stay banks the line and leaves the round; it needs at least one card in front of the player
- Action cards go to any active player, the holder included; with one possible target there is nothing to choose and the card goes there. Freeze: the target banks and is out. Flip Three: the target flips three cards, one at a time, stopping as soon as they bust or make a Flip 7; every kind of card counts toward the three. Second Chance: kept; a second one is given to another active player who holds none, or discarded when there is nobody
- The round ends when nobody is active any more, or at once on a Flip 7 (seven different numbers, the zero included; modifiers and action cards never count). Score of a line: number cards added, doubled with the x2, then the +N added, then 15 for a Flip 7; busted scores 0. Everybody who is still in when a Flip 7 ends the round banks their line
- Next round: the cards of the round go to the discard (not back into the deck), the deck is handed to the left, that player deals. When the deck runs out the discard is shuffled into a new one; cards in front of players stay where they are, busted players' included
- **Where the booklet is silent, the engine decides as follows (to be validated, they come from the usual reading and a community FAQ, not from the booklet):**
  1. The first turn is the player on the left of the dealer (the booklet says "in turn")
  2. An action card dealt in the opening deal is given by the player it was dealt to, to any active player, even one not dealt yet. A player frozen before their deal gets no card; a player given a Flip Three before their deal is still dealt their card afterwards
  3. A Freeze or a Flip Three flipped during a Flip Three waits until the three cards are done, then is played in the order flipped by the flipper, on any active player (they may have frozen themselves in between); if they bust or make a Flip 7 it is not played and stays in front of them. A second Second Chance flipped during a Flip Three is NOT held back (the booklet only holds back Freeze and Flip Three): it is given away at once
  4. A stay is possible with any card in front of the player, a lone Second Chance or x2 included (it banks 0)
  5. A tie for the best total at or above the target plays one more round (the booklet does not say)
  6. When a draw finds no card anywhere (not possible in practice up to 18 players), the round ends as if everybody still in had stayed
  7. The finished round's lines stay in front of the players until the next deal, which is the new dealer's to do, so the board can show the result

### Absent player
`autoPlayFor` plays the simplest legal step, always the same for the same state (no random number): on a turn the player stays (they bank what they hold), or hits when they have nothing in front of them; a Freeze they hold freezes them; a Flip Three or a Second Chance goes to the next player clockwise who can get it; between two rounds they deal. `NOT_WAITING` when the game is not waiting for them.

### Options (`options.ts`, labels in French)
- `targetScore`: 200 by default (the booklet), 50 to 500 in steps of 50. A lower one makes a shorter game

### Errors
The codes are listed with their meaning in `FLIP7_ERROR_CODES` (`types.ts`). The core translates `NOT_YOUR_TURN` and `NOT_WAITING`; the others (`INVALID_PLAYERS`, `GAME_OVER`, `INVALID_ACTION`, `CANNOT_STAY`, `INVALID_TARGET`) need a message in the binding's `ERROR_MESSAGES`. The action route accepts the types of `CLIENT_ACTIONS` only.

### The cards are a contract with the studio
The 22 keys of `CARDS` (`number-0` … `number-12`, `plus-2`, `plus-4`, `plus-6`, `plus-8`, `plus-10`, `times-2`, `freeze`, `flip-three`, `second-chance`) are the keys of the card faces in the Sanity studio (name, text, artwork): a `Face` carries the key as its `type`. Append only, never rename. An expansion is more faces, a `DECK` entry each, and a branch in `round.ts` for each new effect.

### Tests
`pnpm --filter @flip-7/engine test` and `typecheck`. One test file per part of the game (catalogue, scoring, setup, deal, turns, cards, rounds, view, autoplay, debug, game), each rule with the page of the booklet it comes from, and `simulation.test.ts` for 64 whole games (3 to 18 players, careful and greedy, with absent players) with the invariants checked after every move: no card lost, the turn goes to the right player, the scores of every round recomputed from the booklet independently, a Flip 7 ends the round, replay from a state stored with its keys in another order, no view shows a card of the pile, junk actions refused, the takeover. The tests were also run against 32 deliberately broken versions of the rules (a modifier added before the doubling, a Second Chance that never saves, a deal that starts with the dealer…): each one fails a test

## Content (Sanity)
24 documents: 22 card faces (`card-type-<key>`, keyed like the engine's catalogue), each with the engine's `kind` (`number`, `modifier`, `action`), its place in the box (`order`, so that the Studio lists the faces in the order of the deck), its copies and its name and effect in FR, EN, ES and DE; the `game` singleton (card back, box, mat: images only) and `settings` (credits: Eric Olsen; publisher The OP Games and its link). The names of the numbers and modifiers are the figures of the cards, the three action cards keep their English names; the FR, ES and DE effects are meant for a native read. No `rules` document yet, and no rulebook link: the booklet has no address of its own to link, set one in the Studio (`settings`) when there is one
- The pipeline itself (options, token, plan, art, drafts-only writes, report) is `@pbgo/content-kit` (`packages/content-kit`, shared with the other games); `content/` keeps only the data (`content/data/`: card faces, `game`, `settings`, the art slots) and the config
- `pnpm --filter @pbgo-game/flip-7 content:seed --dry-run` shows what would change, `--apply` writes the drafts. Nothing is published from code; the owner publishes in the Studio. The token is `SANITY_API_WRITE_TOKEN_FLIP_7`
- Art (27 slots: the 22 card faces, then the card back, the box front and back, the table mat and the logo) lives outside the repo, in one flat folder (e.g. `~/Companies/PBGO/assets/flip-7`), under the slot's name (`number-7.png`, `plus-4.png`, `freeze.png`, `card-back.png`…; the figure printed on the card works too: `7.png`, `+4.png`, `x2.png`), and is placed with an absolute `--art-dir`. A card face is one picture for every copy of the card. It can also be dropped straight onto the "Card face" field of each document in the Studio
- `pnpm --filter @pbgo-game/flip-7 test` and `typecheck` cover `content/` (no network, nothing written)
- `content/parity/engine.test.ts` checks the seed against the engine, read from `@flip-7/engine` itself (a dev dependency that only Vitest loads: the seed never imports it): the keys and their order, the `kind` of each, the kinds the Studio lists (also at compile time), the copies of each face against `DECK`, the names against the values of the cards, and the default `targetScore`
- The whole process, the options and the art naming: `docs/content-pipeline.md` at the root

## Sanity project
The registry gives the project `fj3grahy` (Studio `https://flip-7.sanity.studio`). It is created and configured by `pnpm go-live flip-7` (rerunnable: it finds or creates the project, makes the `production` dataset public, sets CORS, writes `SANITY_API_WRITE_TOKEN_FLIP_7` to `apps/web/.env.local` and deploys the Studio), which needs `npx sanity login` on the machine. After a change of the Studio's schema, deploy it (`pnpm --filter @pbgo-game/flip-7 deploy:studio`) before reviewing in the hosted Studio: the new `cardType` type only shows there once deployed. The local Studio (`pnpm dev:studio flip-7`) shows it at once

## Making it playable
The engine is done. What is left: export `GAME` from `src/index.ts` (and add `@flip-7/engine` to the binding's dependencies), write the messages of the engine's codes in `ERROR_MESSAGES`, add the board (`Game` in `src/ui.tsx`, loaded lazily as in the template; the rounds, the Flip Three flips and the choice of a target are shown from the events and the view), adapt `template/src/takeover.test.ts` to this engine, then set `live` (and `indexable` once it is ready for search engines) in `packages/games/src/registry.ts`. See `template/CLAUDE.md` ("Adapting to a new game").

## Commits
Gitmoji format: `<emoji>(flip-7): <description>`
