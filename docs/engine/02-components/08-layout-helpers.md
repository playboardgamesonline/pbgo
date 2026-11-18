# Layout helpers

A layout helper returns the poses of a zone: one `Pose` per card, in the order of the cards. Shared, pure and tested: `packages/table/src/layout.ts`. They read no setting; every number is an argument, so a game passes its own settings object and its debug panel keeps editing it.

## Helpers

| Helper | Returns | The shape |
| --- | --- | --- |
| `fan(n, options)` | `Pose[]` | A hand: centred on x = 0, the first card on the left, each card a little higher than the one before |
| `row(n, options)` | `Pose[]` | A flat line along x, centred, the first card on the left |
| `pile(n, options)` | `Pose[]` | A stack at the origin, the bottom card first |
| `grid(n, options)` | `Pose[]` | Lines in reading order: the first line is the farthest from the viewer, the first card on its left, and a last line that is not full stays on the left |
| `inFrame(spot, pose)` | `Pose` | A pose drawn in the frame of a spot, put on the table: it turns first, then moves |
| `scalePoses(poses, by)` | `Pose[]` | A layout made smaller or larger as a whole: the places of the slots and the scale of the cards are multiplied by `by`, and their heights are kept. For a hand that has to fit the room a window leaves it ([The hand in the corner](07-zones.md#the-hand-in-the-corner)) |

A `Spot` is `{ x, z, yaw? }`. The options are `FanOptions`, `RowOptions`, `PileOptions` and `GridOptions`.

One `Zone` laid by each helper in turn: the cards keep their keys, so they glide from slot to slot.

```specimen
scene-layouts
```

## Options

| Option | Helpers | Role |
| --- | --- | --- |
| `gap` | `fan`, `row` | The distance along x between two neighbours |
| `columns`, `gapX`, `gapZ` | `grid` | Cards per line, and the distances along x and along z |
| `rows` | `grid` | The number of lines the grid is centred on; fix it so the cells stay where they are while the cards come |
| `y` | all | The height of the first card; `RESTING_HEIGHT` by default |
| `rise` | `fan`, `row` | Extra height per card, so overlapping cards never fight for the same pixels |
| `step` | `pile` | The height between two cards |
| `z` | `fan`, `row` | Where the middle of the layout lies along z |
| `curve` | `fan` | Extra z per card of distance from the middle: the ends swing toward the viewer |
| `tilt` | `fan` | The lean of every card toward the viewer, in radians; more stands the cards up |
| `roll` | `fan` | The turn of a card about its own axis per card from the middle, so the fan opens toward the far side |
| `turn` | `row`, `grid` | The turn of each card about the vertical axis, in radians, within the frame |
| `face` | all | `"up"` or `"down"`: up by default, down for `pile` |
| `topFace` | `pile` | The face of the top card alone; the face of the others by default |
| `lean`, `leanAmplitude` | `pile` | A key and the size of the lean: each card turns a hair by its own number ([Poses](05-poses-and-motion.md)) |
| `scale` | all | The uniform scale of the cards |

## Boxes

A layout says where each card lies; a box says what a set of cards covers of the table. A `TableBox` is `{ minX, maxX, minZ, maxZ }` in world units, its sides along x and z: x to the right, z toward the viewer, so the top of the screen is the least z. It is what a board measures with, whichever way its cards are turned, and what the plate of a seat stands beyond, on the side that faces the middle of the table ([Seats](03-seats.md#where-the-plate-stands)). A box can be in the world or in the frame of a seat: the box of a hand laid in a frame is in that frame, so that it is turned with the seat. Shared: `packages/table/src/box.ts`, tested in `box.test.ts`.

| Helper | What it gives |
| --- | --- |
| `boxOfPoses(poses, size, { frame, tilt })` | The box of the cards laid in `poses`: the four corners of each, as its pose scales, turns and places it. The poses are in the world, or in the frame of `frame` (as a `Zone` takes its layout). With `tilt`, the camera's tilt as `CameraSettings.tilt`, the box of what the camera sees: a card that stands off the table hides the part behind it, so its box reaches farther up the screen by its height times the tangent of the tilt. `null` for no card |
| `frameBoxOfPoses(poses, size, frame, { tilt })` | The box of the cards laid in `poses`, in the frame of a seat: the poses are the ones a `Zone` takes with that `frame`, and the box is in the frame too. With `tilt` it is what the camera sees, and the part that a standing card hides is moved the way the screen shows it, which the frame turns with the seat: a card that stands `y` high shows `y` times the tangent of the tilt farther from the camera along the world's z, which for a turned seat is a shift in x and in z of the frame. This is the `above` of a `Seat` |
| `pointInFrame(frame, { x, z })` | The place on the table of a point drawn in the frame of a spot: it turns first, then moves, as `inFrame` does for a pose |
| `cornersOfBox(box, frame)` | The four corners of a box of a frame, on the table, going round: what a plate or an area covers when its seat is turned. For a test that compares exact shapes |
| `boxOfRect({ x, z, width, depth, yaw })` | The box of a rectangle `width` along its own x and `depth` along its own z, centred at (`x`, `z`) and turned `yaw` about the vertical |
| `joinBoxes(boxes)` | The smallest box that holds them all; a `null` (a player with no cards) is skipped, and no box at all is `null` |
| `centreOf(box)` | The middle of a box (in the frame the box is in) |
| `boxesOverlap(a, b, by)` | Whether two boxes cover some of the table together, or come closer than `by` |

- A box of rotated cards is the box of their corners, so it is larger than the cards: a row turned by a quarter turn is as wide as the cards are deep. Where the exact shape matters (a plate beside a turned row), a test uses the corners of each card and the separating axes of two convex shapes, as the layout tests of the template and of Flip 7 do; the box is for placing.
- A box is what a board asks of its layout and not a layout itself: a player's cards are boxed at the room of the biggest hand, so the plate above them does not move as cards are played.

## Rules

- Rows and fans are centred on x = 0, so the same layout fits any count; slot `i` is for card `i`.
- A layout is drawn in the frame of a spot. Describe a zone once, then place it where a player sits with `inFrame`, or with the `frame` of a [Zone](07-zones.md#zone).
- `turn` is within the frame: a frame that already turns the zone adds its own turn.
- Every call returns new poses, and `inFrame` leaves its arguments alone.
- When no helper fits, write the layout by hand with `onTable`: the template's `trickPose` and `collectedPose` do.
- The ring of players is `seats`, which returns spots rather than poses, each turned toward the middle of the table ([Seats](03-seats.md)); `boxOfPoses` and `frameBoxOfPoses` measure what a layout covers ([Boxes](#boxes)).

From `template/src/components/board/layout.ts`, where an opponent's card flies from (`SeatSpot` is the template's name for `Required<Spot>`):

```ts
export function backPose(seat: SeatSpot, i: number, n: number): Pose {
  return inFrame(heldFrame(seat), heldLayout(n)[i])
}
```
