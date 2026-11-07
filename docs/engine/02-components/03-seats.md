# Seats

A seat is a place at the table where a player sits. `seats` gives the places, and `Seat` draws the player who sits at one: the name with the avatar and the turn crown, the score under it, and an aura under them. What else stands at a seat, such as the cards the player holds, is the game's, given to the `Seat` as its children. Shared: `seats` in `packages/table/src/layout.ts`, `Seat` and its pieces in `packages/table/src/seat/`.

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

`Seat` draws one player's plate from the spot of their seat. Three seats of a table for five players, to play with the turn, the winners and the score:

```specimen
scene-seat
```

| Prop | Role |
| --- | --- |
| `nickname`, `color` | The name, written in capitals in the seat colour, and the colour that the avatar is made of until a picture exists and that the aura is lit in |
| `imageUrl` | The player's picture; when it is null the avatar is generated |
| `theme` | The game's `SeatTheme`, `UI_THEME.seat`, read with `useSeatTheme()` |
| `spot` | The seat's spot on the ring; the plate stands out from it ([Where the plate stands](#where-the-plate-stands)) |
| `viewer` | The viewer's own seat |
| `active` | The player of the turn: the crown shows and the aura lights |
| `winner` | A winner: the aura lights, and the turn wins when both hold |
| `line` | The line under the name, already written in the visitor's language: the score |
| `crownIcon` | The crown's icon, the skin's `hostIcon`; without one, a drawn crown |
| `font` | The CSS font of the lettering; `TABLE_FONT` by default |
| `aura` | The aura's `AuraSettings`; `WINNER_AURA_SETTINGS` by default |
| `nameStyle`, `lineStyle` | What is changed in the `TextStyle` of the name and of the line |
| `children` | What else stands at the seat, in the frame of the world: the cards held there |

- `PlayerSeat` is the `Seat` of a player of the table. Give it their `id` and it takes the nickname, the colour, the account picture, the seat theme and the crown icon from the platform (`useGame()`, `useSeatTheme()` and `useSkin()`), as `PlayerSeatLabel` does for the DOM ([Seat label](../../design/04-in-game/04-seat-label.md)). The canvas of `Table` hands the contexts of the page on to the scene, so it works inside it.
- A player is therefore named one way in the DOM and on the table: the same avatar, the same seat colour and the same account picture, with no copy to keep in step. `Seat` takes the same values as props, for a scene outside a game such as the example above.
- `active` and `winner` are the game's to say: the template takes the first from `activePlayerId` of its view and the second from `results`.
- The score is the game's too. The `line` is a text of the visitor's language, which the template writes with `pointsShort` of the skin and never with a literal.

From `template/src/components/board/scene.tsx`, a seat of the template; the backs of an opponent's cards are its children:

```tsx
<PlayerSeat key={j.id} id={j.id} spot={s} viewer={j.id === meId} active={view.activePlayerId === j.id} winner={winners.includes(j.id)} line={pointsText(j.points)}>
```

## Where the plate stands

- The plate stands out of the ring: an opponent's at `reachX` and `reachZ` times the spot, just beyond the cards, and the viewer's level with it and a little in front, at `viewerReachX` and `viewerReachZ` times it.
- The plates face the viewer whatever the yaw of the seat: only the position of the spot is used, and the cards of a seat take its yaw through their frame.
- The name stands `nameLift` toward the middle of the table from the centre of the plate, and the line `lineDrop` toward the viewer.
- A seat whose spot is farther right than `rightFrom` puts its avatar after the name: the cards of a right-hand seat fan out to the left of its name, and the avatar goes away from them. Otherwise it stands before the first letter, and the crown stands left of whatever stands before the name.
- The aura lies under the plate, `auraWidth` by `auraDepth`, with the force `turnForce` for the player of the turn, else `winnerForce` for a winner, else none (`auraForce`).

| Setting | Role |
| --- | --- |
| `reachX`, `reachZ` | How far out of the ring an opponent's plate stands, as factors of the spot |
| `viewerReachX`, `viewerReachZ` | The same for the viewer's plate |
| `rightFrom` | The x of a spot beyond which the seat is a right-hand seat |
| `nameHeight`, `nameLift` | The size of the name's letters, and how far toward the middle of the table it stands from the centre of the plate |
| `lineHeight`, `lineDrop` | The same for the line, which drops toward the viewer |
| `avatarSize`, `avatarGap` | The avatar's diameter and its gap to the first or the last letter |
| `crownGap` | The gap between the crown and what stands to its right |
| `auraWidth`, `auraDepth` | The size of the aura |
| `turnForce`, `winnerForce` | How bright the aura is on the turn and for a winner |

`SEAT_SETTINGS` is a plain object that a debug panel edits, `SEAT_FIELDS` lists its knobs, and the next render of a `Seat` follows it. `plateOf` and `auraForce` are the same numbers as pure functions, and `placement.test.ts` checks them against the places the template used before the plate moved into the package. From `template/src/components/board/scene.tsx`, the folder of the panel:

```tsx
useSettings("Seat", SEAT_SETTINGS, SEAT_FIELDS, { order: 3 })
```

## What stands on a plate

| Piece | Component | Page |
| --- | --- | --- |
| The light under the plate | `Aura` | [Aura](../01-the-game/03-turns.md#aura) |
| The nickname | `TableText` | [Text on the table](09-score.md#text-on-the-table) |
| The avatar beside it | `SeatAvatarMesh` | [The avatar](#the-avatar) |
| The turn marker | `TurnCrown` | [Crown and the turn marker](../01-the-game/03-turns.md#crown-and-the-turn-marker) |
| The score line | `TableText` | [Text on the table](09-score.md#text-on-the-table) |
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
| `layer` | The render order, to draw it over or under other flat things |

- It draws nothing until the canvas is ready (a font or a picture may still be loading), then lies flat on the table.
- The plane is larger than the avatar by `AVATAR_FILL` of core, the share of the canvas the avatar fills, so the ring and the shadow fit. `size` is the avatar's own diameter.
- The texture is disposed when it changes or when the component goes, and it takes no pointer events ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)).
- A `Seat` places it with the nickname: a child of the `TableText` (left of the first letter) or its `trailing` (right of the last) ([Text on the table](09-score.md#text-on-the-table)).
