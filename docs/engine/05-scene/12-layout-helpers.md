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

A `Spot` is `{ x, z, yaw? }`. The options are `FanOptions`, `RowOptions`, `PileOptions` and `GridOptions`.

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
| `lean`, `leanAmplitude` | `pile` | A key and the size of the lean: each card turns a hair by its own number ([Poses](11-poses.md)) |
| `scale` | all | The uniform scale of the cards |

## Rules

- Rows and fans are centred on x = 0, so the same layout fits any count; slot `i` is for card `i`.
- A layout is drawn in the frame of a spot. Describe a zone once, then place it where a player sits with `inFrame`, or with the `frame` of a [Zone](13-zone.md).
- `turn` is within the frame: a frame that already turns the zone adds its own turn.
- Every call returns new poses, and `inFrame` leaves its arguments alone.
- When no helper fits, write the layout by hand with `onTable`: the template's `trickPose` and `collectedPose` do.
- The ring of players is `seats`, which returns spots rather than poses ([Seats](15-seats.md)).

From `template/src/components/board/layout.ts`, where an opponent's card flies from:

```ts
export function backPose(seat: Seat, i: number, n: number): Pose {
  return inFrame(backFrame(seat), backLayout(seat, n)[i])
}
```
