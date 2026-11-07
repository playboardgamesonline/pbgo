# Seats

A seat is a place at the table where a player sits. `seats` gives the places; what stands on a seat (a name plate, an aura, a crown, the cards the player holds) is written per game, and there is no `Seat` component ([Not built yet](../03-not-built-yet.md)). Shared: `seats` in `packages/table/src/layout.ts`. Per game: the template's `board/scene.tsx` and `layout.ts`.

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

From `template/src/components/board/layout.ts`, the seats of a table, by player id:

```ts
export function seats(ids: string[], meId: string | null): Map<string, Seat> {
  const R = LAYOUT_SETTINGS
  const viewer = ids.indexOf(meId ?? "")
  const ring = ringOf(ids.length, { radiusX: R.radiusX, radiusZ: R.radiusZ, me: viewer < 0 ? null : viewer })
  return new Map(ids.map((id, i): [string, Seat] => [id, ring[i]]))
}
```

## What stands on a seat

The template's `World` draws a group for each player, from the spot of their seat (`Seat` is `Required<Spot>`):

| Piece | Component | Page |
| --- | --- | --- |
| The light under the plate | `Aura` | [Aura](../01-the-game/03-turns.md#aura) |
| The nickname | `TableText` | [Text on the table](09-score.md#text-on-the-table) |
| The avatar beside it | `SeatAvatarMesh` | [The avatar](#the-avatar) |
| The turn marker | `TurnCrown` | [Crown and the turn marker](../01-the-game/03-turns.md#crown-and-the-turn-marker) |
| The points | `TableText` | [Text on the table](09-score.md#text-on-the-table) |
| The cards held there | A `Zone` framed on the seat | [Zone](07-zones.md#zone) |

- The plate and the cards are placed from the spot by factors of its coordinates (`pos` in `scene.tsx`, `backFrame` in `layout.ts`), not on the spot itself: the ring stays the seat's place, and each piece moves on its own.
- The viewer's group has no zone of backs: their cards are the hand, in front of them and outside the ring ([Zone](07-zones.md#zone)).
- The plates face the viewer whatever the yaw of the seat; the cards of a seat take that yaw through their frame.

## The avatar

The seat avatar is the picture that stands for a player next to their nickname. The same picture is drawn in the DOM by `SeatLabel` and on the table by `SeatAvatarMesh` ([Seat label](../../design/04-in-game/04-seat-label.md)). Core specifies the avatar (`seatAvatar`) and paints it on a 2D canvas (`useSeatAvatarCanvas`), and stays free of three.js; the game wraps that canvas in a texture and lays it on a plane. Per game: the template's `board/seat-avatar-mesh.tsx` is the reference.

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
- Place it with the nickname: in the template it is a child of the `TableText` (left of the first letter) or its `trailing` (right of the last) ([Text on the table](09-score.md#text-on-the-table)).
