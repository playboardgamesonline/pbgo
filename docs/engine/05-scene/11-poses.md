# Poses

A pose says where a card is and how it lies. Shared: `packages/table/src/pose.ts`. A layout is a list of poses, and a [Card](06-card.md) glides and flies to its `target` pose.

From `packages/table/src/pose.ts`:

```ts
export type Pose = { position: Vector3; quaternion: Quaternion; scale: number; delay?: number }
```

| Name | Role |
| --- | --- |
| `Pose` | A `position`, a `quaternion`, a uniform `scale` and an optional `delay`: the seconds a card waits before it flies there from its `from` pose |
| `onTable(x, z, options)` | A card lying flat at x, z. `OnTable` lists the options |
| `FACE_UP`, `FACE_DOWN` | The two flat orientations: the front or the back to the sky |
| `RESTING_HEIGHT` | The height of a card lying on the table, just above the table, so its edge and shadow never fight with it |
| `shifted(pose, offset)` | The same pose moved by an `Offset` (`x`, `y`, `z`): a card lifted under the pointer. The original is left alone |
| `lean(key, amplitude)` | A quaternion that turns about the vertical axis by at most `amplitude`, always the same for the same key |
| `hashRandom(key)` | A number between -1 and 1 that depends on the key alone (FNV-1a): the same on every render and for every player |

| Option of `onTable` | Role |
| --- | --- |
| `y` | The height of the card's centre; raise it by a small step per card to build a pile |
| `face` | `"up"` or `"down"`; up by default |
| `yaw` | The turn about the vertical axis, in radians |
| `lean`, `leanAmplitude` | A key, and the size of the tilt it gives the card: a hair, always the same way |
| `scale`, `delay` | The uniform scale, and the seconds before the card flies there |

## Rules

- A pose is data and the package never mutates one. `onTable` and `shifted` return new objects, and `onTable` never hands out `FACE_UP` or `FACE_DOWN` themselves, so a game may turn the pose it got.
- `delay` is carried only when given. Only the delay of a `from` pose is read ([Zone](13-zone.md)).
- `lean` is how a pile looks stacked by hand without `Math.random`: the same key leans the same way on every client.
- Cards that overlap are raised by a small step each (`rise` in `fan` and `row`, `step` in `pile`), so they never fight for the same pixels ([Layout helpers](12-layout-helpers.md)).
- `scale` is uniform: a pose cannot stretch a card.
