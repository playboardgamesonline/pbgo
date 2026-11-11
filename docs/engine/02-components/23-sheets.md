# Sheets

A sheet is paper with boxes that players mark and fill: the scorecard of Yahtzee, the sheet of Welcome To, the pad of Qwixx or Cartographers. The state keeps what is in each box by its number, in an array. On the table a sheet is a `Sheet`, a paper laid on the table whose boxes, its `cells`, are rectangles as parts of the sheet. The boxes that can be chosen are ringed, and pressing one tells the game its number. What is printed on the paper, the title, the names of the rows and the rules between the boxes, is drawn by the game's own `printed`.

Roll the dice, keep the ones you want with the tokens or with the buttons under the scene, and roll again, up to three times. Every empty box that can be chosen is ringed and shows in faint ink what the dice would score in it; press one to write the score. The scores are the specimen's own rules: the table only shows what the board gives it. The button under the scene writes the best box, which is the way to it with the keyboard.

```specimen
scene-sheet
```

## The parts of a sheet

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Box | A rectangle of the sheet that holds a score, a number or a mark | The game's list `cells`, or the cells of `gridCells` |
| What is in a box | A score, a number, a tick, a cross, nothing yet | The state of the engine: an array, by the number of the box |
| Printed paper | The title, the names of the rows, the rules between the boxes | The game: `printed` |
| Boxes that can be chosen | The empty boxes the rules let a player fill now | The engine: the view says which, and the board gives them as `halo` |
| Suggestion | What a box would take, written in faint ink | The board: `look` with `faint` |
| Sheet | The paper, painted and laid on the table | `Sheet` |

## In the engine

A sheet adds nothing to the engine: the boxes are an array of what each holds, and the rules of what may be written where are the game's. A box that a player names goes through `cleanChoice` first, with the boxes that are allowed as its options ([Bets and choices](12-bets-and-choices.md)), and a score that the rules work out comes from the state and never from the request.

```ts
type State = { dice: number[]; rolls: number; scores: (number | null)[] }

function score(state: State, input: unknown): State {
  // The empty boxes are the options: anything else is refused with INVALID_CHOICE
  const open = state.scores.flatMap((had, box) => (had === null ? [box] : []))
  const box = cleanChoice(input, open)
  // What the dice score is the game's rule, worked out here
  return { ...state, scores: state.scores.map((had, at) => (at === box ? scoreOf(box, state.dice) : had)), rolls: 0 }
}
```

- The view gives the board the array, and the boxes that can be chosen, so that what the board rings is what the engine accepts.
- A sheet for each player is an array for each player, and the view gives each its owner's. A game whose players write in secret hides the others' boxes until they are revealed ([Simultaneous steps](../01-the-game/03-turns.md#simultaneous-steps)).
- The boxes that are crossed out, ticked or circled are one more number for each: `0` empty, `1` ticked, and so on, whatever the game says.

## On the table

### The sheet

```tsx
const CELLS = gridCells({ columns: 1, rows: 15, x: 0.68, y: 0.1, width: 0.28, height: 0.86, gapY: 0.004 })

<Sheet
  at={{ x: -2.6, z: 0.1 }}
  width={4.4}
  height={5.9}
  cells={CELLS}
  printed={(g, { width, height }) => { /* the title and the names of the rows */ }}
  look={(box) => (view.scores[box] === null ? { text: String(preview(box)), faint: true } : { text: String(view.scores[box]) })}
  halo={view.open}
  onCell={(box) => send({ type: "score", box })}
/>
```

The props are `SheetProps`:

| Prop | Role |
| --- | --- |
| `at` | Where the middle of the sheet lies on the table, `x` and `z`, and the way it faces, `yaw` |
| `width`, `height` | Its size in world units |
| `cells` | The boxes, as parts of the sheet. The number of a box is its place in the list. Keep the list from one render to the next |
| `look` | `(index) => SheetLook`: what each box shows, from the game's state. Called for every box whenever the sheet is painted |
| `printed` | `(g, { width, height })`: what is printed on the paper under the boxes, drawn on the canvas the sheet is painted on, whenever it is painted, so it may write what the state says, a total |
| `halo` | The numbers of the boxes that can be chosen now: each is ringed, and only those can be pressed. Without it nothing is ringed and every box can be pressed that has a handler |
| `onCell` | Pressing a box does this, with its number. Without it, or while `disabled`, the sheet only shows |
| `onHover` | The pointer comes onto a box that can be pressed, with its number, and leaves it (null) |
| `paper`, `ink`, `accent` | The colour of the paper, of the ink, and of the ring and the tint of a choice |
| `font` | The CSS font of the writing, `TABLE_FONT` by default |
| `disabled` | Nobody can press a box now (it is not the player's turn): nothing is ringed or tinted |

What a box shows is a `SheetLook`:

| Field | Role |
| --- | --- |
| `text` | What is written in the box: a score, a number. The letters shrink until they fit |
| `mark` | A `tick`, a `cross` or a `circle` drawn over the box |
| `color` | The colour of the writing and of the mark (the ink by default) |
| `faint` | The writing is a suggestion, in faint ink: what the box would take |
| `fill` | The colour of the box's own background |
| `hidden` | The box is not drawn at all, its border included: a place in the list that the paper has no box for |

### The boxes

A box is a `SheetCell`: `{ x, y, width, height }`, as parts of the sheet from 0 to 1 across and down, its origin at the top left, the places of the points of a [`Sketch`](21-drawing.md).

| Helper | What it does |
| --- | --- |
| `gridCells({ columns, rows, x?, y?, width?, height?, gapX?, gapY? })` | The cells of a grid (a `SheetGridOptions`), row by row from the top left, so that the cell at column `col` and row `row` is `row * columns + col`, in the rectangle it is given, which is the whole sheet by default, with the room between the cells that it is told. A column of scores is a grid of one column | 
| `cellAt(cells, u, v)` | The number of the first cell that holds a place of the sheet, or -1: what a press is turned into |

A sheet of another shape lists its boxes: the three streets of Welcome To, each with its own number of houses, are three rows of `gridCells`, put end to end in one list, and the number of a house is its place in it.

- Pressing a box that can be chosen calls `onCell`; pressing the paper between the boxes does nothing and the press goes on to what lies behind. Under the pointer a box that can be chosen is tinted, and the cursor is a pointer.
- The picture is painted on a canvas, 140 pixels for each unit of the table and never more than 2,048 across, and laid on the table with a soft shadow like the rest of the board. It is painted again at the next frame after anything it shows changed, and again when the font of the writing has loaded. It is unlit and not tone mapped, so the colours are the ones painted ([Rules of the board](25-rules-of-the-board.md)).
- The sheet keeps no state: a box holds what `look` says, and a press is only said to the board. Nothing moves by itself, so a visitor who asks for less motion sees no difference.
- A sheet for each seat is a `Sheet` with an `at` and a `yaw` of its own, which `seats` and `inFrame` give ([Seats](03-seats.md)).

### Settings

`SHEET_SETTINGS` is read by every sheet when it paints: how round the corners of a box are (`radius`), how thick its border is and how opaque (`border`, `borderOpacity`), how thick the ring of a box that can be chosen is and how much of the box it tints (`haloWidth`, `haloTint`), how much the pointer tints (`hoverTint`), how big the writing is and how opaque a suggestion (`textSize`, `faint`), and how thick and how big a mark is (`markWidth`, `markSize`). `SHEET_FIELDS` lists the knobs of the Sheet folder of the debug panel ([Tuning](../04-build-a-game/07-tuning.md)).

### Not built

- Writing in a box with the keyboard: a box that takes text is a [`TextField`](11-text-field.md) that the game puts at its place, and the sheet shows what was chosen. Choosing a box with the keyboard is a control beside the sheet, as the specimen has.
- A die or a card dropped on a box: a box takes a press. A drop on its place is a `DropZone` with the shape of the box ([Dragging](19-dragging.md)), which the sheet does not make for its cells.
- A ring that pulses, a strike across a row, a bracket that joins boxes, a fill of any shape: the ring is steady, and the rest is what the game draws in `printed`.
- A sheet too big for the table to be read, which is zoomed into: the sheet is a plane, as big as the game makes it.
