# Poses and motion

A pose says where a card is and how it lies. A layout is a list of poses ([Layout helpers](08-layout-helpers.md)), and a [Card](04-cards.md#card) glides and flies to its `target` pose. Shared, in `packages/table/src/`: `pose.ts` for the poses; for the motion, `card/flight.ts` and `card/fold.ts` (internal to `Card`) and `table/memory.ts` (internal to `Table` and `Card`).

## Poses

From `packages/table/src/pose.ts`, a pose (`delay` is the seconds a card waits before it flies there from its `from` pose):

```ts
export type Pose = { position: Vector3; quaternion: Quaternion; scale: number; delay?: number }
```

| Name | Role |
| --- | --- |
| `onTable(x, z, options)` | A card lying flat at x, z. `OnTable` lists the options |
| `FACE_UP`, `FACE_DOWN` | The two flat orientations: the front or the back to the sky |
| `RESTING_HEIGHT` | The height of a card lying on the table, just above it, so its edge and shadow never fight with it |
| `shifted(pose, offset)` | The same pose moved by an `Offset` (`x`, `y`, `z`): a card lifted under the pointer |
| `lean(key, amplitude)` | A quaternion that turns about the vertical axis by at most `amplitude`, always the same for the same key on every client: a pile that looks stacked by hand, without `Math.random` |
| `hashRandom(key)` | A number between -1 and 1 that depends on the key alone (FNV-1a): the same on every render and for every player |

| Option of `onTable` | Role |
| --- | --- |
| `y` | The height of the card's centre; raise it by a small step per card to build a pile |
| `face` | `"up"` or `"down"`; up by default |
| `yaw` | The turn about the vertical axis, in radians |
| `lean`, `leanAmplitude` | A key, and the size of the tilt it gives the card: a hair, always the same way |
| `scale`, `delay` | The uniform scale (a pose cannot stretch a card), and the seconds before the card flies there |

- A pose is data and the package never mutates one: `onTable` and `shifted` return new objects, and `onTable` never hands out `FACE_UP` or `FACE_DOWN` themselves, so a game may turn the pose it got.
- `delay` is carried only when given, and only the delay of a `from` pose is read ([Zone](07-zones.md#zone)).

## Flight and fold

A flight takes a card from one pose to another along a curve, and a fold bends the card while it flies. A game reaches them through `Card` and the fields of `CARD_SETTINGS` ([Settings](04-cards.md#settings)); `flight.test.ts` and `fold.test.ts` state what the functions of the two files do.

Send the card across; the sliders write into `CARD_SETTINGS`, and the next flight follows them.

```specimen
scene-flight
```

- A flight starts from where the card is (position, orientation, scale) once the `delay` of the pose it flies from has passed; until then the card waits at that pose.
- Its duration and its height grow with the distance, then `flightDuration` and `flightHeight` scale them; `easing` names the curve of the clock, one of `EASING_NAMES` of core.
- The path is a cubic Bézier from the start to the target, with its control points above both ends. A card that is already high gets no extra lift.
- Along the way the card turns about the vertical axis and swells a little, both peaking mid-flight. It lands exactly on the target pose, orientation and scale included, then `onArrive` is called.
- The flight follows the `target` the card has on every frame, so a target that moves in mid-flight moves the landing.
- The side it arches and turns toward is drawn at random for each flight, so two clients can differ. It is cosmetic.
- The fold arches the card along its height while it flies, by the `foldable` setting times a sine of the flight, toward the side of the flight; it relaxes when the card lands.
- The bend is done in the vertex shader of the front, the rim and the back (`applyFold`), on a geometry cut into small triangles by the function `foldable`, once per geometry.
- What is drawn on the face rides above it by the height of the arch, or the arch would hide it ([`children` of Card](04-cards.md#props)).

## Pose memory

A card that changes zone is not the same React element: it unmounts from one `Zone` and mounts in another. The pose memory lets the new one start from where the old one was instead of popping into place. Each `Table` has one, carried to the cards by `memory-context.tsx`; it holds poses, not cards, and keeps nothing alive. A game only gives a card an `id`, a `CardId` (a string or a number).

Press a card to move it to the other zone: it is a new element there with the same `id`, and it flies from where it was.

```specimen
scene-pose-memory
```

1. A card with an `id` that leaves the table writes down where it was, in the world.
2. A card with the same `id` that mounts within `maxAge`, in another zone, asks for it: the memory hands back that pose, put in the frame of the new card's parent, and the card starts there.
3. The card flies when that pose is farther than `JUMP` from its `target`, and glides when it is nearer.

From `packages/table/src/card/card.tsx`, the mount of a card:

```ts
const left = memory && id !== undefined ? memory.recall(id, g, target) : null
const p = from ?? left ?? target
```

- Give a card the game's own id for it, stable and unique at the table. The template uses a card's id as its `key` and its `id` both in the hand and in the middle, so a card a player plays flies from the hand to the middle with no `from` written.
- A given `from` wins over the memory, but the sighting is still taken out, so an old one never misleads a later card.
- A sighting is handed back once. The memory keeps a bounded number of them (`capacity`), the oldest going first, and `Table` uses the defaults of `createPoseMemory`.
- A card that is already where it should be (same place, orientation and scale, within a hair) gets nothing back, so it does not fly.
- A card with no `id` is not remembered, and a `Card` outside a `Table` has no memory to ask.
- A card reads its `id` once, when it mounts. If the `id` of a card that stays changes, the memory still knows it by the first one, or not at all when it came with none.
