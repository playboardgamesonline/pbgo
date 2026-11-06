# Card

`Card` is a playing card: a rounded plane with a front, a back and a thickness, and the same behaviour in every game. Shared: `packages/table/src/card/card.tsx`. What differs from game to game is passed in: the pictures, the size, the glows and what is drawn on the face. A game draws its cards through a [Zone](13-zone.md) or a [Pile](14-pile.md); a `Card` also works alone, inside a `Table`.

## Props

| Prop | Role |
| --- | --- |
| `id` | The game's own id for the card, a `CardId`; it feeds the [pose memory](10-pose-memory.md) |
| `target` | The `Pose` the card lies in. When it changes the card glides there, and when it jumps far the card flies |
| `from` | The `Pose` the card flies in from when it appears; without it the card appears at `target`, or where the pose memory says |
| `front`, `back` | The textures of the two sides ([Faces and textures](07-faces-and-textures.md)) |
| `size` | A `CardSize`, the same for every card of a game |
| `glow` | A `Glow` from `defineGlows`, or `null` ([Glows](08-glows.md)) |
| `gloss` | The shine that follows the pointer over the front: `true` for the usual strength, a number for its own |
| `shadow` | Whether the card casts a drop shadow; on unless set to false |
| `above` | Draws the card over everything else, the glows of other cards included |
| `speed` | About how many seconds the card takes to settle on a new `target`; smaller is snappier |
| `onClick`, `onHover` | Pointer events ([Clicks and hover](20-clicks-and-hover.md)) |
| `onArrive` | Called when a flight ends, for instance to remove a card that exists only for its flight |
| `draggable`, `onDrop` | Reserved, with no effect (PLT-69); `CardDrop` is the type reserved for where a dragged card was let go |
| `children` | Three.js elements drawn on the face, such as a value or a suit. Their origin is the middle of the face, x to the right and y up, in the card's units; they move, flip and hover with the card |

`CardProps` is the type of the props.

## Settings

`CARD_SETTINGS` is one object read on every frame by every card of the page, so a debug panel can tune it while the game runs. What a glow looks like belongs to the glow ([Glows](08-glows.md)).

| Field | Role |
| --- | --- |
| `gloss` | The opacity of the shine on a hovered card; a card can ask for its own with the `gloss` prop |
| `glossMotion` | How far the shine slides with the pointer |
| `shadow` | The opacity of the drop shadow |
| `flightDuration`, `flightHeight` | Multipliers on how long a flight lasts and how high it arches |
| `easing` | The name of the easing of a flight, one of `EASING_NAMES` of core |
| `thickness` | The thickness of the card, as a fraction of its width |
| `foldable` | How much the card arches in flight, as a fraction of its half height |

## Rules

- A card glides to a new `target` by damping. It flies when it appears with a `from`, when the pose memory hands back a pose farther than `JUMP` from `target`, and when its `target` moves farther than `JUMP` in one go and the card is not already near it ([Flight and fold](09-flight-and-fold.md)).
- A card does not lift itself on hover: it reports the pointer, and the game moves the pose and sets `glow` or `gloss` ([Clicks and hover](20-clicks-and-hover.md)).
- Each layer of the card (face, overlay, frame, shine and sparkle on the front; outline, halo and shadow on the back) has its own offset from the surface, in `FRONT` and `BACK` of `card.tsx`, far enough apart for the depth buffer to tell them apart: a new layer takes an offset of its own.
- Cards of one `size` share their geometry, and the cut that lets a card bend is made once per geometry.
- The rim of the card has one colour, fixed in `card.tsx`; it is not a prop.
- A card ignores the visitor's motion preference; only the camera's entrance reads it.
- `JUMP`, `FRONT` and `BACK` are internal.

From `template/src/components/board/scene.tsx`, the hand's cards as a `ZoneCard` list:

```tsx
const handCards: ZoneCard[] = hand.map((c) => ({
  key: c.id,
  id: c.id,
  front: faceTexture(c),
  back,
  glow: myTurn && hovered === c.id ? GLOWS.selection : null,
  gloss: hovered === c.id,
  // …
}))
```
