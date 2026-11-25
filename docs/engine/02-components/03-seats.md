# Seats

A seat is a place at the table where a player sits, and it faces the middle of the table. `seats` gives the places, each with the way it faces, and `Seat` draws the player who sits at one: the avatar with the turn crown, the name beside it and the score and a status under the name, on a plate that stands on the side of the player's cards that faces the middle, turned as the seat is. Nothing lies under the plate, and it never reacts to the pointer: the crown says whose turn it is ([Whose turn it is](#whose-turn-it-is)), and a player is chosen by pressing their cards ([Choosing a player](25-floor-buttons.md#choosing-a-player)). What else stands at a seat, such as the cards the player holds, is the game's, laid in the frame of the seat. Shared: `seats` in `packages/table/src/layout.ts`, `Seat` and its pieces in `packages/table/src/seat/`.

## The ring

`seats(count, options)` returns one `Spot` per player, on an ellipse around the table, indexed like the players. `SeatsOptions`:

| Option | Role |
| --- | --- |
| `radiusX`, `radiusZ` | Half the width and half the depth of the ring: a number, or a pair for the fewest players and for the most (`players`), which the ring goes between in steps as the table fills ([A table that fills](#a-table-that-fills)) |
| `me` | The index of the viewer's seat. Without it, or when it is not a seat (the -1 of an `indexOf`, an index past the players), nobody is the viewer |
| `margin` | The angle kept free at each end of the far half, so the outer seats do not close in on the viewer's sides (0.35 radians by default). `first` replaces it for the numbers of players it gives |
| `first` | Where the player after the viewer sits, in degrees, for each number of players ([A table that fills](#a-table-that-fills)) |
| `players` | The fewest and the most players that the pairs and `first` are given for (2 and 8 by default): a table of fewer or more takes the nearest end |
| `viewerZ` | How far toward the viewer their own seat lies (the depth of the ring by default): less when the viewer's cards are bigger than the others' and want to stand nearer the middle |
| `widen` | How much wider the ring of a spectator of a full table is (1.25 by default) |

- The viewer sits in front, on the +z side, with a yaw of zero: their frame is the world's, and what lies there reads upright.
- The others share the far half of the ring in turn order, starting with the player after the viewer, who sits at the viewer's left: the turn passes to the left. A single opponent sits straight across.
- Without a viewer, as at a spectator's view, the players take the chairs of a table of one more player, the viewer's chair in front staying empty: nobody sits where the viewer would, and the front keeps the room for the piles and the buttons. A spectator of a full table gets a ring `widen` times wider, since nine chairs on the ring of eight are closer together than a plate allows.
- Every seat faces the middle of the table: the top of its frame, its least z, points at the middle, so that whatever a game lays in the frame of a seat is laid as the player who sits there sees it. The cards of a seat across from the viewer lie upside down for the viewer and upright for that player, and those of a seat at the side lie on their side. The viewer's seat has the yaw of zero, and the others the yaw that turns the top of their frame toward the middle.
- The ring is symmetric: the opponents mirror each other.

The ring for two to eight players, with the viewer's seat in front or with none; the arrow is the top of the frame, the way a layout drawn in the seat's frame points: toward the middle of the table, at every seat.

```specimen
scene-seats
```

From `template/src/components/board/layout.ts`, the seats of a table, by player id (`SeatSpot` is the template's name for `Required<Spot>`):

```ts
export function seats(ids: string[], meId: string | null): Map<string, SeatSpot> {
  const R = LAYOUT_SETTINGS
  const viewer = ids.indexOf(meId ?? "")
  const ring = ringOf(ids.length, { radiusX: R.radiusX, radiusZ: R.radiusZ, me: viewer < 0 ? null : viewer })
  return new Map(ids.map((id, i): [string, SeatSpot] => [id, ring[i]]))
}
```

### A table that fills

A ring that is right for two players is too small for eight, and one that is right for eight leaves two players far apart, so a game gives its ring at both ends and the table goes between them (`byPlayers(count, [atTheFewest, atTheMost], players)`: a straight line, held at the two ends). Where the first opponent sits is a table of its own, by number of players: the viewer's own cards take room in front, and the more players there are the less each of them needs. From Skyjo's `layout.ts`:

```ts
const RING = {
  radiusX: [5.12, 5.56],
  radiusZ: [6.24, 7.33],
  viewerZ: 5.08,
  first: { 2: 180, 3: 152, 4: 90, 5: 88, 6: 67, 7: 62, 8: 60 },
}
const ring = seats(ids.length, { ...RING, me: viewer < 0 ? null : viewer })
```

The angles are in degrees, clockwise from the viewer's seat as the camera sees the table: 0 in front of the viewer, 90 on their left, 180 straight across. At six players the first opponent sits at 67, the last at 293 and the three between at 124, 180 and 236: the first and the last keep 67 degrees off the viewer and the others are spread evenly between them. `seatAt(angle, radiusX, radiusZ)` is the seat for one angle. What else grows with the table, the scale of the opponents' cards for one, is given the same way, `byPlayers(count, [0.62, 0.46])`, and is not a setting of the kit.

## The plate

`Seat` draws one player's plate on the side of their cards that faces the middle, in the frame of their seat. Three seats of a table for five players: the viewer's, whose name stands in the middle of the front of the table and whose hand is held big at the bottom left of the screen, and the two opponents at the ends of the far half, each holding a fan of cards that stands, with its small round shadow under it. Play with whose turn it is (the crown), the players expected together, a seat that is away, the score and a status, and choose a player by pressing their cards:

```specimen
scene-seat
```

The props are `SeatProps`:

| Prop | Role |
| --- | --- |
| `nickname`, `color` | The name, as typed (not in capitals), in Geist at weight 600, in the seat colour (cut to `NAME_LIMIT` characters, see [Long names](#long-names)), and the colour that the avatar is made of until a picture exists |
| `imageUrl` | The player's picture; when it is null the avatar is generated |
| `theme` | The game's `SeatTheme`, `UI_THEME.seat`, read with `useSeatTheme()` |
| `frame` | The frame of the seat, a `Spot`: where it is on the table and the way it faces (the `yaw` of `seats`, which turns the top of the frame toward the middle). The plate is drawn in it and turns with it, as the cards the game lays in the same frame do. The world's own frame when not given |
| `above` | The box of all of the player's cards in that frame, a `TableBox` (`frameBoxOfPoses`): the plate stands on its side that faces the middle, centred on it, at the viewer's seat and at every other, whichever way the seat is turned ([Where the plate stands](#where-the-plate-stands)) |
| `spot`, `viewer` | Where the plate stands when it has no `above`: the seat's spot on the ring, from which it stands out. By default the middle of the table, for a board that draws the seat in a group of its own |
| `active` | The player of the turn: the crown shows on the avatar |
| `away` | The player is away: the plate fades |
| `line` | The info line under the name, already written in the visitor's language: the score ("132 pts") |
| `status` | A word on the same info line, after the score ("132 pts · Stayed"), side by side, plain text, written the same way |
| `trailing` | What stands to the right of the plate, in a frame whose origin is the right edge of its lettering (the wider of the two lines), level with the middle of the avatar (`0.2` is just right of the longer line): tokens, an icon. For a game whose players hold things; a player who holds none has nothing drawn |
| `crownIcon` | The crown's icon, the skin's `hostIcon`; without one, a drawn crown |
| `room` | The widest the name, and the info line, may be, in world units: a longer one shrinks to it with its proportions, never cut. `SEAT_SETTINGS.nameRoom` when not given, which only a name of wide capitals goes beyond ([Long names](#long-names)) |
| `settings` | The settings the plate follows, `SEAT_SETTINGS` unless the board makes its plates smaller at a bigger table (`scaledSeat`, [Where the plate stands](#where-the-plate-stands)): the layout that places the plates is given the same |
| `font` | The CSS font of the lettering; `PLATE_FONT` (Geist) by default. `PLATE_FONT` and `PLATE_WEIGHT` are exported: a game that uploaded its own display font to its Sanity project gives it from `useLettering()` (`lettering.display`, which is `"Site Title", ${PLATE_FONT}`, and `lettering.weight`: Flip 7's plates) so that the plates, and the buttons and counts of the table, are drawn in it, and the kit's own is what the lettering reads in until it has loaded. `lettering.accent` is the accent font the game uploaded (`"Site Accent"`), else the display font, for what a board writes large in the game's own flourish (Love Letter's card names) |
| `nameStyle`, `lineStyle` | What is changed in the `TextStyle` of the name and of the info line |
| `children` | What else stands at the seat, in the frame of the world: the cards held there, as a `Zone` given the same `frame` |

- `PlayerSeat` is the `Seat` of a player of the table. Give it their `id` and it takes the nickname, the colour, the account picture, the seat theme, the crown icon and the font of the seat label from the platform (`useGame()`, `useSeatTheme()` and `useSkin()`), as `PlayerSeatLabel` does for the DOM ([Seat label](../../design/04-in-game/04-seat-label.md)), and what the table says of the player. The canvas of `Table` hands the contexts of the page on to the scene, so it works inside it.
- A player is therefore named one way in the DOM and on the table: the same avatar, the same seat colour and the same account picture, with no copy to keep in step. `Seat` takes the same values as props, for a scene outside a game such as the example above.
- The game does not say who has the turn: `seatStateOf` reads it from the table (a `SeatTable`: the status, who is waited for, who is present and the winners), from what every game already has in `PublicGame` (below), and gives a `SeatState`. `PlayerSeat` hands the plate `active` and `away`; a prop of the same name wins, for a game whose rules say otherwise. `waiting` and `winner` mark nothing on a plate: the ticker says who is waited for, and the end screen says who won.
- The score is the game's. The `line` is a text of the visitor's language, which the template writes with `pointsShort` of the skin and never with a literal.

| State | When | Read from |
| --- | --- | --- |
| `active` | The game waits for this player alone | `waitingFor` is this player's id only |
| `waiting` | The game waits for several players at once, this one among them (the ticker says it) | `waitingFor` lists more than one id |
| `away` | The game runs and the table has not seen the player lately | `status` is `playing` and `present` does not list the id |
| `winner` | The game is over and the player won (the end screen says it) | `status` is `over` and `results.winners` lists the id |

- A step several players answer together has no player of the turn: nobody has the crown, and the ticker says who the game waits for ([Simultaneous steps](../01-the-game/03-turns.md#simultaneous-steps)).
- A player who is away keeps the turn: the plate fades and the crown stays, so the others see that the game waits for someone who left ([Absent players](../01-the-game/03-turns.md#absent-players)).
- Nobody fades once the game is over, whoever has left by then.
- `status` is the game's to say, from its view: the `status` of a seat in Flip 7. The contract has no word for it ([Players who are out](../01-the-game/02-players.md#players-who-are-out)). A player who is out is shown on their cards, not on the plate: the name is never struck out, and `Card` takes `out` to grey its picture ([Cards](04-cards.md#props)).

From `template/src/components/board/scene.tsx`, the line of an opponent of the template: `seatFrame` is the frame of the seat (the seat's spot, a little beyond the ring and turned as it is), `seatBox` the box of the player's play area and hand in it, and the held cards a `HeldHand` in the same frame. It says nothing of the turn: the table does.

```tsx
<PlayerSeat key={j.id} id={j.id} frame={seatFrame(s)} above={seatBox(s)} line={pointsText(j.points)} />
<HeldHand count={j.cardCount} frame={seatFrame(s)} layout={(n) => heldLayout(n, s)} size={CARD_SIZE} back={back} enter={DECK_POSE} shadow={HELD_SHADOW} />
```

### The layout of a plate

A plate is one block. A game fills the slots and does not place anything:

```
 ┌────────┐
 │ avatar │  name
 │        │  score · status      trailing
 └────────┘
```

- **The avatar is always to the left of the lettering**, as the plate is read in the frame of its seat: the plate reads left to right for the player who sits there, and it turns with the seat as a whole, avatar and text together, so the avatar never goes above, below or to the right of the name for them. For the viewer, the plate of the seat across lies upside down, as its player's cards do. It stands level with the middle of the two lines of lettering (the middle of the plate, `Plate.z`), and with the name when the name stands alone, so that it is aligned with what is beside it.
- **The name** is as typed, in Geist (`PLATE_FONT`, the platform's variable font from `@fontsource-variable/geist`, so the weight asked for is the weight drawn) at the platform's weight 600 (`PLATE_WEIGHT`), in the seat colour, at the top of the column of lettering. With no info line under it, it stands level with the avatar.
- **The info line** stands under the name and starts where the name starts, left-aligned with it: the `line` (the score, "132 pts"), then the `status` (Stayed, Bust, Frozen) as plain text after a "·", the two side by side. It is one `TableText`.
- **The block is centred.** From the avatar's left edge to the right edge of the wider of the two lines it is one block, centred on the plate, over the cards: `plateRow(plate, { name, info }, settings)` works out where the avatar and the column of lettering stand from the widths of the two lines, which `useTextWidth` measures the way `TableText` paints them. Both lines centre their capital letters on their line (`capsCentred`), so the avatar is level with the lettering whichever font a game's plates are drawn in.
- **`trailing`** stands to the right of the plate for whatever a game's players hold: Love Letter's affection tokens, an icon. Give it three.js elements in the frame of the right edge of the lettering, level with the middle of the avatar. Love Letter's board gives it a stack of discs (`Tokens` of its `scene.tsx`, which draws nothing for a player who has none: the discs are the count), and its layout leaves them room to the right of the plate (`PLATE_TRAILING`, which the box of the plate does not count: a plate is centred on the avatar and the lettering).
- **The plate never reacts to the pointer, and nothing lies under it.** There is no `onSelect`, no aura, no rim, no tint: a plate is read, not pressed. To choose a player, the game puts an invisible `Hotspot` over their cards and their plate, and lights the cards ([Choosing a player](25-floor-buttons.md#choosing-a-player)).

## Where the plate stands

Everything of a player stands on one line, the axis of their seat: the line from the middle of the table through the seat, which is the z axis of the frame of the seat, its least z toward the middle. In this order from the middle of the table outward: the plate (the name, and the info line just under it, with the avatar beside them), the play area (a grid, a row of cards, a bid) and the hand. All of it is drawn in the frame of the seat, turned as the name is, at every seat, the viewer's included. A player sees their own name above their cards; the line of a seat across from the viewer lies as that player sees it, which is upside down for the viewer; a side seat is turned a quarter. A game gives the `Seat` the frame of the seat and the box of what stands under the plate, and places nothing by hand.

- `frame` is the seat's frame, the `Spot` that `seats` gives (or a place near it: the template stands the line of a player a little beyond the ring). The cards of the seat, the play area and the hand, are laid in it with a `Zone` given the same `frame`, so the plate and the cards turn together. Nothing is turned on its own: a hand that faces some other way than its player's name is a mistake of the board.
- `above` is the box of everything of the player that lies on the table, in that frame: their hand and their play area, in one `TableBox`. It is made from the layout of the cards with `frameBoxOfPoses(poses, size, frame, { tilt })` (the poses are in the frame, as a `Zone` takes them, and the box is in it too), from a rectangle with `boxOfRect`, and joined with `joinBoxes` ([Boxes](08-layout-helpers.md#boxes)). The play area stands on the middle's side of the hand: `boxAbove(hand, size, gap)` is its box. `onAxis(box)` brings a box onto the axis, as far to the left of it as to the right, so that the plate, which is centred on the box, is centred on the line. `plateAbove(box)` is the plate it gives: on the box's side of the least z, which is toward the middle of the table, the foot of the plate (the bottom of the info line) `plateGap` beyond its edge.
- A hand that leans toward its player, or stands up off the table, hides part of the table behind it as the camera sees it: its box must be what the camera sees, which reaches farther from the camera than where the cards lie. `frameBoxOfPoses` takes the camera's tilt (as `CameraSettings.tilt`) and gives that box, moved as the frame turns: the apparent shift of a card that stands `y` high is `y` times the tangent of the tilt, along the world's z, which is not along the frame's z for a seat that is turned. Cards that lie flat need no tilt.
- A plate that moves as cards are dealt and played looks like a glitch. A board boxes the room of the biggest hand (`joinBoxes` of the boxes of the hands of every size, or of a nominal one), so the plate stands where it stood and clears every card that can be there. The template does it (`handBox`, `playBox` and `seatBox`).
- The viewer's hand is held on the screen and takes no room on the table: its box is a nominal one, of no depth, at the foot of the line, where the seat is (`VIEWER_HAND` of the template), and the play area and the plate stand above it as at any seat. The frame of the line is a little farther out than the opponents' for this: the line is the room of the name and the play area above the foot of the screen.
- The middle of the plate, where the avatar's centre lies, is the point the lettering is measured from: the info line stands `lineDrop` toward the cards from it and the name `nameLift` toward the middle of the table, so the two lines stand side by side with the avatar, which is a little shorter than they are together. The crown stands on the avatar's upper-right corner, in the avatar's own frame.
- A `Seat` given no `above` stands out of the ring from its `spot` (`plateOf`): an opponent's at `reachX` and `reachZ` times the spot, the viewer's level with it and a little in front (`viewer`). It is the way of the boards that have not moved to the line of a seat yet, which draw the seat in a group of their own and place it by the middle of the group.
- A player who is away keeps `awayOpacity` of the plate: the name, the avatar and the info line fade, and the crown does not.
- `plateBoxOf(plate)` is what a plate covers of the table, in the frame (`plateWidth`, the width of the avatar and `PLATE_LETTERS` letters, by the height from the top of the name or the avatar to the foot of the info line or the avatar), and `cornersOfBox(box, frame)` puts the corners of a box of a frame on the table: a board checks with a pure test, on the shapes and not on a screenshot, that no plate lies over a card, another plate, the piles or the clock, that the line of a seat is in its order and on its axis, and that all of it is in the picture, for every table of its players, seated and as a spectator (`template/src/components/board/layout.test.ts` is the model). The cards are compared as the camera sees them, standing hands included.

| Setting | Role |
| --- | --- |
| `plateGap` | The clear space between the edge of a player's cards that faces the middle and the foot of their plate. A board whose cards want more air around the name (Skyjo's, which lie in a block of twelve) gives its `Seat` and its layout settings of its own, the kit's with a larger gap |
| `reachX`, `reachZ` | How far out of the ring an opponent's plate stands when it has no `above`, as factors of the spot |
| `viewerReachX`, `viewerReachZ` | The same for the viewer's plate |
| `nameHeight`, `nameLift` | The size of the name's letters, and how far toward the middle of the table it stands from the middle of the plate, the middle of the avatar |
| `nameRoom` | The widest a name may be: a longer one shrinks to this width, with its proportions, instead of reaching the plate of the next seat. Twelve letters of the platform's font are about six times the height of the lettering wide, so only a name of wide capitals is touched |
| `lineHeight`, `lineDrop` | The same for the info line, which drops toward the cards from the middle of the plate |
| `avatarSize`, `avatarGap` | The avatar's diameter and its gap to the lettering beside it |
| `crownSize`, `crownRight`, `crownBack` | The crown's size, and how far its foot stands from the avatar's centre: to the right and toward the middle of the table |
| `awayOpacity` | How opaque the plate of a player who is away stays |

`SEAT_SETTINGS` is a plain object (its type is `SeatSettings`) that the Seat folder of the table's debug panel edits (`SEAT_FIELDS` lists its knobs, and a `Seat` follows them as they move). With the panel's View folder on, every `Seat` also marks the middle of its plate, the box the plate covers and the box of the cards it stands beyond, in its frame. `plateAbove`, `plateOf`, `plateBoxOf`, `plateRow` and `seatStateOf` are the same numbers and rules as pure functions: `placement.test.ts` checks them (the plate is on the middle's side of the cards, clear of them, the places a plate placed from its spot has, and the block of the avatar and the lettering centred on the plate for every width), and `state.test.ts` checks the states.

A board whose plates should be smaller at a bigger table gives `Seat` the `settings` of `scaledSeat(factor)`, a copy of `SEAT_SETTINGS` with every size and every gap multiplied (the reach factors and the opacity are not), and gives its layout the same (`plateAbove`, `plateBoxOf` and `plateWidth` take them), so that the plate that is drawn and the room that is left for it agree. The kit has no rule for the factor of a table of eight: it is the board's.

## Whose turn it is

The crown on the avatar says which player has the turn, and it is all the table says of it. The words belong to the platform's screen around the table: the ticker at the top left says "It's your turn", "Ann's turn" or "Waiting for Ann, Bob" (`yourTurn`, `turnOf`, `waitingFor` of `UI_TEXTS`, from what the table says: `waitingFor` and `meId` of `PublicGame`), and an announcement plays when the turn comes to the viewer. Under that line the ticker says what to do while the viewer has something to do (`prompt` of `Ticker`: one sentence in the game's words, in the visitor's language, `<Ticker prompt={…} />`), and nothing while they have not. A board writes no sentence on the table and keeps no turn marker of its own: there is no line across the table, and no light under a seat. A player who is away fades, and a player is chosen by pressing their cards, which glow ([Choosing a player](25-floor-buttons.md#choosing-a-player)). More on the turn in [Turns](../01-the-game/03-turns.md).

## What stands on a plate

| Piece | Component | Page |
| --- | --- | --- |
| The avatar, at the left | `SeatAvatarMesh` | [The avatar](#the-avatar) |
| The nickname, beside it | `TableText` | [Text on the table](09-score.md#text-on-the-table) |
| The turn marker | `TurnCrown` | [Crown and the turn marker](../01-the-game/03-turns.md#crown-and-the-turn-marker) |
| The info line under it (score, then status) | `TableText` | [Text on the table](09-score.md#text-on-the-table) |
| What stands to the right of the lettering | `trailing`, the game's | [The layout of a plate](#the-layout-of-a-plate) |
| The cards held there | A `Zone` framed on the seat, a child of the `Seat` | [Zone](07-zones.md#zone) |

- Each piece is exported on its own too.
- The viewer's cards are their hand, held at the bottom left of the screen ([The hand on the screen](07-zones.md#the-hand-on-the-screen)), and their name stays at their seat, in the middle of the front of the table; the cards of the others are a `HeldHand`, a fan that stands with a small round shadow under it ([Held hands](07-zones.md#held-hands)).

## Long names

A nickname is typed by its player, so it can be any length, and a plate, a list of players and a heading must not grow with it. Every place that draws a name on the board or in the HUD draws `shortName(name)` of `@pbgo/core/lib/short-name` (`packages/core/lib/short-name.ts`), once, for every game: the `Seat` plate, the `SeatLabel` (the strip of the players still to play, the game over, the seat labels of the docs), the list of the players of the HUD and the name that heads a turn in the ticker.

| Export | What it does |
| --- | --- |
| `NAME_LIMIT` | The one constant: 12, the most characters of a name that are drawn, the ellipsis included |
| `shortName(name, limit = NAME_LIMIT)` | The name as drawn: unchanged when it fits, else its first `limit - 1` characters, the spaces before the cut dropped, then "…" |

- Characters are counted as the eye counts them, not as JavaScript does: an emoji, a letter with its accent written as a combining mark and a family joined by zero-width joiners are each one character, so a name is never cut in the middle of one. `Intl.Segmenter` does it; a runtime without it counts code points.
- The full name stays the accessible one: the DOM that draws a short name carries the whole of it in `title`. The canvas of a `Seat` has no DOM, so the plate's name reads as drawn there; the full name is in the list of the players beside the board.
- Only what is drawn is cut. The state, the log, the chat and the profile keep the name the player typed. To change the limit, change `NAME_LIMIT`: `short-name.test.ts` follows it.
- A name of twelve wide capitals (a `W` is nearly as wide as it is tall) is wider than twelve letters of an ordinary name, and a plate cannot grow with it: past `SEAT_SETTINGS.nameRoom` (or the `room` of a `Seat`) the name is drawn smaller (`maxWidth` of `TableText`, which any lettering of the table can take), and the info line is held to the same room. The plate is placed from the widths that are drawn, so the avatar and what stands after the lettering follow its edges. A name that fits is drawn as it was.

## The avatar

The seat avatar is the picture that stands for a player next to their nickname. The same picture is drawn in the DOM by `SeatLabel` and on the table by `SeatAvatarMesh` ([Seat label](../../design/04-in-game/04-seat-label.md)). Core specifies the avatar (`seatAvatar`) and paints it on a 2D canvas (`useSeatAvatarCanvas`), and stays free of three.js; the package wraps that canvas in a texture and lays it on a plane. Shared: `packages/table/src/seat/seat-avatar-mesh.tsx`.

| Prop | Role |
| --- | --- |
| `nickname`, `color` | What the avatar is made of until a picture exists: the initial on the seat colour |
| `imageUrl` | The player's picture; when it is null the avatar is generated |
| `theme` | The game's `SeatTheme`, `UI_THEME.seat`, read with `useSeatTheme()` |
| `position` | Where it lies, in the frame it is placed in |
| `size` | The diameter of the avatar, in world units |
| `opacity` | How opaque it is, 0 to 1: a `Seat` fades the avatar of a player who is away or out |
| `layer` | The render order, to draw it over or under other flat things |

- It draws nothing until the canvas is ready (a font or a picture may still be loading), then lies flat on the table.
- The plane is larger than the avatar by `AVATAR_FILL` of core, the share of the canvas the avatar fills, so the ring and the shadow fit. `size` is the avatar's own diameter.
- The texture is disposed when it changes or when the component goes, and it takes no pointer events ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)).
- A `Seat` places it at the left of the lettering, level with the middle of the plate ([The layout of a plate](#the-layout-of-a-plate)).
