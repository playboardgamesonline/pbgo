# Seats

A seat is a place at the table where a player sits. `seats` gives the places, and `Seat` draws the player who sits at one: the name with the avatar and the turn crown, the score and a status under it, and an aura under them. The plate also says what the table knows of the player: whose turn it is, who is expected, who is away or out, who won, and it can be picked. What else stands at a seat, such as the cards the player holds, is the game's, given to the `Seat` as its children. Shared: `seats` in `packages/table/src/layout.ts`, `Seat` and its pieces in `packages/table/src/seat/`.

## The ring

`seats(count, options)` returns one `Spot` per player, on an ellipse around the table, indexed like the players. `SeatsOptions`:

| Option | Role |
| --- | --- |
| `radiusX`, `radiusZ` | Half the width and half the depth of the ring |
| `me` | The index of the viewer's seat. Without it, or when it is not a seat (the -1 of an `indexOf`, an index past the players), nobody is the viewer |
| `margin` | The angle kept free at each end of the far half, so the outer seats do not close in on the viewer's sides |

- The viewer sits in front, on the +z side, with a yaw of zero, so what lies there reads upright.
- The others share the far half of the ring in turn order, starting with the player after the viewer, who sits at the viewer's left: the turn passes to the left. A single opponent sits straight across.
- Without a viewer, as at a spectator's view, everyone sits on the far half in order.
- Every other seat has the yaw that sends the top edge of a face-up card away from the middle of the table: the cards of a seat across from the viewer read upright for the viewer, and those of a seat at the side lie on their side.
- The ring is symmetric: the opponents mirror each other.

The ring for two to eight players, with the viewer's seat in front or with none; the arrow is the way a layout drawn in the seat's frame points.

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

## The plate

`Seat` draws one player's plate from the spot of their seat. Three seats of a table for five players, to play with the turn, the players expected together, the winners, a seat that is away or out, a plate that can be picked and the score:

```specimen
scene-seat
```

The props are `SeatProps`:

| Prop | Role |
| --- | --- |
| `nickname`, `color` | The name, written in capitals in the seat colour, and the colour that the avatar is made of until a picture exists and that the aura is lit in |
| `imageUrl` | The player's picture; when it is null the avatar is generated |
| `theme` | The game's `SeatTheme`, `UI_THEME.seat`, read with `useSeatTheme()` |
| `spot` | The seat's spot on the ring; the plate stands out from it ([Where the plate stands](#where-the-plate-stands)) |
| `viewer` | The viewer's own seat |
| `active` | The player of the turn: the crown shows on the avatar |
| `waiting` | One of several players the game waits for at once: the aura lights softly |
| `away` | The player is away: the plate fades |
| `out` | The player is out of the game or of the round: the plate fades and the name is struck |
| `winner` | A winner: the aura lights fully |
| `line` | The line under the name, already written in the visitor's language: the score |
| `status` | A word under the line, such as Frozen or Stayed, written the same way |
| `crownIcon` | The crown's icon, the skin's `hostIcon`; without one, a drawn crown |
| `font` | The CSS font of the lettering; `TABLE_FONT` by default |
| `aura` | The aura's `AuraSettings`; `WINNER_AURA_SETTINGS` by default |
| `nameStyle`, `lineStyle`, `statusStyle` | What is changed in the `TextStyle` of the name, of the line and of the status |
| `onSelect` | Makes the whole plate a click target to choose this player: under the pointer the name turns cream with the seat colour in its relief, the aura lights and the cursor is a pointer |
| `children` | What else stands at the seat, in the frame of the world: the cards held there |

- `PlayerSeat` is the `Seat` of a player of the table. Give it their `id` and it takes the nickname, the colour, the account picture, the seat theme, the crown icon and the font of the seat label from the platform (`useGame()`, `useSeatTheme()` and `useSkin()`), as `PlayerSeatLabel` does for the DOM ([Seat label](../../design/04-in-game/04-seat-label.md)), and what the table says of the player. The canvas of `Table` hands the contexts of the page on to the scene, so it works inside it.
- A player is therefore named one way in the DOM and on the table: the same avatar, the same seat colour and the same account picture, with no copy to keep in step. `Seat` takes the same values as props, for a scene outside a game such as the example above.
- The game does not say who has the turn or who won: `seatStateOf` reads it from the table (a `SeatTable`: the status, who is waited for, who is present and the winners), from what every game already has in `PublicGame` (below), and gives a `SeatState`. A prop of the same name wins, for a game whose rules say otherwise.
- The score is the game's. The `line` is a text of the visitor's language, which the template writes with `pointsShort` of the skin and never with a literal.

| State | When | Read from |
| --- | --- | --- |
| `active` | The game waits for this player alone | `waitingFor` is this player's id only |
| `waiting` | The game waits for several players at once, this one among them | `waitingFor` lists more than one id |
| `away` | The game runs and the table has not seen the player lately | `status` is `playing` and `present` does not list the id |
| `winner` | The game is over and the player won | `status` is `over` and `results.winners` lists the id |

- A step several players answer together has no player of the turn: nobody has the crown, and each player expected has a soft aura instead ([Simultaneous steps](../01-the-game/03-turns.md#simultaneous-steps)).
- A player who is away keeps the turn: the plate fades and the crown stays, so the others see that the game waits for someone who left ([Absent players](../01-the-game/03-turns.md#absent-players)).
- Nobody fades once the game is over, whoever has left by then.
- `out` and `status` are the game's to say, from its view: the `alive` flag of Exploding Kittens, the `status` of a seat in Flip 7. The contract has no word for them ([Players who are out](../01-the-game/02-players.md#players-who-are-out)).

From `template/src/components/board/scene.tsx`, a seat of the template; the backs of an opponent's cards are its children. It says nothing of the turn, of the players expected or of the winners: the table does.

```tsx
<PlayerSeat key={j.id} id={j.id} spot={s} viewer={j.id === meId} line={pointsText(j.points)}>
```

## Where the plate stands

- The plate stands out of the ring: an opponent's at `reachX` and `reachZ` times the spot, just beyond the cards, and the viewer's level with it and a little in front, at `viewerReachX` and `viewerReachZ` times it.
- The plates face the viewer whatever the yaw of the seat: only the position of the spot is used, and the cards of a seat take its yaw through their frame.
- The name stands `nameLift` toward the middle of the table from the centre of the plate, the line `lineDrop` toward the viewer, and the status `statusDrop`, under the line.
- A seat whose spot is farther right than `rightFrom` puts its avatar after the name: the cards of a right-hand seat fan out to the left of its name, and the avatar goes away from them. Otherwise it stands before the first letter. The crown stands on the avatar's upper-right corner, in the avatar's own frame, so it goes with the avatar to either side of the name.
- The aura lies under the plate, `auraWidth` by `auraDepth`, lit by the brightest of the forces that apply (`auraForce`): `turnForce` for the player of the turn, none by default since the crown says it, `waitingForce` for a player expected with others, `hoverForce` under the pointer of a plate that can be picked and `winnerForce` for a winner.
- A player who is away or out keeps `awayOpacity` of the plate: the name, the avatar, the line and the status fade, and the crown and the aura do not.

| Setting | Role |
| --- | --- |
| `reachX`, `reachZ` | How far out of the ring an opponent's plate stands, as factors of the spot |
| `viewerReachX`, `viewerReachZ` | The same for the viewer's plate |
| `rightFrom` | The x of a spot beyond which the seat is a right-hand seat |
| `nameHeight`, `nameLift` | The size of the name's letters, and how far toward the middle of the table it stands from the centre of the plate |
| `lineHeight`, `lineDrop` | The same for the line, which drops toward the viewer |
| `statusHeight`, `statusDrop` | The same for the status, which drops farther |
| `avatarSize`, `avatarGap` | The avatar's diameter and its gap to the first or the last letter |
| `crownSize`, `crownRight`, `crownBack` | The crown's size, and how far its foot stands from the avatar's centre: to the right and away from the viewer |
| `auraWidth`, `auraDepth` | The size of the aura |
| `turnForce`, `waitingForce`, `hoverForce`, `winnerForce` | How bright the aura is for the player of the turn, for a player expected with others, under the pointer and for a winner |
| `awayOpacity` | How opaque the plate of a player who is away or out stays |

`SEAT_SETTINGS` is a plain object (its type is `SeatSettings`) that the Seat folder of the table's debug panel edits (`SEAT_FIELDS` lists its knobs, and a `Seat` follows them as they move). With the panel's View folder on, every `Seat` also marks its spot on the ring and the middle of its plate. `plateOf`, `auraForce` (which takes a `SeatMood`: what lights the aura, whether the seat has the turn, is waited for, is under the pointer or won) and `seatStateOf` are the same numbers and rules as pure functions: `placement.test.ts` checks the places against those the template used before the plate moved into the package, and `state.test.ts` checks the states. From `template/src/components/board/scene.tsx`, the folder of the panel:

## What stands on a plate

| Piece | Component | Page |
| --- | --- | --- |
| The light under the plate | `Aura` | [Aura](../01-the-game/03-turns.md#aura) |
| The nickname | `TableText` | [Text on the table](09-score.md#text-on-the-table) |
| The avatar beside it | `SeatAvatarMesh` | [The avatar](#the-avatar) |
| The turn marker | `TurnCrown` | [Crown and the turn marker](../01-the-game/03-turns.md#crown-and-the-turn-marker) |
| The score line and the status | `TableText` | [Text on the table](09-score.md#text-on-the-table) |
| The click target, with `onSelect` only | An invisible plane over the plate | [Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover) |
| The cards held there | A `Zone` framed on the seat, a child of the `Seat` | [Zone](07-zones.md#zone) |

- Each piece is exported on its own too: a light on the table is not always a seat's, and `Aura` also lights a zone.
- The viewer's `Seat` has no zone of backs: their cards are the hand, in front of them and outside the ring ([Zone](07-zones.md#zone)).

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
- A `Seat` places it with the nickname: a child of the `TableText` (left of the first letter) or its `trailing` (right of the last) ([Text on the table](09-score.md#text-on-the-table)).
