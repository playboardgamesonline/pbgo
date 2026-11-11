# Boards

A board is a set of cells that touch one another, laid out in a regular grid: the squares of a chessboard, the hexagons of a map. The state keeps where things are as the number of a cell, and nothing else. The engine asks its board who is next to a cell, how far two cells are, which cells a piece can reach, the way from one cell to another, and which cells are linked together; it works the rest out from its own state. The table draws the cells with a `Board`, whose cells can be pressed, and the pieces stand on them. The table's side is `packages/table/src/board/`, the engine's is `board.ts` of the kit.

Press a pawn: the cells it can reach in four steps, going round the walls, take a ring. Press a ringed cell and the pawn walks there across the cells. Or pick the pawn up and let it go on one of them: it is carried there, and the cells that are not ringed refuse it. Let the squares touch by their corners and the rings change.

```specimen
scene-grid
```

## The parts of a board

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Grid | How the cells touch: squares, by their sides and by their corners when the game says so, or hexagons with a point up, six to a cell | `squareBoard`, `hexBoard` of the kit |
| Cell | A place of the board, named by a whole number from 0 in the order of the board | The state holds the number; `coords[number]` gives the two numbers that place it |
| Plate | The cell as it is drawn: its shape, its colour, a label, a ring | `Board`, and its `look` |
| Piece | What stands on a cell, and walks across the cells | A `Piece` at `cells[i]`, or a `TrackMarker` |
| Rules | What may not be entered: a piece in the way, a wall | `blocked` of the searches |

## In the engine

The state holds the number of a cell where a piece stands, and nothing else: no coordinates, no name ([Lean state](../01-the-game/09-state.md#lean-state)). A board has no state of its own, so a game makes it once, at the top of its file, and asks it what it needs. A `Board` has `size` (how many cells), `coords` (the two numbers that place each cell: `[col, row]` on a square board, `[q, r]` on a hexagonal one), `directions` (how many ways a step can go), `at(a, b)` (the cell at two numbers, or -1), `step(cell, direction)` (the cell one step away, or -1 at the edge), `neighbours(cell)` and `distance(from, to)`.

| Export | What it does | Errors |
| --- | --- | --- |
| `squareBoard({ columns, rows, diagonals? })` (a `SquareBoardOptions`) | A board of squares numbered row by row from the top left, so the cell at column `col` and row `row` is `row * columns + col`. With `diagonals` the squares that touch by a corner are next to one another too and a step can go on a diagonal | `RangeError` for a board with no cell |
| `hexBoard({ radius })`, `hexBoard({ columns, rows })` (a `HexBoardOptions`) | A hexagon of hexagons round a middle cell (the radius 2 has 19 cells), or a rectangle whose odd rows are shifted half a cell to the right, numbered like a square board. Axial coordinates `[q, r]` | `RangeError` for a radius or a size that is not a whole number of cells |
| `reachable(board, from, range, { blocked? })` | The cells that can be reached in `range` steps at the most, never into a blocked cell, each with its distance (a `Reached`: `{ cell, distance }`), nearest first, the start included | `RangeError` for a start that is not a cell and a range that is not a number of steps |
| `shortestPath(board, from, to, { blocked? })` | The way from one cell to another by the fewest steps, ending on the goal; empty when they are the same cell, `null` when there is no way | `RangeError` for cells that are not on the board |
| `regionOf(board, start, same)` | The cells linked to `start` through cells that are `same` as it: a group of stones, a lake | `RangeError` for a start that is not a cell |
| `lineBetween(board, from, to)` | The cells a straight line goes through, after the start, the last being the goal: a line of sight | `RangeError` for cells that are not on the board |
| `rayFrom(board, from, direction, { blocked? })` | The cells a sliding piece sees in one direction (a `Ray`): `open`, until the edge or the first blocked cell, which is `stoppedBy` | `RangeError` for a cell or a direction the board does not have |

```ts
const BOARD = squareBoard({ columns: 8, rows: 8, diagonals: true })

// A rook slides along the sides until something stops it; it may take what it meets, if that is an enemy
const slides = [0, 2, 4, 6].flatMap((direction) => {
  const ray = rayFrom(BOARD, state.piece[id], direction, { blocked: (cell) => occupied(state, cell) })
  return ray.stoppedBy !== null && enemy(state, ray.stoppedBy) ? [...ray.open, ray.stoppedBy] : ray.open
})

// A unit that walks: the cells it can reach are the options of the player's choice, and the log says the way
const blocked = (cell: number) => occupied(state, cell)
const options = reachable(BOARD, state.unit[id], MOVES, { blocked }).map((reached) => reached.cell)
const to = cleanChoice(action.to, options)
events.push({ type: "walked", unit: id, from: state.unit[id], to, path: shortestPath(BOARD, state.unit[id], to, { blocked }) })
```

- The corners and the sides of a board, where the settlements and the roads of Catan stand and the stones of Go, are another graph, `cornerGraph(board)` ([Maps](22-maps.md)): the same searches go along it.
- The searches take the same rules, `BoardRules`: `blocked`, the cells that cannot be entered. A cell has two numbers, a `Coord`: `[col, row]` on a square board and `[q, r]` on a hexagonal one.
- The cells are numbered row by row from the top, the first row being the farthest from the viewer, so a number means the same cell for the engine and for the table: the table makes its cells from the same `coords`.
- The steps go clockwise seen from above, from the right: east, south, west, north for squares (and east, south-east, south and so on with `diagonals`, where an even direction is a side and an odd one a corner), and east, south-east, south-west, west, north-west, north-east for hexagons.
- The searches go through the cells in the order of the directions and of the numbers, so the same board gives the same answer on every machine and a `shortestPath` is the same way each time: it is what a piece walks along, and the game puts it in its event for the board.
- A cell that a player names goes through `cleanChoice` first, with the cells `reachable` gives as its options, or through `cleanNumber` before `reachable` says whether the move is legal ([Bets and choices](12-bets-and-choices.md)). The helpers throw for what only a bug can send them.
- `blocked` is the game's: a cell with a piece on it, a wall, a cell the player's pieces cannot enter. The cell a search starts from is never refused, since the piece that is searching stands on it.

## On the table

### Placing the cells

`squareCells(coords, options)` and `hexCells(coords, options)` turn the `coords` of the engine's board (each a `Coord`, which the table package exports too) into the cells of the table, one for each, in the same order: the number of a cell is its place in the list. A `BoardCell` has `x`, `z` and a `yaw` of 0 like a space of a [track](15-tracks.md), and `corners`, the corners of its shape round its middle, clockwise seen from above. A piece stands on it with `at={cells[i]}`.

The options are `PlaceOptions`:

| Option | Role |
| --- | --- |
| `size` | The distance between the middles of two neighbouring cells, in world units |
| `gap` | The room left between two cells (default 0): each cell is drawn smaller by it, the way the lines of a board are |
| `at` | Where the middle of the board lies on the table (default the middle of the table): the board is centred on it |

A column goes toward the right and a row toward the viewer, so the first row is the farthest; hexagons have a point up and each row lies half a cell from the one before. Only the cells in `coords` are made, so a board with holes, or one that grows as tiles are laid, is a list that changes (and a list that grows at its end keeps the numbers it had).

### Board

`packages/table/src/board/board.tsx`. The props are `BoardProps`:

| Prop | Role |
| --- | --- |
| `cells` | The cells, from `squareCells` or `hexCells`. Keep the list from one render to the next, or compute it in `useMemo`; a list made anew with the same cells costs a comparison and no painting |
| `look` | `(index) => CellLook`, `{ color?, label?, ink? }`: what each cell shows, its colour (the two colours of a chessboard, the owner of a territory, the cell that was just played), the label written in its middle and the colour of its ink. It comes from the game's state and the visitor's language |
| `color`, `ink` | The colour of the cells and of the ink of the labels that give none |
| `halo`, `haloColor` | The numbers of the cells that can be chosen, which a ring pulses on, and the colour of the ring |
| `drops`, `dropId` | The numbers of the cells that pieces can be let go on: each is a zone, named by its number or by what `dropId` makes of it, so the `dropOn` of a piece lists numbers. While a piece is held that may go on them a ring pulses on each, and the cell it is over takes the ring of the pointer. A table with more than one board gives each its own `dropId`, such as `${seat}:${cell}`, so that a cell of one is never taken for a cell of another ([Dragging](19-dragging.md#zones)) |
| `onCell` | Pressing a cell does this, with its number. The cell under the pointer takes a ring. Without it the cells only show |
| `onHover` | The pointer comes onto a cell, with its number, and leaves it, with `null` |
| `font` | The CSS font of the labels, `TABLE_FONT` by default |

```tsx
const cells = useMemo(() => squareCells(BOARD.coords, { size: 1.1, gap: 0.04 }), [])

<Board
  cells={cells}
  look={(cell) => ({ color: (BOARD.coords[cell][0] + BOARD.coords[cell][1]) % 2 === 0 ? light : dark })}
  halo={view.legal}
  onCell={(cell) => post({ type: "move", to: cell })}
/>
{view.pieces.map((piece) => (
  <TrackMarker key={piece.id} id={piece.id} spaces={cells} space={piece.cell} direct route={piece.path} model="pawn" color={seatColour(piece.owner)} />
))}
```

- The cells are one mesh whatever their number, and their colours are those of its vertices, so a board that changes colour at every move paints nothing again. The labels are one picture, painted again only when a label changes; the rings are drawn over the cells.
- A piece that only has to be somewhere is a `Piece` at `cells[i]`: it glides there, and flies when the cell is far. A piece that walks across the cells it crosses is a `TrackMarker` with the cells as its `spaces`, `direct` so that it does not walk through the cells between in the order of their numbers, and the way as its `route`: the `shortestPath` the engine put in its event, with the cell the piece leaves left out ([Tracks](15-tracks.md#trackmarker)).
- The plates lie just over the surface of the table and under the shadows of the pieces, so a piece stands on them and casts its shadow on them.

### Not built

- A board whose cells are not plates: the intersections of lines (Go), or the corners and edges of the hexagons where roads and houses go (Catan). A `Board` draws a plate for each cell; a game draws lines or roads with a plane of its own on the table ([Surface](01-table.md#surface)), and `Piece`s stand on the points the game works out.
- A map of places and roads (Ticket to Ride, Pandemic) and territories of any shape (Risk): a board here is a regular grid, and the places and roads of a map are the game's own data.
- Hexagons with a flat top, and a grid that wraps round its edges.
- A cell that costs more to enter than another: the searches count steps.
