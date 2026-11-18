# Where cards are

A card is in exactly one place at a time: a pile, a hand, in front of a player, in the middle or set aside. The engine keeps each place as a list in the state, the view says what each viewer may see of it, and the board lays it out with a [Pile](06-decks-and-piles.md#pile) or a [Zone](#zone), both shared in `packages/table/src/zone/`. The kit's helpers that draw, deal and reshuffle the piles are in [Decks and piles](06-decks-and-piles.md).

## The places

Read from the engines of Flip 7, Exploding Kittens and Courtisans and from the template's demo. Not every game has every place, and only the template and Courtisans have a board: for the other two, the last column is what the shared tools offer.

| Place | In the state | In the view | On the table |
| --- | --- | --- | --- |
| Draw pile | `deck`, top first (Flip 7, Exploding Kittens, Courtisans) | Its size; Flip 7 adds how many cards of each face it holds, Exploding Kittens the top cards the viewer knows (`me.top`) | A `Pile` given the count; Courtisans draws its own at `DRAW_PILE` |
| Discard | `discard`, top first (Flip 7, Exploding Kittens) | Every card, top first | A `Pile` whose `top` is the card on top, or a `Zone` over `pile` when the cards stay readable |
| Hand | `hands` for each seat (Exploding Kittens), `hand` on the player (Courtisans, the template) | The whole list to its owner, a count to the others | A `Zone` over a `screenHandLayout` at the bottom left of the screen for the viewer ([The hand on the screen](#the-hand-on-the-screen)), a `HeldHand` of backs standing at each seat for the others ([Held hands](#held-hands)) |
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
| The viewer's hand | None here; on a board, the frame of the camera ([The hand on the screen](#the-hand-on-the-screen)) | A `fan` here; on a board `screenHandLayout`, made to fit the room |
| A player's cards | The player's seat, from `seats` | A fan of backs that stands, with its shadow ([Held hands](#held-hands)), a `row`, a `grid` |
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
- An opponent's hand is a count, so the scene draws a `HeldHand` of that many backs in the frame of their seat, and a card they play starts from the left end of that fan (`heldFrom`; [Held hands](#held-hands)). The view of Courtisans carries `handCount`, and its board draws no opponent's hand.
- A hand hidden from its owner (Hanabi) is a view that gives the owner a card for each one they hold and no face, `hand: state.hands[id].map((card) => ({ id: card.id }))` for the viewer and the whole card for the others. The owner reads what the others told them: the state keeps what each card is known to be (`known: { suit?, number? }`) and the view gives it to the owner. The board draws the owner's cards in their frame face down and the others' face up (`face` of the layout helpers), and the clues as marks on the card, in its `children`. A hint is an action that names a player and what is told: the plate of the player pressed ([Seats](03-seats.md)), then a window to choose ([Bets and choices](12-bets-and-choices.md)). The test of the view holds that the owner's hand leaks no face ([Hidden information](../01-the-game/10-views.md#hidden-information)).
- Cards come in from `enter` (`DECK_POSE`, above the middle of the table), a `stagger` apart.
- The game says `interactive` for the cards of the viewer's hand on their turn and the table lifts the one under the pointer; the board keeps only the index of that card (`onHover`), to bring it forward. A click calls the handler that posts the play, and the engine decides whether the card may be played (`UNKNOWN_CARD`, `NOT_YOUR_TURN`) ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)).
- Courtisans' hand stays on the screen with the camera, in its own code (`cameraPose` in `games/courtisans/src/components/game3d/scene.tsx`): a click selects a card and a second click on a target plays it. The shared hand is the same: the bottom left of the screen, on the frame of the camera, laid with the numbers of Courtisans' own ([The hand on the screen](#the-hand-on-the-screen)).

A hand that lies along the near edge of the table, as the playground's does and a board that lets a card be dragged out of it, is a fan like any layout, with the card at index `raised` (-1: none) lifted toward the player:

```ts
const slots = fan(n, { gap: 1.05, y: 1.1, rise: 0.004, curve: 0.06, tilt: 0.62, roll: 0.05, scale: 1.2 })
const hand = slots.map((slot, i) => (i === raised ? shifted(slot, { y: 0.45, z: -0.25 }) : slot))
```

## The hand on the screen

The viewer's own hand is held at the bottom left of the screen, whatever the window, as Courtisans holds its own: big cards, a third of the height of the picture, the first one flush with the left edge, the bottom of every card cut off by the bottom edge, the whole fan leaning a little. It is where the eye goes first, so it keeps its place and its size on the screen and the table takes what is left. Shared: `ScreenHand` in `packages/table/src/table/screen-hand.tsx`, with the pure `screenHandLayout`, `screenHandFit` and `screenViewOf` and the settings `SCREEN_HAND_SETTINGS` in `screen-hand-layout.ts` (tested in `screen-hand-layout.test.ts`).

`ScreenHand` is a frame that follows the camera: it is moved to the camera's place on every frame, once the rig has put the camera there, so what is laid in it keeps its place on the picture whatever the window, the entrance of the camera and the view. Its `children` is a function given the `ScreenHandView`: where the edges of the picture are in the frame (`halfWidth` and `halfHeight`, at the `distance` the hand stands in front of the camera) and `local(pose)`, which says a place of the table in the frame, for a card that comes in from the deck on the table (`enter` of a `Zone`). The cards are a `Zone` like any other, with no frame of its own: its layout is in the frame of the camera. So they glide, fly and glow as the cards of the table do, and a card that goes to the table flies from where it was on the screen (the pose memory writes the world place it was at). The frame is left out of the share photo.

| Prop | Role |
| --- | --- |
| `settings` | `ScreenHandSettings`, default `SCREEN_HAND_SETTINGS`: Courtisans' numbers (below). A game that keeps the room of the hand short of something in the middle of the front of the table gives its own, `{ ...SCREEN_HAND_SETTINGS, room: 0.42 }` |
| `children` | `(view) => ReactNode`: lays the hand in the frame, with `screenHandLayout(count, view, cardSize, settings, raised)` for the slots |

| Setting | Role |
| --- | --- |
| `size` | A card's height as a share of the picture's half height: 0.66 is a third of the screen. How big it looks does not depend on the distance |
| `step` | The distance between two cards as a share of a card's width; under 1 they overlap, the later over the earlier |
| `x`, `y` | Where the middle of the hand lies: `x` as a share of the picture's half width from the left edge, `y` the height of a card's middle above the bottom edge as a share of its height (under 0.5 the bottom of the cards is cut) |
| `rotation` | How the block of cards is turned (pitch, yaw, roll, in radians): it leans a little toward the middle of the table |
| `fan`, `curve` | How each card turns about its own axis and how far it sinks, per card from the middle: the cards open as a fan and the ends hang lower |
| `raise` | How far the card under the pointer advances toward the camera, as a share of its height, so it lies over its neighbours |
| `room` | The most of the picture's width the hand takes: a hand that is wider packs its cards closer (down to `packed` of a card's width) and then shrinks them |
| `distance` | How far in front of the camera the hand stands, in world units: only the units the poses are in, and what keeps the hand nearer than anything on the table |

From `template/src/components/board/scene.tsx`, the hand of the viewer; `raised` is the index of the card under the pointer, from the cards' `onHover`:

```tsx
<ScreenHand settings={HAND_SETTINGS}>
  {(screen) => <Zone layout={screenHandLayout(hand.length, screen, CARD_SIZE, HAND_SETTINGS, raised)} size={CARD_SIZE} enter={screen.local(DECK_POSE)} cards={handCards} />}
</ScreenHand>
```

- The first card is flush with the left edge, a hair past it, and the hand grows to the right, so the cards already in it stay where they are as others come.
- The cards are in the states of [Cards](04-cards.md#states): `interactive` on the viewer's turn, so the table draws their bloom, lifts the one under the pointer and gives it its shine; the game gives each card `onHover` only to say which one to bring forward.
- A hand is pressed, not dragged: a drag goes over the table and the hand is not on it. A game that wants a drag from the hand keeps it along the near edge of the table.
- The viewer's name does not follow the hand: it stays at their seat, in the middle of the front of the table (the `spot` and `viewer` of a `Seat`), as the name of a player stands at their own place in Courtisans.
- The corner belongs to the hand: a board keeps its other things out of it. The template keeps the room of the hand (`room`) short of the viewer's name, puts its clock at the other end of the viewer's row and its bid cards across the middle, and tests the shapes as the viewer sees them, on the screen, for every window shape (`layout.test.ts`).
- The hand is tested as the camera sees it: every corner of every card of a hand of every size is projected through the camera, and must be inside the picture on the left and cut by the bottom edge, within `room`, from a portrait window to an ultra-wide one.

## Held hands

The cards of the other players are held up as a hand, so that the viewer sees their backs and counts them: the number of cards an opponent holds is read off their hand, so it has to be seen as a hand. The fan stands at the seat, in the frame of the seat, backs to the viewer, and a small round shadow lies on the table under it. `HeldHand` draws it. Shared: `packages/table/src/zone/held-hand.tsx`, with the rules of the cards' names in `held-hand-keys.ts` (tested in `held-hand-keys.test.ts`) and the shadow in `hand-shadow.tsx`.

| Prop of `HeldHand` | Role |
| --- | --- |
| `count` | How many cards the player holds: all that the view knows of a hand nobody but its owner sees |
| `frame` | The frame of the seat (`seats`, turned toward the middle of the table) |
| `layout` | The slots of a hand of `n` cards, in the frame: a `fan` of backs (`face: "down"`) that stands |
| `size`, `back` | The size of a card, and the picture on the back of every card |
| `enter` | Where the cards come in from, on the table (a `Zone`'s `enter`) |
| `shadow` | `{ radius(n), opacity }`: how far the small round shadow reaches for a hand of `n` cards, and how dark it is. Small: a pool under the fan that grows with the cards |
| `state` | The state of every card (`Card`'s `state`): `interactive` while the player can be chosen, raised to `hover` and `pressed` by the game from what a `Hotspot` over the hand tells it |

- **A card played leaves from the left end of the fan, as the viewer sees it, and a card drawn comes in at its right end.** The view says how many cards there are and no more, so the cards are named by a rule (`heldKeysFor`): the cards that stay keep their names and glide to their new slots, the one that leaves is the one at the left end, and each new one is a new name at the right end. The left end is the first slot for a seat that faces the viewer's way and the last for the seat across, where the fan runs the other way on the picture (`leftEndIsFirst`); a seat turned a quarter counts its first card, on the seat's own left.
- `heldLeftPose(frame, layout, count)` is where a card that is played from a hand of `count` flies from, on the table: the left end of the hand, still the size it was. The template gives it to the card an opponent has played and to the bid card that comes from a hand (`heldFrom`).
- The fan stands up, so that its backs show: nearly straight for a seat the viewer sees from the front (across the table), and leaning toward the middle for a seat at the side, which the viewer sees edge on (the layout is given the yaw of the seat and mixes the two leans by it). A hand stands on the table: the middle of a card is at half its height, so that its foot is on the surface.
- A hand is laid in the frame of its seat and never in the world's, so that it faces the middle at every seat and for every number of players: a layout with a roll of its own, drawn in the world's frame, stands crooked at a seat that is turned.
- A hand that stands up hides the table behind it as the camera sees it, so the box that its plate stands beyond is the one the camera sees (`frameBoxOfPoses` with the camera's `tilt`), and a board's test compares the plate with the cards as seen.
- The shadow is no part of the cards, so it has no state: it does not glow and it takes no press. A player is chosen by a `Hotspot` over the hand and its plate, whose glow is the cards' own ([Choosing a player](25-floor-buttons.md#choosing-a-player)).

From `template/src/components/board/scene.tsx`, an opponent's hand:

```tsx
const frame = heldFrame(s) // the seat's spot, a little beyond the ring, turned as the seat is
<PlayerSeat id={j.id} frame={frame} above={heldBox(s)} line={pointsText(j.points)} />
<HeldHand count={j.cardCount} frame={frame} layout={(n) => heldLayout(n, s.yaw)} size={CARD_SIZE} back={back} enter={DECK_POSE} shadow={HELD_SHADOW} />
```


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
