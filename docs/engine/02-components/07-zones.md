# Where cards are

A card is in exactly one place at a time: a pile, a hand, in front of a player, in the middle or set aside. The engine keeps each place as a list in the state, the view says what each viewer may see of it, and the board lays it out with a [Pile](06-decks-and-piles.md#pile) or a [Zone](#zone), both shared in `packages/table/src/zone/`. The kit's helpers that draw, deal and reshuffle the piles are in [Decks and piles](06-decks-and-piles.md).

## The places

Read from the engines of Flip 7, Exploding Kittens and Courtisans and from the template's demo. Not every game has every place, and only the template and Courtisans have a board: for the other two, the last column is what the shared tools offer.

| Place | In the state | In the view | On the table |
| --- | --- | --- | --- |
| Draw pile | `deck`, top first (Flip 7, Exploding Kittens, Courtisans) | Its size; Flip 7 adds how many cards of each face it holds, Exploding Kittens the top cards the viewer knows (`me.top`) | A `Pile` given the count; Courtisans draws its own at `DRAW_PILE` |
| Discard | `discard`, top first (Flip 7, Exploding Kittens) | Every card, top first | A `Pile` whose `top` is the card on top, or a `Zone` over `pile` when the cards stay readable |
| Hand | `hands` for each seat (Exploding Kittens), `hand` on the player (Courtisans, the template) | The whole list to its owner, a count to the others | A `Zone` over a `fan` at the bottom left of the screen for the viewer ([The hand in the corner](#the-hand-in-the-corner)), a fan of backs held up at each seat for the others ([Held hands](#held-hands)) |
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
| The viewer's hand | None here; on a board, the corner of the screen ([The hand in the corner](#the-hand-in-the-corner)) | A `fan` made to fit the room the screen leaves it |
| A player's cards | The player's seat, from `seats` | A `fan` of backs held up with its shadow ([Held hands](#held-hands)), a `row`, a `grid` |
| A shared zone, the middle of the table | None | The game's own, one pose per card |

- A card with no slot is not drawn, and a slot with no card stays empty.
- A card keeps its `key` from one render to the next, so it glides from slot to slot instead of flying in again. A card that changes zone is a new element: give it the same `id` in both zones, and the [pose memory](05-poses-and-motion.md#pose-memory) does the rest.
- A card comes in from `enter` a `stagger` after the one before it, counted from the first card of the zone, so a card that joins later waits for its place in the list. Its own `from` wins, `from` set to `null` keeps the zone from adding an entrance, and an entrance only plays when a card mounts. For cards that arrive a few at a time among the ones already there, a line that grows, give each its own `from` with a `delay`: the `stagger` of the zone would make a card that comes alone wait for its place in the list.
- A zone owns no state and is a toolbox the game composes, not a declarative board: the game decides which cards are in it and in what order, one `Zone` per area, with the layout and the cards it computes from its view.

From `template/src/components/board/scene.tsx`, the cards an opponent holds, seen from behind, in the frame of their seat:

```tsx
<Zone
  frame={heldFrame(s)}
  layout={heldLayout(j.cardCount)}
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
- An opponent's hand is a count, so the scene draws that many backs in a fan held up, in a `Zone` framed on their seat, keyed by position, and a card they play starts from that fan (`heldFrame`, `heldLayout`, `backPose`; [Held hands](#held-hands)). The view of Courtisans carries `handCount`, and its board draws no opponent's hand.
- A hand hidden from its owner (Hanabi) is a view that gives the owner a card for each one they hold and no face, `hand: state.hands[id].map((card) => ({ id: card.id }))` for the viewer and the whole card for the others. The owner reads what the others told them: the state keeps what each card is known to be (`known: { suit?, number? }`) and the view gives it to the owner. The board draws the owner's cards in their frame face down and the others' face up (`face` of the layout helpers), and the clues as marks on the card, in its `children`. A hint is an action that names a player and what is told: the plate of the player pressed ([Seats](03-seats.md)), then a window to choose ([Bets and choices](12-bets-and-choices.md)). The test of the view holds that the owner's hand leaks no face ([Hidden information](../01-the-game/10-views.md#hidden-information)).
- Cards come in from `enter` (`DECK_POSE`, above the middle of the table), a `stagger` apart.
- The board keeps the id of the hovered card and lifts its slot with `shifted`; a click calls the handler that posts the play. The template does both on the viewer's turn only, and the engine decides whether the card may be played (`UNKNOWN_CARD`, `NOT_YOUR_TURN`) ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)).
- Courtisans' hand stays on the screen with the camera, in its own code (`cameraPose` in `games/courtisans/src/components/game3d/scene.tsx`): a click selects a card and a second click on a target plays it. The shared hand is at the same place, the bottom left of the screen, but lies on the table, in the table's light ([The hand in the corner](#the-hand-in-the-corner), [what is not built](../03-not-built-yet.md)).

From `template/src/components/board/layout.ts`, the fan of a hand of `n` cards with the hovered slot lifted:

```ts
/** The slots of the viewer's hand of `n` cards, a fan, in the frame of the hand (its middle at the origin). The card at index `raised` (-1: none) lifts toward them */
export function handLayout(n: number, raised: number): Pose[] {
  const R = LAYOUT_SETTINGS
  const slots = fan(n, { gap: R.handGap, y: R.handY, rise: 0.004, curve: 0.06, tilt: R.handTilt, roll: 0.05, scale: R.handScale })
  return slots.map((slot, i) => (i === raised ? shifted(slot, { y: R.hoverLift, z: -0.25 }) : slot))
}
```

## The hand in the corner

The viewer's own hand lies at the bottom left of the screen, whatever the size of the window, as in Courtisans: it is what the eye goes to first, so it keeps its place and its size on the screen while the table and the other seats take what is left. Shared: `CornerHand` in `packages/table/src/table/corner-hand.tsx`, with `cornerFrame` and `onTableAt` of `packages/table/src/table/screen.ts` (pure, tested in `screen.test.ts`).

The table is seen through a camera, so where the corner of the screen falls on the table depends on the window and on the view. `CornerHand` asks the camera on every frame, and renders again only when the place has moved a little (the window is resized, the view changes). It calls its `children` with the `CornerFrame`: where the middle of the hand is on the table (`x`, `z`), how wide and how deep a room it has (`width`, `depth`) and the `scale` the hand must be drawn at to fit (1 when the room is wide enough, less on a narrow window or a phone).

| Prop | Role |
| --- | --- |
| `most`, `depth` | The width and the depth the hand is drawn at: a hand of the most cards the game allows, so that the room does not change as cards are played |
| `height` | How high the top edge of a card stands, in world units (0 by default). A hand that stands up is nearer the camera than the table under it, so it shows larger and farther out: the edges of the room are read at this height, and the hand stays whole inside the picture, which the table's own points would not give it |
| `screen` | Where the hand lies on the screen, as points of the picture (-1 to 1 across and up): its `left` edge, the right end of its room (`middle`) and the height of its `row`. `CORNER_SCREEN` by default: just inside the left edge, in the lower part of the picture |
| `children` | `(frame) => ReactNode`: draws the hand in the frame it is given |

From `template/src/components/board/scene.tsx`, the hand of the viewer and their plate:

```tsx
<CornerHand most={HAND_ROOM.most} depth={HAND_ROOM.depth} height={HAND_ROOM.height}>
  {(corner) => {
    const frame = { x: corner.x, z: corner.z, yaw: 0 }
    return (
      <>
        <PlayerSeat id={meId} frame={frame} above={handBox(corner.scale)} line={pointsText(points)} />
        <Zone frame={frame} layout={scalePoses(handLayout(hand.length, raised), corner.scale)} size={CARD_SIZE} cards={handCards} />
      </>
    )
  }}
</CornerHand>
```

- The hand is a `Zone` in the frame of the corner (a yaw of zero: it faces the viewer), with its plate above it, as at every seat. The layout is drawn at full size (`most`) and `scalePoses(layout, corner.scale)` shrinks it to the room the window leaves it: it scales the places of the slots and the scale of the cards, and keeps their heights.
- The plate stands above the box of a hand of every size (`handBox`), so that it neither moves as the cards are played nor lies over a card that is dealt.
- `onTableAt(camera, x, y, height)` is the read that `CornerHand` makes: the place of the table that a point of the screen shows, or, with a `height`, the place under a thing that stands that high and shows there. A board's test projects the corners of its cards through the camera and checks that a hand of every size is whole inside the picture, in every window shape (`layout.test.ts` of the template).
- The corner belongs to the hand: a board keeps its other things off it. The template puts its clock at the other end of the viewer's row and its bid cards across the middle, and checks it in `layout.test.ts` for every window shape.
- `ScreenSpot({ at, children })` is the same read for anything else that belongs to a corner of the screen: `at` is a point of the picture, and `children` is called with the place of the table that is there.

## Held hands

The cards of the other players are held up in a fan, so that the viewer sees their backs and counts them: the number of cards an opponent holds is read off their hand, so it has to be seen as a hand. The fan stands at the seat, in the frame of the seat, opens toward the middle of the table and leans toward it, and a small round shadow lies on the table under it: the cards are in the air over the table, and the shadow says where the hand is even when it holds one card.

| Piece | What it is |
| --- | --- |
| The fan | `fan(n, { face: "down", tilt, y, roll, curve, scale, gap })` in a `Zone` given the frame of the seat. A negative `tilt` leans it toward the middle |
| The shadow | `HandShadow({ at, radius, opacity })` (`packages/table/src/zone/hand-shadow.tsx`): a flat disc on the table whose edge fades out, drawn under everything, taking no pointer. `at` is the frame of the seat, `radius` a little past half the width of the fullest hand |
| The plate | A `Seat` given the same `frame` and the box of the hand ([Where the plate stands](03-seats.md#where-the-plate-stands)) |

From `template/src/components/board/scene.tsx`, an opponent's hand:

```tsx
const frame = heldFrame(s) // the seat's spot, a little beyond the ring, turned as the seat is
<HandShadow at={frame} radius={HELD_SHADOW.radius} opacity={HELD_SHADOW.opacity} />
<PlayerSeat id={j.id} frame={frame} above={heldBox(s)} line={pointsText(j.points)} />
<Zone frame={frame} layout={heldLayout(j.cardCount)} size={CARD_SIZE} enter={DECK_POSE} cards={backs} />
```

- A hand is laid in the frame of its seat and never in the world's, so that it faces the middle at every seat and for every number of players: a layout with a roll of its own, drawn in the world's frame, stands crooked at a seat that is turned.
- A hand that stands up hides the table behind it as the camera sees it, so the box that its plate stands beyond is the one the camera sees (`frameBoxOfPoses` with the camera's `tilt`), and a board's test compares the plate with the cards as seen.
- The shadow is no part of the cards, so it has no state: it does not glow and it takes no press. A player is chosen by a `Hotspot` over the hand and its plate, whose glow is the cards' own ([Choosing a player](25-floor-buttons.md#choosing-a-player)).

## A trick

The cards played to a trick lie in the middle, each toward the seat that played it. A trick is no zone of its own: it is a `Zone` whose layout has one slot for each seat, laid out in the order the cards were played.

```tsx
// One slot toward each seat, a third of the way from the middle of the table
const ring = seats(players.length, { radiusX: 6, radiusZ: 4, me: myIndex })
const slotOf = (seat: number) => onTable(ring[seat].x * 0.34, ring[seat].z * 0.34, { yaw: ring[seat].yaw })

<Zone
  layout={view.trick.map((play) => slotOf(seatOf(play.playerId)))}
  size={CARD_SIZE}
  cards={view.trick.map((play) => ({ key: play.card, id: `card-${play.card}`, front: face(play.card), back }))}
/>
```

- The slots come in the order of the plays, not of the seats: the second card played is the second of the list, and lies in front of the seat of its player.
- Give a card the same `id` in the hand and in the trick: it glides from where the hand held it to its slot ([Poses and motion](05-poses-and-motion.md)).
- Who takes the trick, and when it ends, is the engine's ([Tricks](../01-the-game/03-turns.md#tricks)). A board that wants the players to read the last trick keeps it in the view until the next one starts, and moves its cards to the pile of the winner then.
