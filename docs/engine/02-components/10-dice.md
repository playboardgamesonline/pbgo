# Dice

A die is some faces, a shape and a value on each face, and it rolls with physics. The engine draws the number the die ends on; the board throws the die, and the physics decides how it falls: it bounces, tumbles, knocks the dice around it and stops. The roll is simulated first, before anything is drawn, and the die is then labelled so that the face that ended on top carries the engine's number, so the die always ends on the right face, stays a proper die, and every player sees the same throw. The kit's side is `packages/engine-kit/src/dice.ts`, the table's `packages/table/src/die/`.

Roll the dice, change their shape and their number, look at the table from above to read the faces that lie up, and tune the throw: the scene reads the same settings as the debug panel's Die folder.

```specimen
scene-dice
```

## The parts of a die

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Shape | The solid: its corners, its faces, which face is opposite which, the ways it turns onto itself. Any number of faces | `dieModel` gives a d6, d8, d10, d12 and d20 (`DIE_SHAPES` lists them and a `DieShape` is one of them); `makeDieModel` makes the model of a solid of a game's own from its corners (a `ModelInput`) |
| Values | What each face says: numbers, words | The `values` of the die, one for each face (a `DieValue` is a number or a word), from 1 up to the number of faces unless the game gives its own |
| Pictures | What each value looks like on its face | The `faces` of the die, textures painted by the game; by default the pips of `pipFace` on a cube numbered 1 to 6 and the number written by `numberFace` on any other; `DEFAULT_BODY` and `DEFAULT_INK` are the ivory and the dark ink of that default die |
| Size and colour | How big the die is, and the colour of its body and ink | `size`, `body`, `ink` |

A die of King of Tokyo is a cube whose values are `1`, `2`, `3`, a claw, a heart and an energy; a die of Perudo is a cube kept under a cup; a die of a role-playing game is a d20. None of them is a component of its own: each is a `Die` given its shape, its values and its pictures.

## In the engine

| Export | What it does | Errors |
| --- | --- | --- |
| `rollDie(rng, sides)` | One roll: a whole number from 1 to `sides`, six by default. Draws one number from the stream | `RangeError` for a die with fewer than two sides, or not a whole number of them |
| `rollDice(rng, count, sides)` | `count` dice, one after the other, in order: the same as that many `rollDie`. Nothing is drawn for an empty pool | `RangeError` for a pool that is not a whole number of dice |
| `rerollDice(rng, dice, reroll, sides)` | A pool rolled again: the dice at the indexes of `reroll` roll, in the order of their index whatever order they were listed in, and the others keep their value. A new array | `RangeError` for an index that is not a die of the pool or is listed twice |

- A roll belongs to `apply`, never to `view`. Restore the stream from the state with `restoreRng`, roll, and keep `save()` in the new state ([Random numbers](../01-the-game/09-state.md#random-numbers)): the same seed and the same actions give the same dice, and a client cannot know the next roll, since the position of the stream is in no view.
- The state keeps the numbers, a plain list. The view gives them to whoever may see them: a roll nobody may read until it is revealed (Liar's Dice under a cup) is in the view of its owner only, like any other hidden information ([Hidden information](../01-the-game/10-views.md#hidden-information)).
- A number is the place of a value in the die's list of values: a die whose faces are a claw and a heart rolls a number from 1 to its faces like any other, and the board reads its picture from `values[number - 1]`.
- The roll is said in the log: the event carries the numbers, the board throws the dice from it, and the history reads a sentence of the game's own, written in Sanity ([Events and the log](../01-the-game/12-events-and-the-log.md)). A roll that only some players may see is an event with `to`, and a `masked` one for the others.
- Dice that are kept while the others roll again (Yahtzee, King of Tokyo, Can't Stop) are two lists of the state, the numbers and which ones are kept: the player's action names the indexes, the engine checks them and calls `rerollDice`.

From `packages/engine-kit/src/dice.test.ts`, a game that rolls in `apply` and carries on from the same point of the stream:

```ts
type State = { rng: number; dice: number[]; rolls: number }

const roll = (state: State, count: number): State => {
  const rng = restoreRng(state.rng)
  const dice = rollDice(rng, count)
  return { rng: rng.save(), dice, rolls: state.rolls + 1 }
}
```

## On the table

A `Die` is shared: `packages/table/src/die/die.tsx`. It lies on the face that carries `value`; when its `roll` changes it is thrown and rolls onto the table. The props are `DieProps`:

| Prop | Role |
| --- | --- |
| `id` | Names the die. It seeds the look of its roll, so that every player sees the same throw, and tells one die from another in a tray: no two dice of a tray have the same |
| `model` | The shape: `d6` by default, another die of the package, or a `DieModel` of the game's own |
| `values` | What each face says, one entry for each face as the labels run |
| `value` | The value that lies up: one of `values`, the one the engine gave. The die shows it at once when it appears |
| `at` | `{ x, z, yaw? }`: where the die lies and which way it is turned. Without a `yaw` it lies a little askew, always the same way for the same `id`. After a roll the die stays where it landed until `at` or `value` changes |
| `size` | The distance across the die from a face to the opposite one, in world units, `DIE_SIZE` by default |
| `roll` | Names the roll that gave `value`. When it changes after the die appeared, the die is thrown; while it stays, nothing is thrown |
| `from` | Where the die is thrown from, its centre. By default from the near side of its tray, above the table |
| `lift` | How high the die is held above the table once it lies still: a die the player keeps aside |
| `faces` | The picture of each value, `faces[i]` for `values[i]`: textures in sRGB, painted by the game or made from its pictures |
| `body`, `ink` | The colour of the body, and of the ink of the default faces |
| `onClick`, `onHover` | Make the die a click target, to keep it or roll it again ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)) |
| `onBounce` | Called each time a rolling die hits the table, with how hard (1 is the hardest): where a game plays the sound of a die |
| `onLand` | Called when a roll ends and the die lies still |

A `DiceTray` is the part of the table the dice are thrown onto, and the world the physics runs in:

| Prop | Role |
| --- | --- |
| `area` | `{ x, z, width, depth }` (a `DiceArea`): the rectangle the dice roll in. An invisible wall keeps them in it |

- The dice of a tray that roll in the same moment are thrown together, so they meet and knock one another; the dice that lie still in the tray are in their way, as they are on a table. A die outside any tray is thrown alone, in an area around its place.
- Pass `roll` something every player sees alike and that changes with each roll: the `v` of the line of the log that rolled, or a count of rolls the view carries. A board that opens on a table with dice already rolled shows them lying still, since the `roll` it starts with is not a new one, and a catch-up of several rolls throws the dice once, for the last.
- Draw the dice from the view, not from the event: the die shows `value` at once and the event is only the moment it is thrown.

```tsx
const rolled = useGameLog<RollEvent>().filter((line) => line.event.kind === "roll").at(-1)

<DiceTray area={{ x: 0, z: 0, width: 6, depth: 4 }}>
  {view.dice.map((value, i) => (
    <Die key={i} id={`die-${i}`} model="d20" value={value} roll={rolled?.v} at={{ x: i * 1.4, z: 0 }} />
  ))}
</DiceTray>
```

### A roll

- The roll is simulated before it is drawn, in a physics world made of the table, the wall of the tray and the dice that lie there. It takes a few milliseconds, so by the first frame the whole roll is known: where each die goes, how it turns, which face ends on top.
- The throw is worked out from the die's `id` and the roll alone, never at random, and the physics engine is a deterministic build, so the throw is the same on every machine.
- The die is then labelled so that the face on top carries the engine's number. It is done by turning the labels with one of the ways the solid turns onto itself, so the die stays a proper one (opposite faces still add up to the same number) and nobody can tell it from a die that landed that way. A solid with no such turn swaps the two labels.
- A die that ends on an edge, or leaning on the wall, is tipped over onto a face a little after it stopped, as a die that is not quite still falls.
- A die that is moved, or whose `value` changes with no new `roll`, glides and turns to its new place and face.
- A visitor who asks for less motion sees the die lie on its value at once; `onLand` is still called. So does a table whose physics could not be loaded.
- The die carries its own light and needs none from the table: its faces are brighter as they turn toward it, and an edge catches a glint as the die rolls.
- The physics is a chunk of its own, a few megabytes with its WebAssembly inside, loaded as soon as a die is on a table and never on a board without dice. `loadPhysics()` loads it, once: a `Die` calls it as it appears, and a board that wants the chunk early may call it first.

### Models

A model is made from the corners of a solid, middle of it on the origin: its faces are the flat faces of the solid, found from the corners, and everything else follows.

```ts
const prism = makeDieModel({ name: "prism", corners, geometry: (model, size) => myGeometry(model, size) })
```

- A `DieModel` keeps a `FaceInfo` for each face: the direction it looks at, its middle, the corners of its flat part and how far its middle is from the middle of the die.
- `makeDieModel` scales the solid so that the distance across two opposite faces is 1, finds the faces, the face opposite each, the turns of the solid onto itself and the labels of a new die (opposite faces add up to the same number). A die whose faces are not all flat, such as the cube with its corners cut, says which faces count with `faces`.
- `geometry` draws the solid at a size: one group of triangles for each face, `face + 1` being the index of its material, the same colour attribute for the light. `polyhedronGeometry` draws any solid whose faces are flat polygons, each with its picture laid over the circle inscribed in it.
- The faces of the package: the cube is numbered 1 to 6 with 1 up, 2 toward the viewer and 3 to the right, and the other dice put the numbers in order with opposite faces adding up to one more than the number of faces.

### Settings

`DIE_SETTINGS` is read by every die: how fast things fall, how much a die bounces and grips, how hard it is thrown and how it spins (read when a roll is thrown), then how fast a roll plays back, the shadow and how fast a die glides (read on every frame). The debug panel has a Die folder for it, with a button that throws every die again ([Tuning](../04-build-a-game/07-tuning.md)).

### Not built

- A die made from a 3D file: the model takes the corners of a solid in code, and nothing reads them from a model that an artist made.
- A d4, whose number is read at a corner and not on a face.
- A die the player throws by hand, by dragging it: a die is thrown by the physics from where the game puts it, and `draggable` is for cards and pieces ([Dragging](19-dragging.md#not-built)).
- Dice that move inside a cup as it is shaken: the cup is a cover with a shake for show, and the dice are thrown from its mouth ([Cups](17-cups.md)).
