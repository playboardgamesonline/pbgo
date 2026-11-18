# Love Letter · Play Board Games Online

Love Letter, served by `apps/web` at `/love-letter`. Not playable yet: without an engine (`GAME`), its home page says "coming soon" and its table pages answer 404. Listed nowhere until `live` is set in the registry. 2 to 6 players, the 2025 edition (Z-Man Games). The rules spec is `docs/games/love-letter/rules.md`.

## Status
- Rules spec: `docs/games/love-letter/rules.md`, validated 2026-11-18 with its six readings: the standard game for 2 to 6 players with the 21 character cards (Spy and Chancellor included). The classic version of p. 14 is out of scope and no room is kept for it in the code
- Content: the Studio's `character` list and the seed's ten characters are in the repo (GAM-53). Their keys, values and quantities are the engine's catalogue as they are (see Content)
- Engine: **in progress** (GAM-55). The plan under "Engine" is approved, with every default it proposed, and is written in four slices (see Slices). Slices 1 (the box: the catalogue, `tokensToWin`, the dependency on the kit, the parity with the Studio), 2 (the skeleton: a whole game played by the engine itself) and 3 (the ten characters, the Chancellor's `keep` included) are written. `pnpm check:game love-letter --stage engine` passes; the hand-over (slice 4: the debug commands, the notes) is left
- Binding, board, content words, go live: not started (`engine-board`, `game-sanity-create`, `game-go-live`)

## Structure
- `package.json` — `@pbgo-game/love-letter`, the binding package that `@pbgo/games` loads on demand
  - `src/lib/site.ts` — `SLUG`, name, keywords, genres, author, contact (no tagline, no description: a game's texts live in Sanity only)
  - `src/index.ts` — the binding shared by the server and the client: site constants and the default look (logo, icon, share image and colors), replaced by what is set in `/gamemaster/love-letter`
  - `src/ui.tsx` — `Logo` · `src/runtime.tsx` — client runtime (styles, `BindingProvider`) · `src/server.ts` — server side (`SEO`)
- `packages/engine` — `@love-letter/engine`, the engine (pure TypeScript on the engine-kit helpers, Vitest), written in the slices below: `types.ts`, `catalogue.ts`, `options.ts`, `machine.ts` (`open` / `close` / `emit` of a step, the cards, the seats, `targetsOf`, `playableOf`, the tokens, `waitingFor`), `effects.ts` (what each character does, by key, and `eliminate`), `round.ts` (`startRound`, `startTurn`, `endTurn`, `endRound`), `actions.ts` (`play`, `keep`, `dealRound`, `step`), `setup.ts`, `results.ts`, `view.ts`, `autoplay.ts`, `game.ts` (`GAME`), `index.ts` and a test file for each part (`test-utils.ts` rigs a table from the names of the characters). `pnpm --filter @love-letter/engine test` and `typecheck`
- `apps/studio` — `love-letter-studio`, Sanity Studio of the project `8h6tuu2t` (https://love-letter.sanity.studio). Its own document types (`character`, the `game` pictures) are in `schemaTypes/`, the lists they share with the seed (the ten keys and their English titles) in `schemaTypes/constants.ts`, and the guard of the forms is `studio-forms.test.ts` (`pnpm --filter love-letter-studio test`)
- `content/` — the Sanity content as versioned code (the game's data and config) and the seed script, run by the shared `@pbgo/content-kit` (see Content); `vitest.config.ts` runs its tests and those of `src`

## Content (Sanity)
12 documents, written as drafts: the owner publishes them in the Studio.
- 10 `character` documents, `character-spy` to `character-princess`: the ten characters of the 21 cards. The fields, in the order of the Studio form: the English game key (`key`, a dropdown of the ten keys, which the engine reads as they are with no mapping: append only, never rename), the printed value (`value`, 0 to 9, read-only, which sorts the list), the name (`name`, localized), the card text (`text`, localized), the copies (`quantity`) and last the visual (`image`)
- `game`, pictures only, in three tabs (Board with the optional mat, Card backs, Favor token with its symbol, its mask and its 3D model file), and `settings`, the credits only (Seiji Kanai, Z-Man Games and its link: the draft that holds the English rulebook only gets its gaps filled; no illustrator line, since `settings` has no field for one, and the booklet names Andrew Bosley for the character art; no description, the catalog's is English only)
- No Effect or Rule field: what a card does is the engine's, and the rules are the publisher's PDFs linked in `settings`. The card text is the one exception, a text to display on the card's plate, by decision, because the faces are blank. The engine never reads it and no test can check prose against the engine, so a rule that changes in the engine is changed in these texts by hand. No category (nothing on the table groups the ten characters) and nothing in `texts` or `audio` yet: the words of the options and the scores come after the engine, the words of the board with the board and the victory phrases at go-live, each a later pass of `game-sanity-create`

| Value | Key | English | French | Quantity |
| --- | --- | --- | --- | --- |
| 0 | `spy` | Spy | Espionne | 2 |
| 1 | `guard` | Guard | Garde | 6 |
| 2 | `priest` | Priest | Prêtre | 2 |
| 3 | `baron` | Baron | Baron | 2 |
| 4 | `handmaid` | Handmaid | Servante | 2 |
| 5 | `prince` | Prince | Prince | 2 |
| 6 | `chancellor` | Chancellor | Chancelier | 2 |
| 7 | `king` | King | Roi | 1 |
| 8 | `countess` | Countess | Comtesse | 1 |
| 9 | `princess` | Princess | Princesse | 1 |

- Names and texts: the English names are the 2025 rulebook's (p. 2) and the French ones the ten names printed on p. 2 of the publisher's French demo leaflet (`~/Companies/PBGO/assets/love-letter/rules-demo-fr.pdf`, © 2019 Z-Man Games, a document apart from the rulebook: names only, never rules). The ten English card texts were written for the platform from the rules spec, in our own words and not the publisher's. The ten French card texts are DRAFTS in our own wording, for the owner to read, with the leaflet's terms (manche, quitter la manche, en lice, pion Faveur). Spanish and German have no source and stay empty on purpose: 40 gaps (the name and the text of each character), which `content/data/schema.test.ts` states, and the board shows the English until someone fills them in the Studio
- `pnpm --filter @pbgo-game/love-letter content:seed --dry-run` shows what would change, `--apply` writes the drafts. Nothing is published from code. The token is `SANITY_API_WRITE_TOKEN_LOVE_LETTER`. `pnpm --filter @pbgo-game/love-letter test` and `typecheck` cover `content/` (no network, nothing written)
- `content/parity/engine.test.ts` (with its own `tsconfig.json`, since the engine is a dev dependency that only Vitest loads: Flip 7's and Exploding Kittens' are the model) holds the Studio's keys, the seed's keys, values and quantities equal to the engine's catalogue, the 21 cards and no option, and at compile time the two key types equal; `typecheck` runs `tsc --noEmit -p content/parity`. The words of the engine (`score.rounds`, `score.won`, `score.spy`) join it when `texts` joins the seed

## Pictures
The owner's art is in `~/Companies/PBGO/_ASSETS/catalog/games/love-letter/` (the ten faces and the back in `cards/`, the favor token in `tokens/`, backgrounds, brand pictures, fonts and visuals) and goes in with the seed's 15 slots at step 7 (`game-assets`; the slots and their file names are in `docs/content-pipeline.md`, "Love Letter slots"). What the board needs from the faces, read from the pictures and measured on the files (confirm the geometry with a render):
- The faces are **blank plates**, 760 by 1060 px (38:53), opaque from edge to edge (`paintFace` of the table kit wants a full rectangle and cuts the corners): no name and no text is printed, so the board draws the Name and the Card text of the Studio over them. The **value and the copies are printed**: the value in a burgundy medallion at the top left (about x 45 to 235, y 50 to 245; the Spy's is a pointed-oval glyph standing for 0) and the copies as dots on the left edge under it (a gold dot is a copy that the classic version removes), so the board draws neither. The back is a full-bleed burgundy leaf pattern, no frame, no logo, no text
- The plates, in pixels of the 760 by 1060 file (a clean core is the largest empty rectangle found on the file; the visible plate is a little larger):

| Plate | Faces | Clean core | Notes |
| --- | --- | --- | --- |
| Name: the banner right of the medallion | all ten | x 307 to 583, y 72 to 149 (277 by 78) | centre (445, 110), that is (0.586, 0.104) of the card; the banner is visible about x 270 to 635, y 58 to 155 |
| Text, layout A | spy, guard, baron, handmaid, prince, chancellor | x 91 to 668, y 810 to 977 (578 by 168) | centred on x = 380; visible box about x 50 to 712, y 800 to 995 |
| Text, layout B | priest, king, countess, princess | x 91 to 668, y 846 to 976 (578 by 131) | the portrait runs lower; visible box about x 50 to 712, y 835 to 995 |

- Budgets, kept by `content/data/data.test.ts` and not by the Studio: a card text of at most 130 characters (about three lines of 40 at the text size of the publisher's own sheet, and four fit layout A), at most 90 on layout B (the four faces with the shorter plate), and a name of at most 12 letters. The board may fit a text smaller
- Fonts, a **guess**: the owner's English sheet (`visuals/VISUEL_CARDS_SHEET_EN.webp`, a mock-up with the publisher's wording, read for layout only) sets the name centred in the banner in a bold display face and the text centred in a small old-style serif, and the library's `fonts/cabazon-regular.otf` (display) and `fonts/MinionPro-Regular.ttf` (serif) look like that pair: to confirm with the owner. Minion Pro is a commercial typeface (Adobe): its web licence must be checked before step 7 uploads it, and Cabazon's licence is not checked either. The fonts go in the Gamemaster (Visual) and the board reads them as Flip 7's does (`tableFonts`)
- The favor token has three files: its symbol (an SVG) and its mask (a PNG) are images the seed places, its 3D model (`FAVOR_TOKEN.glb`) is a file dropped on its field in the Studio; nothing in the table kit loads a glTF today. Not in this Studio: the box (placed in the catalog entry), the sprites sheet `visuals/VISUEL_SPRITES.webp` (effect icons: a shield, a question bubble, a scales seal, a hooded figure and a crossed-out one, numeral discs; single files are wanted if the board draws any of them), and the reference card and the broken seal (the library has no picture of them)

## Glossary (booklet → code; the French in brackets is the publisher's leaflet)
round (manche) → `round` · deck (paquet) → `deck` · hand (main) → `hands[seat]` · play area → `areas[seat]`: the cards played and the cards discarded lie there face up, oldest first · the card set aside face down → `aside` · the three set aside face up at two players → `faceUp` · out of the round (quitter la manche), the broken seal → `out` · protected by a Handmaid → `shielded` (not `protected`, a reserved word) · choose another player, choose any player → `target`, one of the `targets` the view lists · name a character → `guess` · favor token (pion Faveur) → a token, kept as `won` (round wins) and `spies` (Spy tokens) · tokens to win → `tokensToWin(players)` · the Chancellor keeps one card and puts the others under the deck → `keep`, with `bottom` · start the next round → `deal` · reference card, cloth bag → no state: the board's

## Engine (plan, GAM-55)
Written from the validated spec after the owner's go, in `packages/engine/src`, with the files and the order of `docs/engine/04-build-a-game/03-writing-the-engine.md`. Skyjo's engine is the model for a game of rounds and turns, Exploding Kittens' for the private entries of the log. Time: none. Options: none. Aids: none. 2 to 6 players.

### Rules as coded (booklet pages as printed)
- **The box** (p. 2): 21 character cards of ten characters valued 0 to 9: Spy 0 ×2, Guard 1 ×6, Priest 2 ×2, Baron 3 ×2, Handmaid 4 ×2, Prince 5 ×2, Chancellor 6 ×2, King 7, Countess 8, Princess 9. The keys are the Studio's ten, as they are, append only. The value decides every comparison, the Spy being the lowest (pp. 2, 6, 12)
- **A round** (p. 3, again p. 7): the 21 cards are shuffled, one is set aside face down, three more face up at two players, and each player gets one. The deck then holds 15, 17, 16, 15 and 14 cards at 2 to 6 players
- **A turn** (p. 4): draw the top card, play one of the two and resolve its effect. The card played stays face up in the player's play area, the other stays in hand. Clockwise, a player out of the round is skipped (p. 5). Nothing is played at the same time
- **Choosing a player** (pp. 5, 11): a card that asks for another player can pick anyone in the round but its own player and a player a Handmaid protects; the Prince can pick any player, its own included. When every other player in the round is protected, the Guard, Priest, Baron and King are played with no effect and the Prince must pick its own player. A card played with no effect is still played
- **Out of the round** (pp. 5, 8, 10, 12): by playing or discarding the Princess, by a Guard that names the card held, by the lower card of a Baron's comparison. The hand is discarded face up, no effect is resolved, the player cannot be chosen and their turn is skipped
- **The characters** (pp. 8–13): Princess, out when played or discarded for any reason. Countess, no effect; she must be played when the other card of the turn is the King or a Prince, and the other card is not shown (the three cards of a Chancellor are free). King, trade hands with another player. Chancellor, draw two cards (one if the deck holds one, none: played with no effect), keep one of the cards in hand and put the others under the deck face down, in an order the player picks, shown to nobody. Prince, any player discards their hand face up with no effect and draws a new card, the set-aside card when the deck is empty; a Princess discarded that way is out and draws nothing. Handmaid, nobody else can choose the player until the start of their next turn. Baron, compare hands with another player, the lower value is out and a tie spares both. Priest, look at another player's hand. Guard, name a character other than the Guard: another player who holds it is out. Spy, no effect
- **End of a round** (p. 6): at once when one player is left (they win, nothing is revealed), else after any turn that leaves the deck empty: the players still in reveal their hands, the highest value wins and a tie gives every tied player the win. A winner gains one favor token
- **The Spy** (p. 13): at the end of a round, the only player still in the round who played or discarded a Spy gains one more token, never more than one, and it is not a win. A Spy still in a hand was neither played nor discarded
- **End of the game** (p. 7): when a player holds 6, 5, 4, 3 or 3 tokens at 2, 3, 4, 5 or 6 players; several can win together. Else a new round is dealt and the winner of the last one takes the first turn
- The two rule mistakes of p. 13 cannot happen: the engine answers a Guard truthfully and refuses a play that breaks the Countess's rule

### What the booklet leaves open
Validated with the spec on 2026-11-18, coded as read:
1. First turn of the first round: a seat drawn from the seed (the booklet says the player who last wrote a letter, pp. 3, 16). Later rounds: the winner of the last round, one of the tied winners drawn when there are several (p. 7)
2. A Spy of a player who is out counts for nothing, for them and for the others: only the players still in the round at its end are looked at (p. 13)
3. The cards a Chancellor puts under the deck are neither played nor discarded: a Princess there knocks nobody out, a Spy there does not count. With one card left in the deck the card returned also goes into the deck, hidden (p. 10)
4. The Chancellor with one card left in the deck: the returned card is in the deck, so the round goes on and ends after the next turn. With none left, no effect, and the round ends after the turn (pp. 6, 10)
5. A new round keeps only the favor tokens: all 21 cards are shuffled again, every player is back in the round, no Handmaid protects anybody (pp. 5, 7, 11)
6. Several players reaching the number together: all the tokens of the round are gained first, then every player who holds at least the number wins and shares the win, whatever their count above it. Every other player loses, no places (p. 7)

Validated with the plan (2026-11-18, the owner accepted every default; the booklet says nothing about them):
7. The draw is part of the turn: the engine draws for a player the moment the turn comes to them, so a player on turn holds two cards and there is no `draw` action (p. 4 says "draw one card", with no choice in it)
8. Between two rounds the table waits for the player who takes the first turn to press Deal (`deal`), as Flip 7 and Skyjo do, so that the finished round stays on the table: the hands revealed, who won, the Spy's token. An absent player is dealt for
9. The 13 favor tokens of the box are a supply, not a rule: the engine counts tokens with no limit (4 players at 3 tokens each plus one round already make 13, a Spy's token or a tie make more; the booklet is silent)

### Who sees what
- Hands: their owner only, as faces. The others get a count (1 between turns, 2 on the turn, 3 while a Chancellor is read). After a round that ended on a comparison, the hands of the players still in are public
- The deck: its size, never a card nor the order. The card set aside face down: that there is one, never which. At two players the three set aside face up are public
- The play areas, who is out, who is protected, the favor tokens: public
- Guard: the guess, the target and hit or miss are public; a hit lays the target's hand face up for all. Priest: the target's card goes to the Priest's player only. Baron: both cards go to the two players only, and the one who loses lays their hand face up for all (so a tie shows nothing). King: after the trade both players know both cards. Prince: the discard is public, the card drawn goes to its player only. Chancellor: the cards drawn and the cards put back go to their player only. Countess: only her player's view says that she is forced
- How a private reveal travels: `step` returns the entry with `to` (who reads it in full) and `masked` (what everyone else reads: the fact and never the card), the platform keeps it (`game_log`) and each player is sent `viewLog` of it (`docs/engine/01-the-game/10-views.md`, "Per-viewer log"). The state keeps no memory of what was shown, and the view none either: a player reads it in the last 60 lines of their log (see Friction). In a private entry a card that is still in a hidden place after the move (another player's hand, the deck) is named by its key, never by its id, so that no id of a hidden card reaches a log. A card that its reader holds after the move may carry its id (the card drawn, the cards a Chancellor kept), and so may a card the Chancellor put back, whose old id no longer exists once it is reissued; the cards of the player's own hand are in `me.hand`

### The blocks
| Thing | Engine (the kit) | Table (`@pbgo/table`) | Standing |
| --- | --- | --- | --- |
| The deck, hidden, cards go under it | `deck`, top first; `shuffle`, `draw`, `reissueIds` | `Pile`, its size written on the top card | Built |
| The card set aside face down; the three face up at two players | `aside`, `faceUp` | A `Card` face down; a `Zone` over `row` | Built |
| A hand of one to three cards, private | `hands[seat]`; the view gives faces to the owner, a count to the others | `Zone` over `fan` for the viewer, a row of backs for the others | Built |
| The play area, face up | `areas[seat]` | `Zone` framed on the seat | Built |
| A character that does something when played | `CARDS` (value, how it picks a player) and `EFFECTS`, the game's own, as Exploding Kittens does | `Card` painted with `paintFace`: the faces are blank plates, name and text come from Sanity | Built; the kit has no character block (`docs/engine/03-not-built-yet.md`, "Roles, characters and teams") |
| Out of the round | `out[seat]` | `Card` `out` greys the player's cards | Built |
| Protected until the owner's next turn | `shielded[seat]` | A glow on the played Handmaid, a word on the `Seat` | Built, the board's choice |
| The favor tokens, the score | `won[seat]` + `spies[seat]`, `standings` | `Piece` and `Stack`, a `Counter`, the `Seat` line | Built; **gap**: no piece from a glTF (the token's 3D model), a disc with the symbol and the mask meanwhile |
| Choosing a player | `targetsOf`, `INVALID_TARGET` | One `FloorButton` zone per player, as Flip 7 gives a card | Built |
| Naming a character (Guard) | `cleanChoice` over the nine keys | `ChoiceField`, `askChoice`, or the game's own row of nine small cards | Built |
| Keeping one of three and ordering two (Chancellor) | `keep` with `bottom`, a check by hand (see Friction) | `Card`s that can be pressed, in the viewer's own hand | Built |
| A private reveal (Priest, Baron, King) | A private entry in the log, `to` and `masked` | A sequence of the game's own that shows the card to its viewer; nothing keeps a mark by the opponent's hand | **Gap** (board lane), see Friction |
| The next player who is still in | Nothing: written in the game (`nextInRound`) | | **Friction** |
| The first player of a round, drawn among the tied winners | `rng` (`Math.floor(rng() * n)`) | | Built |
| The end of the game by tokens | `roundsOutcome` does not fit (see Friction); written in the game | The `GameOver` and the announcements | **Friction** |

### State, lean: ids and numbers
```ts
type State = {
  options: OptionValues      // none
  seats: string[]            // player ids, clockwise
  ids: number[]              // opaque ids, aligned with CATALOGUE (21)
  rng: number                // saved stream: the shuffles, the pick of a first player
  idsRng: number             // side stream: the new ids of the cards a Chancellor puts back
  round: number              // the round going on, the last one between two rounds
  turn: number               // the seat that plays now, or that deals between two rounds
  stage: Stage
  deck: number[]             // top first, hidden
  aside: number | null       // the card set aside face down, hidden; null once a Prince's target took it
  faceUp: number[]           // at two players, the three set aside face up
  hands: number[][]          // by seat: 1 card, 2 on the turn, 3 with a Chancellor, 0 once out
  areas: number[][]          // by seat: the cards played or discarded this round, oldest first
  out: boolean[]             // by seat
  shielded: boolean[]        // by seat: a Handmaid protects them until the start of their next turn
  won: number[]              // by seat: rounds won, a token each
  spies: number[]            // by seat: Spy tokens
}
type Stage =
  | { kind: "play" }         // `turn` plays one of their two cards
  | { kind: "keep" }         // `turn` played a Chancellor: keeps one card, puts the others under the deck
  | { kind: "between"; revealed: boolean; winners: number[]; spy: number | null }  // the round is over, `turn` deals the next one (nobody once the game is over)
```
Derived, never stored: the tokens of a seat (`won + spies`), `tokensToWin`, `isOver`, `progress`, `waitingFor`, who can be chosen, what can be played. Every id is in exactly one place (deck, aside, faceUp, a hand or an area); `out` means an empty hand; no id changes except the cards a Chancellor puts back (`reissueIds`: they were seen, then go back into hiding). The shuffle of a round and the pick of a first player come from `rng`, carried from step to step; every order comes from an array

### How a game goes
- Who is waited for: one player at a time. The player of the turn (`play`, then `keep` after a Chancellor), between two rounds the player who takes the first turn, nobody once the game is over, never a player who is out. Nothing is simultaneous
- `setup` seeds the streams, draws the first player and deals round 1 (`setupStep`: the log opens with it). A turn starts by drawing (`startTurn`: the protection of the player ends, the top card joins their hand, a private entry), then waits for `play`
- `play { card, target?, guess? }` is checked in this order: the game is not over, the action is well formed, the game waits for the player (`NOT_YOUR_TURN`), the stage is `play` (`INVALID_PHASE`), the card is in their hand (`UNKNOWN_CARD`), the Countess rule (`MUST_PLAY_COUNTESS`), then the target (`INVALID_TARGET`: it must be one of `targetsOf`, and none may be given when there is none) and, for the Guard with a target, the guess (`INVALID_CHOICE`: one of the nine other keys). The card goes to the area, its effect runs, then the turn ends
- The turn ends (`endTurn`) in this order: one player left in the round, the round ends at once; the deck empty, the round ends on a comparison; else the next player still in draws. The Chancellor stops the turn at the stage `keep` until `keep { card, bottom }`: `bottom` lists the cards that go under the deck, the first one first, so the last of them is the last card of the deck
- A round ends (`endRound`): the hands are revealed on a comparison, the winners and the Spy's token are written, the next first player is picked (the winner, or one of the tied winners by `rng`, which is drawn from only when there are several), the stage becomes `between`. A winner of the game is every player at or above `tokensToWin`: the game is over, nobody is waited for
- `deal` (the player who takes the first turn) starts the next round: all 21 cards shuffled, one aside, three face up at two players, one card each, the first turn drawn. Every turn takes one card from the deck for good (a Chancellor gives back what it took), so a round always ends, and every round gives a token, so a game always ends

### Actions and refusals
`CLIENT_ACTIONS` = `play`, `keep`, `deal` (`satisfies` the `Action` union). The codes are in `LOVE_LETTER_ERROR_CODES`: the shared ones (`INVALID_PLAYERS`, `GAME_OVER`, `NOT_YOUR_TURN`, `NOT_WAITING`, `INVALID_ACTION`, `INVALID_PHASE`, `UNKNOWN_CARD`, `INVALID_TARGET`, `INVALID_CHOICE`) and one of the game's own, `MUST_PLAY_COUNTESS`, which the binding lists in `ERROR_CODES` and whose message is written in Sanity. An extra field of an action is ignored; a missing or mistyped one is `INVALID_ACTION`, or the code of its field

### Events and the view
- Events, plain data (`LoveLetterEvent`; the exact union is written with the code): `round` (number, first player, the faces set aside), `draw` (private: the card), `play`, `guess` (target, character named, hit), `look` (Priest, private: the card), `compare` (Baron, private to the two: both cards), `protect`, `discard` (a Prince's target, public), `out` (the card laid face up and the cause), `swap` (King, private to the two: both cards), `chancellor` and `bottom` (private: the cards drawn, the cards put back), `fizzled` (a card played with no effect: nobody to pick, or a Chancellor with the deck empty), `reveal` (the hands at the end of a round), `end` (how, who won, the Spy's token), `over`. Each private entry has a `masked` version with the fact and never the card
- `PlayerView`: `me` (`null` for a spectator; else the hand as faces, the card drawn this turn last, and `playable`: the ids that may be played now, so the Countess rule lives in the engine only), `players` (by seat: `cards` in hand, `hand` shown after a comparison, `area`, `out`, `shielded`, `tokens`), `standings` (tokens by seat), `deck` (size), `aside` (0 or 1), `faceUp`, `round`, `target` (tokens to win), `phase` (`turn` with `targets`, the other players a card can choose now, in seat order, the same for every viewer; `keep`; `between` with `next`, `winners`, `spy` and `revealed`; or `over`) and `results`
- `Results`: winners are rank 1, every other player shares the next rank (the booklet gives no places), `total` is the player's tokens, `detail` has three lines (`scoreLines`: `rounds`, `won`, `spy`: the rounds played, the rounds won, the Spy's tokens). No word is written in the engine: the three `score.<key>` texts come in the game's Sanity after the engine

### Absent player
`autoPlayFor` plays a whole turn, never a click: it plays the card of the lowest value that may be played (the Princess last), picks the first player who can be chosen after them clockwise and names the first character that is not the Guard; after a Chancellor it keeps the card of the highest value and puts the others back in the order of the hand; between two rounds it deals. Deterministic, no random number. `NOT_WAITING` when the game is not waiting for them

### Tests
Layers of `docs/engine/04-build-a-game/06-testing.md`, each rule with its booklet page in the sentence of the test: `catalogue`, `setup`, `turns`, `cards` (the ten characters), `chancellor`, `rounds` (ends, tokens, Spy, ties, the next round, the end of the game), `view` (every viewer, `null` and a stranger included; a private entry through `viewLog` for the players it is for and for everybody else), `autoplay`, `debug`, `game`, `simulation` (2 to 6 players, with a third of the moves played for absent players, the invariants after every move, the count of every round written again from the booklet, junk actions) and `conformance` (the contract suite, run from the engine package until the binding takes it over). `test-utils.ts` builds a rigged table from the names of the characters. `secretsFor`: the deck, the card set aside and the hands of the other players, but not the hands once a round ended on a comparison. The `content/parity` test of slice 1 keeps the Studio's keys, values and quantities equal to the engine's

### Slices (each a branch and a pull request, approved by the owner: the first stacked on #231, each next one on the one before)
1. **The box** (`gam-55-love-letter-engine`), written: the engine package gets its `@pbgo/engine-kit` dependency and a `test` script with no `--passWithNoTests`; the binding gets `@love-letter/engine` as a dev dependency and `tsc --noEmit -p content/parity` in `typecheck`; `pnpm install` for the lockfile; `catalogue.ts`, `options.ts`, `index.ts`, `catalogue.test.ts`; `content/parity/engine.test.ts` with its `tsconfig.json` (Flip 7's and Exploding Kittens' are the models): the keys, their order, the values and the quantities of the Studio and of the seed equal the engine's, 21 cards, no option
2. **The skeleton**, written: `types`, `machine`, `setup`, `round`, `actions`, `results`, `view`, `autoplay`, `game`: a whole game played by the engine itself with every character played with no effect, the round ended on the deck, the tokens and the Spy's token, the game ended on `tokensToWin`, `standings`, `progress`, `GAME` exported. The contract suite is green from here and stays green
3. **The characters**, written, one commit for each part with its tests: (a) the choice of a player and the five characters that pick one (Guard, Priest, Baron, King, Prince), out of the round, the last player standing; (b) the characters that pick nobody (Handmaid and its protection, Countess and her rule, Princess, Spy); (c) the Chancellor, with its stage `keep` and the new ids of the cards put back
4. **Hand over**: the debug commands (`turn`, `round`, `over` and the rigs the board will need: the Countess with the King, a Chancellor on the deck with one card left, every other player protected, a table near the target), the simulation on every rule, this plan brought up to what was built with its friction, `pnpm check:game love-letter --stage engine` at 0

### Friction (found while planning; each slice adds to it)
- A private reveal and the contract suite: `secretsFor(state, viewer)` knows the state only, and who was shown what is not in it. A card that the Priest, the Baron or the King showed is still in another hand, so an entry that names its id to the player it is for reads as "the log shows what its viewer must not know" (`checkEntries` of `packages/engine-kit/src/conformance.ts`). The private entries therefore name a card by its key, which a check that looks for numbers can never find: the suite cannot prove that a masked entry hides it, so `view.test.ts` does by hand
- What a viewer was shown is nowhere but the log: the state and the view keep no `known`, so a player who looked at a card reads it in the last 60 lines of their log, and a board that wants a mark by the opponent's hand has to rebuild it from those lines (a card leaves a hand by a play, a swap, a discard). Exploding Kittens keeps a `known` for the top of its pile; here it would be an aid, and none is coded
- The machinery of a step and the helpers around it are written again in each engine that says what happens (Flip 7, Skyjo, Exploding Kittens), this one the fourth: `open`, `close`, `emit`, `keyOf`, `faceOf`, `facesOf`, `removeFrom`, `seatOf`, `playerAt`, the `Face` type, a catalogue made from the copies of a deck, and the next seat that skips the players who are out (`nextActive` in Flip 7, `nextLiving` in Exploding Kittens, `(seat + 1) % n` in Skyjo)
- `roundsOutcome` and `ranks` cannot say this game's end: a player at or above the target wins together with every other player at or above it whatever the counts, and the others all share one rank after them. The conformance suite wants every winner at rank 1, so `ranks()` of the tokens is out; the end is written in the game, a few lines
- `cleanChoices` returns a choice in the order of the options, so the Chancellor's order of two cards (the point of the choice) is lost: `keep` checks `bottom` by hand and refuses with `INVALID_CHOICE`
- The pages of the engine docs disagree on face-down cards: "Opaque ids" says a card seen face down is shown under an id, "Cards" says a hand is a count, never a list of ids, and of the engines read here only Courtisans shows a face-down card under an id (its hidden spy), where Flip 7, Skyjo and Exploding Kittens give counts. Love Letter follows the counts, so its ids only name cards that are face up or in their owner's hand, and the only use of `reissueIds` is the two cards a Chancellor puts back

### Gaps (proposed as issues; nothing is written in Linear, the owner is asked at the hand-over of the engine)
- Engine lane: the conformance suite should not read as a leak an id that an entry shows to a player it is addressed to; a threshold end for `RoundsRule` (every player at or above the target wins); the machinery of a step and its helpers (listed in Friction) as one shared module; an ordered choice cleaner. What holds meanwhile is in Friction. None of them blocks the engine
- Board lane (`engine-board`): a piece made from a glTF (the favor token's 3D model, `Pictures` above), and a card that only some players have seen (a reveal for one viewer, a mark by the opponent's hand). The board draws both from the log meanwhile

### The next step needs
The binding and the board (`engine-board`): `GAME` exported, the three tests of `src` (the contract suite moves from the engine package), `ERROR_CODES = ["MUST_PLAY_COUNTESS"]`. The texts of the three score lines (`score.rounds`, `score.won`, `score.spy`) and the message of `MUST_PLAY_COUNTESS` in the game's Sanity (`game-sanity-create`), and `content/parity` gains the blocks that check them

## Making it playable
Follow `template/CLAUDE.md` ("Adapting to a new game"): write the engine (planned above), export it as `GAME` from `src/index.ts`, add the board (`Game` in `src/ui.tsx`, loaded lazily as in the template), then set `live` (and `indexable` once it is ready for search engines) in `packages/games/src/registry.ts`.

## Commits
Gitmoji format: `<emoji>(love-letter): <description>`
