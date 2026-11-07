# Where cards are

A card is in exactly one place at a time: a pile, a hand, in front of a player, in the middle or set aside. The engine keeps each place as a list in the state, the view says what each viewer may see of it, and the board lays it out with a [Pile](06-decks-and-piles.md#pile) or a [Zone](#zone), both shared in `packages/table/src/zone/`. The kit's helpers that draw, deal and reshuffle the piles are in [Decks and piles](06-decks-and-piles.md).

## The places

Read from the engines of Flip 7, Exploding Kittens and Courtisans and from the template's demo. Not every game has every place, and only the template and Courtisans have a board: for the other two, the last column is what the shared tools offer.

| Place | In the state | In the view | On the table |
| --- | --- | --- | --- |
| Draw pile | `deck`, top first (Flip 7, Exploding Kittens, Courtisans) | Its size; Flip 7 adds how many cards of each face it holds, Exploding Kittens the top cards the viewer knows (`me.top`) | A `Pile` given the count; Courtisans draws its own at `DRAW_PILE` |
| Discard | `discard`, top first (Flip 7, Exploding Kittens) | Every card, top first | A `Pile` whose `top` is the card on top, or a `Zone` over `pile` when the cards stay readable |
| Hand | `hands` for each seat (Exploding Kittens), `hand` on the player (Courtisans, the template) | The whole list to its owner, a count to the others | A `Zone` over a `fan` in front of the viewer ([Hand](#hand)) |
| In front of a player | `lines` for each seat (Flip 7), `domain` on the player (Courtisans) | Every card | A `Zone` framed on the seat; Courtisans' `arrangeDomain` piles a domain by family |
| The middle | `trick` and `lastTrick` (the template), `table` (Courtisans) | Every card | A `Zone` with the game's own layout: `trickPose` and `collectedPose`, or `tablePose` in Courtisans |
| Held aside | `held` of a `flip` frame and `card` of a `target` frame (Flip 7), `kitten` of the `defuse` phase (Exploding Kittens), `setAside` (Courtisans) | The first three to everybody, `setAside` to nobody | No board draws it |

- A card moves by leaving one list and joining another in the same step: `removeFrom`, in Flip 7 and in Exploding Kittens, throws a `RangeError` for a card that is not where the step says it is.
- The state names a card by an id, or by the game's own card object (the `Courtier` of Courtisans, the `Card` of the template). The view turns an id into a `Face` for the viewers who may see it and into a count for the others ([Hidden information](../01-the-game/10-views.md#hidden-information)).
- What the view leaves out is hidden: the `PlayerView` of Courtisans has no `setAside` and no `eliminated`, and an eliminated card reaches a viewer as a `cardEliminated` event of the log.
- The engine's piles are top first; the `pile` layout is bottom first and card `i` takes slot `i` ([Layout helpers](08-layout-helpers.md)): reverse a top-first list before it goes to a `Zone` over `pile`.
- A `PlayZone` of Courtisans (`table`, `domain`, `opponentDomain`) says where a card may be played and holds no card: `availableZones` of the view tells the board which are still open.

## Zone

A zone is some cards on the table in a layout: the first card takes the first slot, the second the second, and so on, all drawn in the frame of the zone. A hand, a player's cards and the middle of the table are all zones. Shared: `packages/table/src/zone/zone.tsx`; `place` of `place.ts` is internal and works out each card's `target` and `from` (`place.test.ts` states how). The props are `ZoneProps`:

| Prop | Role |
| --- | --- |
| `frame` | Where the zone lies and which way it faces, a `Spot`; the layout is drawn in it. The table itself when not given |
| `layout` | The slots, one `Pose` per card, in the frame of the zone: `fan`, `row`, `pile`, `grid` or the game's own |
| `size` | The `CardSize` of every card of the zone |
| `enter` | Where a card with no `from` of its own comes in from, on the table and not in the frame: the deck a hand is dealt from |
| `stagger` | The seconds between two cards coming in from `enter`; zero sends them together |
| `cards` | The cards, in the order of the slots, as `ZoneCard`s: the props of a [Card](04-cards.md#card) but `target` and `size`, which the zone gives, plus a React `key` |

The three zones of a table, each a `Zone` with its own frame and layout, named on the table.

```specimen
scene-zones
```

| Zone | `frame` | `layout` |
| --- | --- | --- |
| The viewer's hand | None, the table | A `fan` in front of the viewer |
| A player's cards | The player's seat, from `seats` | A `row` of backs, a `fan`, a `grid` |
| A shared zone, the middle of the table | None | The game's own, one pose per card |

- A card with no slot is not drawn, and a slot with no card stays empty.
- A card keeps its `key` from one render to the next, so it glides from slot to slot instead of flying in again. A card that changes zone is a new element: give it the same `id` in both zones, and the [pose memory](05-poses-and-motion.md#pose-memory) does the rest.
- A card comes in from `enter` a `stagger` after the one before it, counted from the first card of the zone, so a card that joins later waits for its place in the list. Its own `from` wins, `from` set to `null` keeps the zone from adding an entrance, and an entrance only plays when a card mounts.
- A zone owns no state and is a toolbox the game composes, not a declarative board: the game decides which cards are in it and in what order, one `Zone` per area, with the layout and the cards it computes from its view.

From `template/src/components/board/scene.tsx`, the cards an opponent holds, seen from behind:

```tsx
<Zone
  frame={backFrame(s)}
  layout={backLayout(s, j.cardCount)}
  size={CARD_SIZE}
  enter={DECK_POSE}
  cards={Array.from({ length: j.cardCount }, (_, i) => ({ key: `back-${j.id}-${i}`, front: back, back }))}
/>
```

## Hand

A hand is the cards a player holds, which only they may read. It is written per game; the reference is the template's `template/src/components/board/layout.ts` and `template/src/components/board/scene.tsx`. Flip 7 has no hand, since every card is turned face up the moment it is drawn.

| Example | In the state | In the view: the owner | In the view: the others |
| --- | --- | --- | --- |
| Exploding Kittens | `hands`, the ids each seat holds | `me.hand`, a list of `Face` | `players[].cards`, a count |
| Courtisans | `hand` on each `Player`, a list of `Courtier` | `me.hand` | `players[].handCount` |
| The template | `hand` on each `PlayerState`, a list of `Card` | `me.hand` | `players[].cardCount` |

- `me` is `null` for a viewer outside the table, and the scene then draws no hand: `view.me?.hand ?? []`. Exploding Kittens gives its eliminated players that view too. Test the view for every kind of viewer ([Hidden information](../01-the-game/10-views.md#hidden-information)).
- The list is the order on the table, the first card on the left: the engine sets the order and the template's scene does not sort it.
- An opponent's hand is a count, so the scene draws that many backs in a `Zone` framed on their seat, keyed by position, and a card they play starts from that row (`backFrame`, `backLayout`, `backPose`). The view of Courtisans carries `handCount`, and its board draws no opponent's hand.
- Cards come in from `enter` (`DECK_POSE`, above the middle of the table), a `stagger` apart.
- The board keeps the id of the hovered card and lifts its slot with `shifted`; a click calls the handler that posts the play. The template does both on the viewer's turn only, and the engine decides whether the card may be played (`UNKNOWN_CARD`, `NOT_YOUR_TURN`) ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)).
- Courtisans' hand stays on the screen with the camera, in its own code (`cameraPose` in `games/courtisans/src/components/game3d/scene.tsx`): a click selects a card and a second click on a target plays it. The shared tools lay cards on the table ([what is not built](../03-not-built-yet.md)).

From `template/src/components/board/layout.ts`, the fan of a hand of `n` cards with the hovered slot lifted:

```ts
/** The slots of a hand of `n` cards, a fan in front of the viewer. The card at index `raised` (-1: none) lifts toward them */
export function handLayout(n: number, raised: number): Pose[] {
  const R = LAYOUT_SETTINGS
  const slots = fan(n, { gap: R.handGap, y: R.handY, rise: 0.004, z: R.handZ, curve: 0.06, tilt: R.handTilt, roll: 0.05, scale: R.handScale })
  return slots.map((slot, i) => (i === raised ? shifted(slot, { y: R.hoverLift, z: -0.25 }) : slot))
}
```
