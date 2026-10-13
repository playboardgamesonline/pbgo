# Exploding Kittens · Play Board Games Online

Exploding Kittens, served by `apps/web` at `/exploding-kittens`. The engine of the Original Edition is written (GAM-7), but the binding does not export it yet (GAM-8: wiring, board, messages), so the game is not playable yet: without `GAME` in `src/index.ts`, its home page says "coming soon" and its table pages answer 404. Listed nowhere until `live` is set in the registry.

## Structure
- `package.json` — `@pbgo-game/exploding-kittens`, the binding package that `@pbgo/games` loads on demand
  - `src/lib/site.ts` — `SLUG`, `asset()`, name, tagline, description, keywords, genres (player-facing copy in French)
  - `src/index.ts` — the binding shared by the server and the client: site constants and the default look (none yet: the core theme, and icons generated from the title), replaced by what is set in `/gamemaster/exploding-kittens`. No `GAME` yet
  - `src/ui.tsx` — `Logo` · `src/runtime.tsx` — client runtime (styles, `BindingProvider`) · `src/server.ts` — server side (`SEO`)
- `packages/engine` — `@exploding-kittens/engine`, the Original Edition: pure TypeScript, tested with Vitest (see Engine)
- `apps/studio` — `exploding-kittens-studio`, Sanity Studio of the project `gsfz20b9` (not deployed yet: `pnpm go-live exploding-kittens`)
- Static files: `apps/web/public/exploding-kittens/` (served at `/exploding-kittens/...`)

## Engine (`packages/engine/src`)
- `types.ts` — `State`, `Phase`, `Action` (`CLIENT_ACTIONS`), the views (`PlayerView`, `PublicPhase`), the events (`EkEvent`), the error codes (`EK_ERROR_CODES`)
- `catalogue.ts` — `CARDS` (the card types), `DECKS`, `buildCatalogue`
- `rules.ts` — `Rules` (cards, decks, effects, options, setup plan) and `ORIGINAL_RULES` · `options.ts` — `OPTIONS` · `effects.ts` — `EFFECTS`, what each action card does
- `machine.ts` — what every rule is written with: `open` / `close` of a step, card and player helpers, the turn flow (`startTurn`, `endTurn`, `eliminate`…), `openWindow`, `emit`, the `known` bookkeeping
- `setup.ts` — `setupGame` · `actions.ts` — `play`, `draw`, `defuse`, `give`, `pick` and `step(rules, state, action)`, the one entry point · `combos.ts` — pairs, triples, five different
- `window.ts` — the Nope window: `nope`, `pass`, `closeWindow`, `resolveWindow`
- `autoplay.ts` — `autoPlayFor` · `results.ts` — the ranking · `view.ts` — `playerView` · `debug.ts` — the debug panel
- `game.ts` — `createGame(rules)` gives a `GameDefinition`; `GAME` is `createGame(ORIGINAL_RULES)` · `index.ts` — the exports (`@pbgo/engine-kit` too)
- `test-utils.ts` — helpers of the tests, not exported

### How a game goes
- `step(rules, state, action)` gives `{ state, events }`; `GAME.apply` keeps the state. The events (`EkLogEntry`: an `EkEvent`, plus `to` and `masked` when only some players may see it) are for the platform to store: the state holds no log and the view none either (PLT-45)
- A step is `open` (a private copy of the state, the streams picked up where the last step left them), a few mutations, `close`. Nothing mutates its input, and there is no `Math.random` nor `Date.now`
- Lean state: ids and numbers only. A card is the opaque id it holds now (`ids` of the engine-kit); what it is comes from the catalogue, rebuilt from the options and never stored. `deck` and `discard` are top first (the card played last is `discard[0]`), and every order comes from an array (`seats`, `out`), never from the keys of an object (`jsonb`)
- `state.phase`: `turn` (play cards, then draw), `reaction` (a Nope window), `defuse` (the Exploding Kitten just drawn is in the air; its owner chooses where it goes back), `give` (a Favor: the target chooses the card to give), `pick` (five different cards: the player takes a card from the discard), `over`
- Two streams, both saved in the state: `rng` (shuffles, steals, automatic plays) and `idsRng` (the card ids, a side stream), so drawing ids never changes what a seed deals
- A card that goes back into hiding gets a new id (`reissue`): the Kitten that goes back into the pile, the whole pile after a Shuffle. An id seen before tells nothing about where a card is now
- `known`: the players who know the top n cards of the draw pile (See the Future), private to each of them, one less with every draw. When a Kitten goes back, only its owner keeps what they knew of the cards above it (`reinsertKnown`): if the others' knowledge shrank only when the Kitten went in above it, the size of their own view would give away where it is
- `playerView` shows the viewer's hand and the top of the pile they know, the size of the other hands and of the pile, the whole discard, and the Nope window with the Nopes played so far. A spectator, a stranger and an eliminated player all get the spectator view (`me: null`)
- Setup follows the booklet: Kittens and Defuses out, one Defuse each, at most two spare Defuses back into the pool (the others leave the game unseen), 7 cards each, one Kitten fewer than players shuffled in, a random player starts. The plan is data (`SetupPlan`, `rules.plan`)

### The Nope window
- Every action card and every combo opens one on itself, and its cards are on the discard from the start (a Noped card is lost). Nothing else opens one: not a draw, a Defuse, the card a Favor gives, nor the card taken from the discard
- Every living player but the author of the last card of the chain may answer, with a Nope or a pass. A Nope joins the chain, restarts the window and clears the passes; its author cannot answer their own Nope, everyone else can, the original author too. An odd number of Nopes cancels the action (`cancelled`), an even one lets it resolve (`resolved`)
- `chain` is the number of Nopes the client saw: `nope` and `pass` carry it back, and a different one is `STALE_REACTION` (the Nope the player aimed at is not the last one any more)
- No timer: the window waits until everyone it waits for has passed. `resolveWindow(rules, state)` closes it as if all had passed (what a timer would call, PLT-43); it changes nothing when no window is open. The board (GAM-8) auto-passes for a player who holds no Nope, after a short random delay (a fixed one would tell the others they hold none), with an "auto-pass" toggle
- `waitingFor` lists every responder, those who passed too, so it never tells who passed; the view shows a responder only their own pass (`passed`)
- Playing for an absent responder (`autoPlayFor`) closes the window: whoever had not answered is taken to have passed

### Absent player
`autoPlayFor` never plays a card: on a turn the player draws; a Nope window closes; the Kitten goes back at a random position; a Favor gives the card they need least (cats, then actions, Nopes, Defuses); five different cards take the card they need most (Defuse, Nope, action, cat). `NOT_WAITING` when the game is not waiting for them.

### Options (`options.ts`, labels in French)
- `fiveDifferent`: on by default. It is in the official Original rules, so it is a `parameter`, not an `extension` (the kit's extensions are always off by default)
- `fasterGame`: off, 2 or 3 players. A third of the pile is removed unseen before the Kittens go in
- `classicDeal`: off. Each player gets a Defuse and 4 cards, and every spare Defuse goes into the pool
- `fasterGame` is declared before `classicDeal`: when a table asks for both, the first one wins

### Errors
The codes are listed with their meaning in `EK_ERROR_CODES` (`types.ts`). The core translates `NOT_YOUR_TURN`, `NOT_WAITING` and `UNKNOWN_CARD`; the others need a message in the binding's `ERROR_MESSAGES` (GAM-8). The action route accepts the types of `CLIENT_ACTIONS` only.

### The cards are a contract with the studio
The 13 keys of `CARDS` (`exploding-kitten`, `defuse`, `attack`, `skip`, `favor`, `shuffle`, `see-the-future`, `nope`, `tacocat`, `cattermelon`, `hairy-potato-cat`, `beard-cat`, `rainbow-ralphing-cat`) are the keys of the card types in the Sanity studio (name, text, artwork): a `Face` carries the key as its `type`, and a triple names a title by it. Append only, never rename.

### Plugging another deck
Another edition or an expansion is data, plus an effect for each new behaviour. Nothing in the engine switches on the name of a card: rules read the `kind` of a card type (`kitten`, `defuse`, `nope`, `action`, `cat`) and the `effect` of an action card.
1. `cards`: a type for each new card (`kind`, and for an action the key of its `effect`)
2. `decks`: the deck, as `{ type, copies }` entries
3. `effects`: what each new `effect` key does. `resolve(ctx, { by, target })` runs once the Nope window has closed without cancelling the card; the helpers are in `machine.ts`. `targeted: true` for a card that names a player
4. `options` and `selectDecks(options)`: an option that switches the deck on, and the ids of the decks of a table, the Original's first
5. `plan(options, players)`: another setup (hand, spare Defuses, number of Kittens) when the deck needs one

Then `createGame({ ...ORIGINAL_RULES, cards, decks, effects, options, selectDecks, plan })`. The Original Edition (`ORIGINAL_RULES`, `GAME`) stays as it is.

What data cannot do: a choice from a player that the game has no step for needs a new `Phase` kind and its action in `types.ts` and `actions.ts` (Favor does that with `give`), and an event with no kind is a new member of the closed `EkEvent` union. `targeted: true` asks for a living opponent who holds a card when the card is played; an effect that takes a card must still cope with a hand emptied behind the Nope window (Favor says `fizzled`). `extend.test.ts` is the worked example: a bonus deck of two cards, one of them targeted, plugged in with the engine's exports alone.

### Tests
`pnpm --filter @exploding-kittens/engine test` and `typecheck`. One test file per part of the game (catalogue, setup, turns, cards, explosion, combos, nope, game, view, debug), `simulation.test.ts` for whole games played at random with the invariants checked after every step, and `extend.test.ts` for a second deck.

## Making it playable
The engine is done. What is left (GAM-8): export `GAME` from `src/index.ts`, write the messages of the engine's codes in `ERROR_MESSAGES`, add the board (`Game` in `src/ui.tsx`, loaded lazily as in the template), then set `live` (and `indexable` once it is ready for search engines) in `packages/games/src/registry.ts`. See `template/CLAUDE.md` ("Adapting to a new game").

## Commits
Gitmoji format: `<emoji>(exploding-kittens): <description>`
