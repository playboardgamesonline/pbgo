# Phases

A phase is where the game is: it decides which actions are accepted and whom the game waits for. The kit has no helper for phases ([Not built yet](../03-not-built-yet.md#what-games-ask-for)), so each engine keeps its own in the state and its hooks read it.

| Example | How a phase is stored | Where |
| --- | --- | --- |
| Courtisans | `phase`, a string (`Phase`): `missions`, `playing` or `over` | `games/courtisans/packages/engine/src`: `types.ts`, `actions.ts` |
| The template's demo | `phase`, a string: `bidding`, `playing` or `over` | `template/packages/engine/src/demo`: `types.ts`, `game.ts` |
| Exploding Kittens | `phase`, a union tagged by `kind`, each member with its own data (`Phase`, `PhaseOf`) | `games/exploding-kittens/packages/engine/src`: `types.ts`, `machine.ts`, `window.ts` |
| Flip 7 | `stack`, a list of frames (`Frame`, `FrameOf`) that `run` plays until one needs a player | `games/flip-7/packages/engine/src`: `types.ts`, `machine.ts`, `round.ts` |

## Keeping a phase

- A string is enough when a phase carries no data of its own: the bids of the template's `bidding` are in `bids`, and the missions of Courtisans in a `missionsRead` flag for each player.
- A tagged union gives each phase its own data, and the type narrows with it: `reaction` holds `pending`, `nopes` and `passed`, `give` holds `from` and `to`, and `PhaseOf<"reaction">` names one member for the code that works on it.
- A stack suits steps inside steps: a Flip Three pushes a `flip` frame, and a Freeze flipped during it waits in `held` and becomes a `target` frame once the flips are done. Only the last frame is worked on, and `giveCard` throws a `RangeError` for any other.
- The state never sits between two phases: the action that ends a phase also starts the next, so `apply` returns a state that waits for a player or is over ([Simultaneous steps](03-turns.md#simultaneous-steps)). The last `readMissions` of Courtisans sets `playing`, the last `pass` of a Nope window runs `closeWindow`, and every action of Flip 7 has `run` play the round until it needs a player.
- `waitingFor` and `autoPlayFor` read the phase: Exploding Kittens switches on `phase.kind`, Flip 7 reads the kind of the last frame ([`waitingFor`](03-turns.md#waitingfor), [Absent players](03-turns.md#absent-players)).
- An action sent in a phase that does not take it is refused with an `EngineError`: `INVALID_PHASE` in Courtisans and the template, `INVALID_ACTION` in Exploding Kittens and Flip 7. The shared vocabulary keeps `INVALID_ACTION` for an action that is wrong anywhere and `INVALID_PHASE` for the right action at the wrong moment ([The shared codes](05-actions.md#the-shared-codes)).
- `over` is the last phase of Courtisans, the template and Exploding Kittens. Flip 7 has no such frame: `isOver` reads the scores of the finished rounds ([Rounds](06-victory.md#rounds)), and the `publicPhase` of its view says `over`.

From `games/exploding-kittens/packages/engine/src/machine.ts`, `waitingFor` reading the phase: a finished game waits for nobody, a Favor names its player, a Nope window lists every responder, and any other phase waits for the player of the turn.

```ts
export function waitingFor(s: State): string[] {
  const phase = s.phase
  switch (phase.kind) {
    case "over":
      return []
    case "give":
      return [phase.from]
    case "reaction":
      return s.seats.filter((id) => Object.hasOwn(phase.passed, id))
    default:
      return [currentId(s)]
  }
}
```

## The phase in the view

- Core does not read the phase of a view: the end of the game is `PublicGame.status`, which it sets from `isOver`, so a view names its phase as the board needs ([What core reads from a view](10-views.md#what-core-reads-from-a-view)). Courtisans and the template send the phase string of their state.
- Exploding Kittens and Flip 7 send a `PublicPhase` instead, an object with a `kind` that holds what a viewer may see of the phase. Flip 7's `PublicPhase` has `turn`, `target`, `between` and `over`, and none of the frames the round plays by itself.
- The board draws from the phase of the view: the template shows its `BidPanel` while `phase` is `bidding`, and Courtisans re-words the takeover pill (`labels` of `StalledTurn`) while it is `missions`. What a board shows at the opening and at the end is in [Opening and ending](06-victory.md#opening-and-ending).

## Choices

A choice is a decision one player makes inside a phase: who gets an action card, which card to give, where to put a Kitten back. The engine keeps the pending choice in the state, so `waitingFor` names the player and the view gives the board what it needs to offer the options. The code is in `games/flip-7/packages/engine/src` (`types.ts`, `machine.ts`, `round.ts`, `actions.ts`) and `games/exploding-kittens/packages/engine/src` (`types.ts`, `machine.ts`, `actions.ts`).

| Choice | Pending as | Waited for | The answer |
| --- | --- | --- | --- |
| Flip 7: who gets an action card | The `target` frame: `seat` of the holder and `card` | The holder | `target`, a player id |
| Exploding Kittens: where a Kitten goes back | The `defuse` phase: `kitten` | The player of the turn | `defuse`, a `position` in the draw pile |
| Exploding Kittens: which card a Favor takes | The `give` phase: `from` and `to` | `from` | `give`, a `card` of their hand |
| Exploding Kittens: which card to take from the discard | The `pick` phase: `played` | The player of the turn | `pick`, a `card` of the discard |

- The pending choice holds what cannot be computed and never its options: `targetsOf` gives the seats that can get a card, and the action, the view and `autoPlayFor` all call it ([Lean state](09-state.md#lean-state)).
- Flip 7 settles a choice that has one option or none: `run` gives the card to the only player who can get it and discards it when nobody can, so a `target` frame is left only when there is more than one option. Exploding Kittens asks a choice of one: a Favor opens `give` for a hand of one card.
- While a choice is pending only its answer is accepted, from the player waited for: anybody else gets `NOT_YOUR_TURN`, and any other action of that player `INVALID_ACTION` ([What `apply` checks](05-actions.md#what-apply-checks)). A `nope` or a `pass` is looked at first and gets `NOT_WAITING` outside a window.
- A wrong answer has a code of its own: `INVALID_TARGET` for a target that `targetsOf` or `checkTarget` does not allow, `BAD_POSITION` for a place outside the pile, `UNKNOWN_CARD` for a card that is not in the hand and `INVALID_PICK` for one that cannot be taken. A number of the wrong type is `INVALID_ACTION` (`intField`).
- A refusal leaves the state as it was, so the choice stays pending and the player may answer again.
- The view gives the board what the options are made of. Flip 7's `target` phase holds the holder, the card as a `Face` and `targets`, the ids that can get it in seat order. Exploding Kittens' `give` names `from` and `to` (the options are the hand of `from`, `me.hand`), `defuse` shows the `kitten` (the options are the places in the pile, up to its size `deck`) and `pick` shows `played` (the options are the public `discard`, less `played` and the Kittens).
- A choice made with the move needs no pending state: `play` and `combo` of Exploding Kittens carry a `target` (and `named`), checked by `checkTarget` when the card is played and by `hasCards` again when it resolves, and `playCard` of Courtisans carries a `Target` and, for an assassin, a `victimId`. The board of Courtisans holds the half-made choice itself (`Assassination`) and sends one action.
- `autoPlayFor` answers a pending choice with the function of the action (`chooseTarget`, `defuse`, `give`, `pick`), so an absent player's answer passes the same checks.
- What the table draws of the options is in [Clicks and hover](05-actions.md#clicks-and-hover) and [Glows](../02-components/04-cards.md#glows).

## Reactions

A reaction is a window in which the other players may answer an action before it takes effect: in Exploding Kittens every action card and every combo opens a Nope window on itself, where a Nope cancels the action and a Nope on a Nope brings it back. The window is the `reaction` phase of the state; `openWindow` is in `games/exploding-kittens/packages/engine/src/machine.ts`, and the answers and the closing are in `window.ts` of the same folder. The passes are kept with the kit's `Submissions` ([Simultaneous steps](03-turns.md#simultaneous-steps)).

| Field | What it holds |
| --- | --- |
| `pending` | What waits behind the window: a card (`CardPending`) or a combo (`ComboPending`), with its author and the player it names |
| `nopes` | The chain: each Nope as `{ card, by }`, oldest first |
| `passed` | `Submissions<true>` of the players who may answer: `null` until they pass, `true` after; a Nope opens it again |

- The cards of the action sit on the discard from the start (`play`, `playCombo`): a Noped action costs its cards.
- Every living player may answer but the author of the last card of the chain: `openWindow` leaves out the author of the card and `nope` the author of the Nope, so the author of a card may Nope a Nope on it and the author of a Nope cannot answer it.
- `waitingFor` lists every responder in seat order, those who passed too, and a pass emits no event, so nothing a viewer sees tells who passed. The view gives a responder their own pass only (`passed`).
- `chain` is the number of Nopes. The view sends it and `nope` and `pass` carry it back; `responding` refuses any other number with `STALE_REACTION`, so an answer given before a Nope does not count for the window that Nope opened.
- The checks run in this order: the shape (`INVALID_ACTION`), the player (`NOT_WAITING` for a stranger, for the author of the last card and when no window is open), the chain (`STALE_REACTION`), the hand (`UNKNOWN_CARD`) and the card (`NO_NOPE`). Any other action is `REACTION_OPEN`.
- A pass is not final: a responder who passed may still Nope while the window is open, and a Nope clears every pass. A second pass is `ALREADY_PASSED`.
- The last pass closes the window in its own action. `closeWindow` leaves the phase for `turn`, then the chain decides: an odd number of Nopes cancels the action (`cancelled`), an even number resolves it (`resolved`) and runs its effect, which may open the next phase (`give`, `pick`) or end the turn.
- `autoPlayFor` closes the window for everybody with `closeWindow`. `resolveWindow` is that close as a function of a state, what a timer would call, and changes nothing when no window is open; the engine has no timer ([what the contract leaves out](../03-not-built-yet.md#what-the-contract-leaves-out)).
