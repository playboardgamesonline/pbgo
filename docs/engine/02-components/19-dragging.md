# Dragging

A player picks a card or a piece up with the pointer and lets it go on a zone of the table or on a cell of a board: another way to say what a click says, "this one, there". On the table a thing that can be dragged is a `Card` or a `Piece` with `draggable`, and a place it can be let go on is a `DropZone` or a cell of a `Board`. The engine has nothing to add: a drop is an action like any other, and the engine decides whether it is legal. The table's side is `packages/table/src/drag/`.

Pick a card up: the zones it may go on light up, and the one under the pointer lights fully. Let it go on one and it flies from where it was let go into its place there; let it go on nothing and it goes back, or lies where it is when the switch says so. Two of the cards cannot be played, only discarded: hold one of them and the Play zone stays dark. Press a card and then a zone for the same move with a click.

```specimen
scene-drag
```

A pawn is dragged the same way: pick it up on either board and the cells it can reach take a ring; let it go on one and it is carried there, with no walk across the cells, since nobody walked it. Pressing it still works as it did.

```specimen
scene-grid
```

## The parts of a drag

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Thing | What is picked up: a card, a piece, a pawn on a track | `Card`, `Piece` or `TrackMarker` with `draggable`, or `useDrag` for anything else a game draws |
| Zone | A place a thing can be let go on, a shape on the table | A `DropZone`, or the cells of a `Board` that has `drops` |
| Shape | Where a zone lies: a circle, a rectangle that may be turned and rounded, a polygon, the corners of a cell | `circleShape`, `rectShape`, `polygonShape`, `cellShape` |
| Legal drops | The zones a thing may be let go on, now | The view, from the engine's rules; the thing's `dropOn` |
| Drop | Where the thing was let go: which zone, and where | `onDrop`, called with a `Drop` |
| Action | What the game posts for it | The same action as for a click |

## In the engine

The kit has nothing to add. A drop is an intent, and the engine, as always, refuses what is not legal.

- Name the zones in the vocabulary of the state, ids and numbers: a card goes to `"play"`, a pawn to the number of a cell. The board gives those names to its zones and to what a drop reports, so the action says the same thing whether it came from a drag or from a click.
- Check the target in `apply` with the tools that exist: `cleanChoice` for one of a few zones, `reachable` or `shortestPath` for a cell ([Bets and choices](12-bets-and-choices.md), [Boards](16-boards.md)). A drop on a zone that is not legal is an `EngineError` like any other: what the board sends is a proposal.
- Put the legal drops in the view, so that the board can tell each thing the zones it may go on (`dropOn`) and light them: a list of zones for each card of the hand, a list of cells for each piece. The view also decides who may drag what: the cards of another player, or any card when it is not the viewer's turn, are not `draggable`.
- A thing that lies where it is let go, a card put anywhere on the table, is an action with numbers: clean them with `cleanNumber` and keep them in the state as numbers ([Lean state](../01-the-game/09-state.md#lean-state)).
- A drag is not open to everyone, so a click must lead to the same action: pick the thing with a click, then press the zone or the cell. A `DropZone` takes an `onClick` for it, and lights as if something were held when it is `ready`.

```ts
// A card goes to the play zone or to the discard, and only to one its rules allow
apply: (state, action) => {
  if (action.type === "play") {
    const card = cleanChoice(action.card, state.hands[state.turn])
    const zone = cleanChoice(action.zone, legalZones(state, card))
    // ...move the card, then the next step
  }
  throw new EngineError("INVALID_ACTION")
},

// What the view tells the board: the cards of the viewer's hand, and the zones each one may go on
view: (state, viewer) => ({
  hand: state.hands[seatOf(state, viewer)],
  drops: state.hands[seatOf(state, viewer)].map((card) => legalZones(state, card)),
})
```

## On the table

### Dragging a card or a piece

`Card` and `Piece` take these props, and so does a `TrackMarker`, which is a `Piece`:

| Prop | Role |
| --- | --- |
| `draggable` | The player can pick it up (default false). A press that stays near where it went down is still a click |
| `dropOn` | The zones it may be let go on: the `id` of a `DropZone`, the number of a cell of a `Board` that has `drops`. Those zones show themselves while it is held, and it is never over another. Default: any zone |
| `onDragStart` | It was picked up |
| `onDrop` | It was let go, with a `Drop`: `target` is the zone it was let go on, among the ones it may go on, or `null` for none, and `position` is where it lay, x and z on the table |
| `onDragCancel` | The drag was given up, with Escape, or because the pointer left the page, or because the thing can no longer be moved (`draggable` turned false): nothing is dropped |

How a drag goes:

- A press that goes farther than `threshold` of `DRAG_SETTINGS` from where it went down picks the thing up; one that does not is a click. The `onClick` of a thing that was dragged is not called for the press that ended the drag.
- A held thing is lifted above its place and follows the pointer, keeping the point it was taken by under it; a card grows a little. It follows a little behind, as everything on the table moves, and exactly with the pointer for a visitor who asks for less motion.
- The thing is over a zone when the pointer is, not when its middle is: the pointer's place is the point of the table under it. When zones lie on one another the smaller one is the one it is over.
- `onDrop` is called once, when the pointer is let go, whether or not there is a zone under it. A game that wants a zone ignores a `null` target, and a game that lets cards lie where they are let go uses `position`. A drop on nothing needs no code to put the thing back.
- A held thing goes back to the place the game gives it (`target` of a card, `at` of a piece), and goes where the game has moved it when the drop did something. The game changes the place in the same step as it posts the action, as for a click.
- A card that changes zone keeps its `id`, so the card that appears in the new zone starts from where the old one was let go and flies from there to its slot ([Poses and motion](05-poses-and-motion.md)). A pawn that is dragged to a cell is set there with no route, so it does not walk back to its old cell to walk the way again.
- Only one thing is held at a time: a second finger is ignored. Escape gives the drag up. A touch that begins on a table with something to drag does not scroll the page.

```tsx
<Card
  id={card}
  target={slot}
  front={face(card)}
  back={cardBack}
  size={SIZE}
  draggable={view.myTurn}
  dropOn={view.drops[i]}
  onDrop={({ target }) => target !== null && post({ type: "play", card, zone: target })}
  onClick={() => pick(card)}
/>
```

### Zones

A `DropZone` is a place a dragged thing can be let go on: invisible until something is held that may go on it, then it shows its line, which pulses, and the one under the pointer shows it in full and lights its inside. It holds nothing: what lies on it, and what the drop does, is the game's. Do not confuse it with the `Zone` that lays cards out: a card zone places cards, a `DropZone` receives a drop, and a game often has both over the same place.

| Prop | Role |
| --- | --- |
| `id` | The name of the zone: what the `dropOn` of a thing lists and what `onDrop` reports. Two zones with one id are one zone with two shapes |
| `shape` | Where it lies, in table coordinates: `circleShape(x, z, radius)`, `rectShape(x, z, width, depth, { yaw, radius })`, `polygonShape(points)`. A zone that is drawn is convex |
| `color` | The colour of its line and of its inside (default `ZONE_COLOR`) |
| `show` | `dragging`, the default, shows it only while something is held that may go on it; `always` shows its line quietly, as the outline of a discard pile does |
| `ready` | Lit as if something that may go on it were held: the zone a thing picked with a click may go on |
| `onClick` | Pressing it does this: the click that leads to what a drop leads to |

- A zone is in table coordinates, so it goes outside any group that moves or turns. `cellShape(cell)` makes the shape of a cell of a board from the cell that `squareCells` and `hexCells` made.
- A zone that nothing draws is `useDropZones`, which puts shapes on the table for as long as the component is there: the spaces of a `Track`, or the seats of a ring.
- A `Board` takes `drops`, the numbers of the cells that things can be let go on. Each is a zone named by its number, so the `dropOn` of a piece lists numbers. While a piece is held that may go on them a ring pulses on each, and the cell it is over takes the ring of the pointer, in the colour of `haloColor`.
- `useDragState` says what the drag of the table is now, which zones it may go on and which it is over, for a game that draws something of its own for it.

### Anything else a game draws

`useDrag` is what `Card` and `Piece` are made with, for a thing of the game's own. It is called inside the `Table`, takes where the thing is (`position`), the height it rests at (`level`), the zones it may go on and the callbacks, and gives `bind`, the two handlers to put on the group of the thing, and `held`, a ref that a frame reads: where the thing is drawn while it is held, `null` otherwise. The hook moves nothing: the owner draws the thing at `held` while there is one (`dragGoal` makes the pose, lifted) and at its place the rest of the time.

```tsx
const drag = useDrag({ level: 0, position: () => group.current?.position ?? null, dropOn: ["tray"], onDrop })
useFrame(() => {
  const held = drag.held.current
  // Under the pointer while it is held, at its place otherwise
  group.current?.position.set(held?.x ?? place.x, held ? DRAG_SETTINGS.lift : 0, held?.z ?? place.z)
})
return <group ref={group} {...drag.bind}>{/* the thing */}</group>
```

### Settings

`DRAG_SETTINGS` is read on every frame by every drag and every zone: how far the pointer goes before a press is a drag, how high a held thing floats and how fast it follows, how much a card grows, the farthest a drag goes from the middle of the table, and the line, glow, pulse and inside of a zone. The debug panel has a Drag folder for it ([Tuning](../04-build-a-game/07-tuning.md)).

### Not built

- Dice, cups and bags that are dragged: a die is thrown by physics, a cup and a bag take poses of their own, and a token that comes out of a bag is a piece that is let go by the game ([Bags](18-bags.md)).
- A zone that is not convex drawn as it is: the drag finds the point in any polygon, but the line and the inside are drawn for a convex one.
- A drop beside a zone, in the gap between two cells: it is on none. A board with a gap between its cells has the gap for no zone.
- A thing that stays where it was let go until the server has answered: it goes back at once, so a game that waits for the answer shows its own pending state, or moves the thing before it posts.
- Dragging a card into a hand to put it between two others: a hand is a layout, and a place between two cards is not a zone.
- Dragging with the keyboard: the click that picks and the click that sends are the way that always works, and a game must give it.
