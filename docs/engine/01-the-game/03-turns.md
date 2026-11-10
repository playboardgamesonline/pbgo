# Turns

The engine tells the server whose move it is with `waitingFor`, and how to play it for a player who left with `autoPlayFor`; core does the rest. The kit's turn helpers read both, and everything that needs to know whose turn it is goes through them, never through the hooks of the definition. The module is `packages/engine-kit/src/turns.ts`. The board follows the turn with a crown, an aura and an announcement.

## Kinds of game

A game's kind is how many players `waitingFor` names at a time and what ends the wait. The framework has the first two kinds, either of them with a clock; the others are not built ([Not built yet](../03-not-built-yet.md)).

| Kind | How it plays | In the framework | Examples |
| --- | --- | --- | --- |
| Turn by turn | One player acts, then the next | `waitingFor` lists one player | Flip 7, Exploding Kittens, Courtisans |
| Simultaneous step | Several players answer in any order, the last answer ends the step | `waitingFor` lists several players ([Simultaneous steps](#simultaneous-steps)) | The secret bids of the template, the Nope window of Exploding Kittens, the reading of the missions in Courtisans |
| Without turns | Any player acts at any moment | Not built | The Mind |
| Timed | A clock closes the wait, and the game plays for the players it was waiting for | A `Timer` in the state, `begin`, `nextDeadline` and a system action ([Timers](../02-components/20-timers.md)) | The template's option `turnSeconds` |
| Asynchronous | Turns spread over several days | Not built (PLT-30) | |

A game can mix the first two: most of its play is turn by turn and some steps are simultaneous.

## `waitingFor`

- `waitingFor(state)` returns the ids of the players the server waits for, in seat order and without duplicates ([Every order comes from an array](09-state.md#every-order-comes-from-an-array)).
- It lists one player on a classic turn and several on a simultaneous step. It is empty when the game is over, or when the engine itself waits for something that is not a player, such as a deadline.
- It is public: `publicGame` sends it to every viewer, so it never reveals anything hidden. When knowing who is still pending would tell something (who passed on an answer, say), keep the player listed until it is public anyway.
- The shared UI draws from it: the ticker's main line, the players strip when several players are waited for ([In-game UI](../../design/04-in-game/05-players-strip.md)) and the takeover pill.

From `template/packages/engine/src/demo/game.ts`, a game that waits for everyone who has not bid, then for the player of the turn:

```ts
function waiting(state: State): string[] {
  if (state.phase === "bidding") return pendingSubmissions(state.bids, seats(state))
  if (state.phase === "playing") return [state.players[state.activePlayer]!.id]
  return []
}
```

## Turn helpers

The helpers take a definition, or any object that has the turn hooks (`TurnHooks`), and read the deprecated hooks too, so an engine written for the older contract keeps running ([Deprecated hooks](11-the-contract.md#deprecated-hooks)).

| Export | What it does | Errors |
| --- | --- | --- |
| `TurnHooks<State>` | The part of a definition the helpers read: `isOver`, `waitingFor`, `autoPlayFor` and the deprecated `activePlayer`, `autoPlay` and `debug` | |
| `waitingPlayers(game, state)` | The players the game waits for: `waitingFor`, else `activePlayer` as a list of one. A new array, in the order the engine gave, without duplicates, that drops anything that is not a string (the `null` of an `activePlayer` with nobody to play); empty once the game is over | |
| `currentPlayer(game, state)` | Whose turn it is, or `null`: the deprecated `activePlayer` when the game has it, else the first waiting player | |
| `canPlayFor(game)` | Whether the server can play for an absent player: the game knows who waits and has a way to play. Reads the definition, not a state | |
| `playFor(game, state, playerId)` | Plays the current step of one waiting player with `autoPlayFor`; the deprecated `autoPlay` or `debug.turn` serve only when that player is the only one waiting (`canPlayFor` does not check it) | `EngineError`: `NOT_WAITING` for a player who is not waiting and for anybody once the game is over, before a hook plays; `AUTOPLAY_UNSUPPORTED` when the game has no way to play for that player |
| `playOn(game, state, maxSteps?)` | For tests, simulations and previews: plays for the first waiting player again and again, until the game is over, nobody is waiting or `maxSteps` plays were made, which stops a game that never ends ([Testing turns](../04-build-a-game/06-testing.md#testing-turns)) | `EngineError`: `AUTOPLAY_UNSUPPORTED` |

## Simultaneous steps

A simultaneous step is one that several players answer in any order, the last answer ending it: secret bids, everybody reading their missions. Keep the answers in the state as `Submissions<T>`; the helpers that open a step, record an answer, list who is pending and reveal the answers are in `packages/engine-kit/src/simultaneous.ts`. The demo's secret bids are the example: `bid` in `template/packages/engine/src/demo/game.ts`, with the `waiting` function above.

| Export | What it does | Errors |
| --- | --- | --- |
| `Submissions<T>` | The answers of a step: a record by player id, `null` until the player answers | |
| `openSubmissions(playerIds)` | Opens the step: nobody has answered | |
| `submit(submissions, playerId, value)` | A new step with that answer; answering again replaces it | `RangeError` for a player outside the step and for a `null` or `undefined` answer |
| `allSubmitted(submissions)` | True once every player has answered | |
| `pendingSubmissions(submissions, playerIds)` | The players who have not answered, in the order of `playerIds` | |
| `submittedFlags(submissions)` | Who has answered, as a boolean by player id, and never what | |
| `revealSubmissions(submissions, playerIds)` | The answers in the order of `playerIds`: `answers[seat]` is the answer of the player in that seat | `RangeError` for an answer that is missing |

- `playerIds` is the game's own list of players in seat order: the keys of a stored record come back in the database's order ([Every order comes from an array](09-state.md#every-order-comes-from-an-array)).
- In `apply`, record the answer and, once `allSubmitted` is true, resolve the step in the same action with `revealSubmissions`.
- In `waitingFor`, return `pendingSubmissions`; when who has answered is secret, list every player instead, as the Nope window of Exploding Kittens does.
- In `view`, show `submittedFlags` and no answer until the step is resolved.
- A game whose answers are final refuses the second one itself, with its own `EngineError`, before it calls `submit`.
- `0`, an empty string and `false` are answers, only `null` means no answer, and a step with no player is complete.
- On the table, an answer that is given and not yet known is a card face down at its player's seat, and the bids turn over together when the step is resolved: [A bid made with cards](../02-components/12-bets-and-choices.md#a-bid-made-with-cards).

## Tricks

A trick is a round of the table in which every player plays one card, in turn: the card of the player who leads sets the suit, the others follow it when they can, and the best card takes the trick, whose winner usually leads the next (Skull King, Wizard, Hearts, Omens, Cry Baby, French Tarot). The cards are opaque ids in the state, so the helpers are given `suitOf` and `rankOf`, which read a card in the game's catalogue. They keep no state: the trick is the game's to store, a leader and the plays in the order they were made, and the helpers answer the questions about it. They are in `packages/engine-kit/src/tricks.ts`.

| Export | What it does | Errors |
| --- | --- | --- |
| `TrickPlay` | `{ playerId, card }`: a card played to a trick, and who played it | |
| `TrickCards<Card>` | What a card is to a trick: `suitOf(card)`, the suit it belongs to, or null for a card with none (a jester, an escape), and `rankOf(card)`, how high it ranks in its suit | |
| `TrickRules<Card>` | The cards, the `trump` suit of the round, and two ways for the special cards of a game to overrule the usual rules, `beats` and `decide` | |
| `TrickContext` | `{ led, trump }`: what the rules of the game's own are told about the trick | |
| `ledSuit(plays, suitOf)` | The suit that was led: that of the first card played that has one, so a jester that leads leaves it to the next card; null while no card played has a suit | |
| `playableCards(hand, led, { suitOf, free? })` | The cards a player may play, in the order of the hand: those of the led suit when the hand holds any, else every card, and every card when nothing was led. `free` names the cards that may always be played (a wizard, an escape) | |
| `outranks(card, winning, rules)` | Whether a card takes the trick from the one that is winning it, by the usual rules: a card with a suit beats one with none, a trump beats what is not a trump, two cards of a suit are told by their rank, the first played keeps a tie, and a card of another suit never wins | |
| `trickWinner(plays, rules)` | The play that takes the trick: `decide` of the game first, then each card meets the one that is winning so far, through `beats` of the game and then `outranks` | `RangeError` for a trick with no card |
| `playOrder(players, leader)` | The players in the order they play: the leader first, then the others round the table | `RangeError` for a leader who is not a player |

- In `apply`, a card played is checked in three steps, each with its code: the card is in the hand (`UNKNOWN_CARD`), it is the player's turn (`NOT_YOUR_TURN`), and it is among `playableCards(hand, ledSuit(plays, suitOf), { suitOf, free })`, which refuses with a code of the game's own, such as `MUST_FOLLOW_SUIT`, listed in its `ERROR_CODES`. The card then joins the plays, and when the last player has played `trickWinner` gives the winner, who takes the cards and leads the next trick.
- The special cards of a game are rules of its own. `beats(card, winning, { led, trump })` says that a wizard beats everything and that a card that meets a wizard does not: true, false, or undefined to leave it to the usual rules. A rule that no two cards give goes in `decide(plays, { led, trump })`: Skull King's mermaid takes the trick that holds the Skull King, although the cards met in turn would give it to him.
- The helpers do not count tricks, bids or points. What a bet is worth, who leads the first trick, what the trump of a round is and how many cards are dealt are the game's: a bet is asked with the [fields of the table](../02-components/12-bets-and-choices.md) and checked with `cleanNumber`, and the scores of several rounds are [Rounds](06-victory.md#rounds).
- On the table the cards of a trick lie in the middle, each toward the seat that played it ([A trick](../02-components/07-zones.md#a-trick)).

```ts
const rules: TrickRules<string> = {
  suitOf: (card) => CARDS[card].suit,
  rankOf: (card) => CARDS[card].rank,
  trump: state.trump,
  // A wizard beats everything the first time, and nothing beats it; the rest is the usual rules
  beats: (card, winning) => (CARDS[winning].kind === "wizard" ? false : CARDS[card].kind === "wizard" ? true : undefined),
}

function playCard(state: State, playerId: string, card: string): State {
  const hand = state.hands[playerId] ?? []
  if (!hand.includes(card)) throw new EngineError("UNKNOWN_CARD")
  if (state.turn !== playerId) throw new EngineError("NOT_YOUR_TURN")
  const free = (card: string) => CARDS[card].kind !== "number"
  if (!playableCards(hand, ledSuit(state.trick, rules.suitOf), { suitOf: rules.suitOf, free }).includes(card)) throw new EngineError("MUST_FOLLOW_SUIT")
  const trick = [...state.trick, { playerId, card }]
  const next = { ...state, hands: { ...state.hands, [playerId]: hand.filter((held) => held !== card) }, trick }
  // The trick goes on: the next player plays
  if (trick.length < state.players.length) return { ...next, turn: playOrder(state.players, state.leader)[trick.length]! }
  // The last card: the best takes the trick and leads
  const winner = trickWinner(trick, rules)
  return { ...next, trick: [], leader: winner.playerId, turn: winner.playerId, won: { ...state.won, [winner.playerId]: (state.won[winner.playerId] ?? 0) + 1 } }
}
```

## Drafting

In a draft every player picks a card from their hand, the picks are revealed together, and the hands go on to the next player, until the hands are empty (7 Wonders, Sushi Go). A pick made at once is a [simultaneous step](#simultaneous-steps), a `Submissions` of the card that each player picked; what is left to do when the last pick is in is to take each card from its hand and to turn the hands round the table. The helpers are in `packages/engine-kit/src/draft.ts`, and the hands are lists in seat order: `hands[seat]` is the hand of the player in that seat.

| Export | What it does | Errors |
| --- | --- | --- |
| `passAround(hands, steps)` | The hands after they were passed `steps` seats on: the hand of seat `i` goes to seat `i + steps`, round the table. One step gives each hand to the next player in seat order, a negative number gives it to the player before (the second age of 7 Wonders), and a whole turn gives the hands back as they were | `RangeError` for steps that are not a whole number |
| `takePicks(hands, picks)` | Each player takes the card they picked: the hands without the picked cards, and `taken[seat]`, the card of the player in that seat. A card that is twice in a hand leaves it once | `RangeError` for picks that are not as many as the hands, or a pick that is not in its hand |

- A pick is checked when it is made, in `apply`: the card is in the player's hand (`UNKNOWN_CARD`). A player may change their pick until everybody has picked, since answering again replaces it.
- When the last pick is in, `revealSubmissions` gives the picks in seat order, `takePicks` the hands and the cards taken, and `passAround` the hands for the next round. The direction is the game's: in 7 Wonders it changes with the age.
- The view says who has picked and never what, until the picks are revealed. Each player reads their own hand and the cards they have taken.
- A draft that picks from a row on the table (the factories of Azul, a market) is no pass: the row is a list in the state, and a pick takes a card out of it in turn, with the cards a `Zone` lays out ([Where cards are](../02-components/07-zones.md)).

```ts
// Everybody has picked: the cards leave their hands and join the tableaux, and the hands go on to the next player
function reveal(state: State): State {
  const { hands, taken } = takePicks(state.hands, revealSubmissions(state.picks, state.players))
  const empty = hands.every((hand) => hand.length === 0)
  return {
    ...state,
    hands: empty ? hands : passAround(hands, state.age === 2 ? -1 : 1),
    tableaux: state.tableaux.map((cards, seat) => [...cards, taken[seat]!]),
    picks: openSubmissions(state.players),
  }
}
```

## Absent players

When the others vote to play for a player who left, the server calls the engine's `autoPlayFor` and stores the result. The engine writes that one hook; the vote, the delay and the presence are core's (the pure rules are in `packages/core/server/takeover.ts`).

### Playing for an absent player

- `autoPlayFor(state, playerId)` completes the current step of one waiting player: afterwards they no longer wait for it, though they may wait for the next, such as their next turn.
- It plays one player at a time: a step owed by several players is played for player by player, each by its own vote.
- It always produces a legal state, and it is deterministic: seeded streams only ([Determinism](09-state.md#determinism)).
- It throws `EngineError("NOT_WAITING")` when `playerId` is not in `waitingFor(state)`.
- It is a fallback that keeps the table moving, not an AI: the simplest legal play.

### Absent players in core

1. **The delay.** No write to the table for `turnTimeout`, less `STALL_GRACE_MS`. The gamemaster sets it per game in Setup › Mechanics, within `TURN_TIMEOUT_BOUNDS`; a vote does not restart it.
2. **The pill.** A board mounts `StalledTurn`. Once the delay has passed and the game waits for somebody else, it offers to play for them and shows how many of the required voters have voted; `labels` re-words it for a phase.
3. **The vote.** `POST .../takeover` with the `playerIds` to play for (by default every player waited for, never the voter), under the `vote` rule of `RATE_LIMITS`. The votes are stored in `takeover_votes` with a fingerprint of the state: a move changes it, so older votes are ignored.
4. **The checks.** `TAKEOVER_UNSUPPORTED` when `canPlayFor` is false, `UNKNOWN_PLAYER` for a voter outside the table, `GAME_NOT_STARTED`, and `NOT_STALLED` when the table moved within the delay or nobody is waited for any more.
5. **Who must agree.** Every present member other than the target. Present means seen within `PRESENCE_WINDOW_MS`: reading the table, playing, voting or chatting records the player (`markSeen`) without changing `version` or `updated_at`, and a board reads its table on a timer, which keeps its player present. The voter always counts as present, an absent member never blocks, and a voter who is alone is enough.
6. **The play.** For each target whose vote is complete, in the order the game waits for them, the route calls `playFor` if the game still waits for the player, then stores the new state with `takeover_votes` emptied, in one write. A takeover that ends the game stores the status `over`.

### A player who leaves the game

A player can leave a game in progress (the "Leave" row of the menu of the game, after a confirmation; PLT-120). Their seat stays in the state, since the engine has it, and the server plays it from then on with `autoPlayFor`, with no vote and no delay, so that the others can finish:

- At once when the game waits for them, and again after every move of the others that reaches a step they owe: the move and the steps played for the players who left are one write. A step owed by several players is played for the players who left only.
- Never when everybody left: the table is abandoned, not played out alone. And a game that `canPlayFor` is false for keeps waiting; the others cannot vote either (`TAKEOVER_UNSUPPORTED`).
- The game they leave can end this way: it is stored `over` and recorded like any other, with their seat among those that count for no rating (`taken_over`, as for the players the others voted to play for).
- The engine writes nothing more for it: `autoPlayFor` is the same hook, with the same rules, and a step it cannot complete (it throws an `EngineError`) is left to the others' vote. The player takes no further part: they see the table as a spectator (`meId` null), are not present for the takeover, and refused by the routes that act for a player (`LEFT_GAME`, `UNKNOWN_PLAYER`). The rules are pure and tested in `packages/core/server/table-rules.ts`.

## Crown and the turn marker

The turn marker is a crown that stands on the upper-right corner of the avatar of the player whose turn it is. Shared: `TurnCrown` in `packages/table/src/seat/crown.tsx`, which a [Seat](../02-components/03-seats.md#the-plate) shows for the player of the turn. The shared UI has its own marker for the DOM ([Turn crown](../../design/04-in-game/01-screens-and-game-flow.md#turn-crown)).

| Prop | Role |
| --- | --- |
| `show` | Whether the crown is up: it grows in when true and shrinks away when false |
| `position` | Where it stands, in the frame it is placed in |
| `icon` | The URL of the game's icon, the skin's `hostIcon`, a picture from Sanity; a game with none shows a drawn crown |
| `size` | How big it grows |

- Every seat has its own crown, and `show`, set from the view, says which one is up. The crown does not travel around the table, so it never crosses the cards.
- A `Seat` places it with the avatar, in the avatar's own frame (a child of the nickname's `TableText`, or its `trailing` for a right-hand seat), at the corner that `crownRight` and `crownBack` give it ([Where the plate stands](../02-components/03-seats.md#where-the-plate-stands)).
- It is a plane that turns to face the camera about the vertical axis only, so it stays upright. While it is up it bobs and its gold pulses. It takes no pointer events ([Clicks and hover](05-actions.md#clicks-and-hover)).

## Aura

An aura is the light that glows on the table under a seat. Shared: `Aura` in `packages/table/src/seat/aura.tsx`, a plane with a shader. It lies flat over the table and under the cards.

| Prop | Role |
| --- | --- |
| `width`, `depth` | The size of the lit area, in world units; the plane is a little larger so the glow can fade out |
| `position`, `yaw` | Where it lies, just above the table, and its turn about the vertical axis |
| `force` | The strength, a number or a function read on every frame; it eases in and out |
| `color`, `light` | The colour of the edge, and the lighter colour of its glints |
| `additive` | Additive blending, on by default, which brightens what lies under it |
| `settings` | An `AuraSettings` object, read on every frame |

`AuraSettings` holds `intensity`, which multiplies `force`, and `edge`, `halo`, `stars`, `density`, `size` and `speed`: the ring along the edge, the halo outside it, the glints and how fast the light moves. It is an object per use, so a debug panel can tune two uses apart: the file exports `ZONE_AURA_SETTINGS`, the default, and `WINNER_AURA_SETTINGS`, and `AURA_FIELDS` lists the knobs a debug folder can offer (not `intensity`).

- `force` follows the state, whatever it is: set it, and the component eases there. Near zero the mesh is not drawn at all, so an unlit aura costs nothing.
- It has no texture. It is transparent, writes no depth and takes no pointer events ([Clicks and hover](05-actions.md#clicks-and-hover)).
- A `Seat` draws one under its plate, in the seat's colour, lit by the brightest of the forces that apply (`auraForce`): none for the player of the turn by default, since the crown says it, a soft one for a player the game expects with others, one under the pointer of a plate that can be picked and the full one for a winner. It uses `WINNER_AURA_SETTINGS` unless it is given another object. The colour of a seat comes from the skin's `playerColors`, through `PlayerSeat`.

## Turn change

There is no turn-transition component. A turn changes the way everything on a board does: the view changes, and each piece that depends on whose turn it is follows. Per game: the template's `board/scene.tsx` and `game/game.tsx` are the reference. The announcement and the ticker are the shared UI's.

- The scene learns that the turn changed from the view (`activePlayerId` in the template's view), never from a timer or from its own click. A player can leave `waitingFor` without having acted, because somebody played for them: follow the view.
- The crown grows on the avatar of the player whose turn it is and shrinks away from the one before. A step the game waits several players for has no single player of the turn: `PlayerSeat` shows no crown and lights a soft aura under each player expected, and the ticker's strip lists who is pending ([Seats](../02-components/03-seats.md#the-plate)).
- The hand takes clicks and the hover glow only on the viewer's turn ([Clicks and hover](05-actions.md#clicks-and-hover)).
- The cards played fly from where they were to the middle ([Pose memory](../02-components/05-poses-and-motion.md#pose-memory)); the trick won rests in the middle, then flies to its winner's side (`useCollect` in `scene.tsx`, `collectedPose` in `layout.ts`; [Zone](../02-components/07-zones.md#zone)).
- When the viewer's turn begins, an effect of `game/game.tsx` calls `announce` with the kind `turn`, its sound and `replace: ["turn"]`, which drops a `turn` announcement that is still queued, so a quick succession shows the latest. `useAnnouncements` can also be `paused`, which holds the queue while something else, an opening for instance, has the screen ([Opening and ending](06-victory.md#opening-and-ending)).
- The kinds are `start`, `round`, `turn` and `victory`; their look is `UI_THEME.announcement` ([Announcements](../../design/04-in-game/06-announcements.md)). The TRANSITION tab of the debug panel holds their presets and a "Replay" folder with a button for each: the way to see a turn change without playing one ([Tuning](../04-build-a-game/07-tuning.md)).
