# Tiles

A tile has something on each side, and it is laid next to the others where the sides go together: a road goes on with a road and a city with a city (Carcassonne), a number with the same number (dominoes). It is laid in one of its turns, so the same tile may be laid in four ways. The state keeps the tiles that are laid, each as the cell it lies on, which tile it is and how many times it was turned, and nothing else: the edges, the free cells, where a tile fits and the roads and cities of the whole layout are worked out from it. On the table a tile is a `Piece` with its picture on top, turned by `tileYaw`, and the cells where it may go are a `Board` made from the free cells.

Press the tile to turn it and press a ringed cell to lay it: a tile fits where every side that touches a tile matches it, and the ring shows where, as the tile is turned. A faint copy of the tile shows where the pointer is. A tile that fits nowhere goes back in the box. A road or a city that nothing more can be added to is closed, and the tiles it is made of wear a ring; each tile of a road is worth a point and each tile of a city two. The table has an end, seven tiles across and five down, so the camera keeps it all in view. The buttons are the keyboard's way: one turns the tile, one lays it on the first cell where it fits.

```specimen
scene-tiles
```

## The parts of a layout of tiles

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Tile | A thing with an edge on each side and a picture | The game's table of tiles: its edges, and its segments for roads and cities |
| Laid tile | The cell a tile lies on, which tile it is and how many times it was turned | The state: a `LaidTile` |
| Edge | What a tile shows on one side: a road, a city, a number. It must match the side it touches | The game: any value |
| Turn | A quarter turn clockwise on squares, a sixth on hexagons | The state: `turns` of a `LaidTile` |
| Free cell | A cell with no tile that touches one | The kit: `spots()` of a `tiling` |
| Placement | A free cell and a turn where a tile fits | The kit: `placements()` of a `tiling` |
| Segment | A part of a tile that goes from side to side: a road, a city, a field | The game's table of tiles: a `Segment` |
| Feature | The segments that are joined from tile to tile: a whole road, a whole city, and how many of its sides are still open | The kit: `features` |
| Tile on the table | The picture, turned and laid on its cell | `Piece`, `tileYaw`, the cells of `squareCells` or `hexCells` |

## In the engine

| Export | What it does | Errors |
| --- | --- | --- |
| `Lattice` | The grid tiles are laid on, `"square"` or `"hex"`. Its cells have two numbers like those of a board and no end: a layout is as big as the tiles laid on it | |
| `sidesOf(lattice)` | How many sides a tile has: 4 on squares, 6 on hexagons | `RangeError` for another grid |
| `neighbourOf(lattice, at, side)` | The cell across a side. The sides are numbered as the directions of a board: east first and clockwise, so east, south, west, north on squares | `RangeError` for a side the tile does not have, or a cell that is not two whole numbers |
| `oppositeSide(lattice, side)` | The side that touches this one on the tile across: half the sides further round | `RangeError` for a side the tile does not have |
| `around(lattice, at)` | The cells that touch a cell, the corners of a square included, so eight on squares and six on hexagons: where a monastery of Carcassonne wants every cell laid | |
| `squareEdges({ north, east, south, west })`, `hexEdges({ east, southEast, southWest, west, northWest, northEast })` | The edges of a tile given by the side they are on, in the order of the sides. A tile drawn with its north up has its north on top | |
| `turnEdges(edges, turns)` | The edges once the tile has been turned `turns` times clockwise: the edge of side `s` is on side `s + turns` now. A negative number turns the other way, and a number of any size goes round | `RangeError` for turns that are not a whole number or a tile with no side |
| `distinctTurns(edges)` | The turns, from 0, that show the tile in a way it was not shown before: one for a tile the same on every side, two for a straight road, four for a corner. The turns to offer a player | |
| `LaidTile` | A tile that has been laid: `at` (the two numbers of its cell), `tile` (the game's id for it) and `turns`. It is what the state keeps | |
| `tiling(lattice, laid, edgesOf)` | The tiles that are laid, seen as a whole: made from the state at every move and never stored. `edgesOf` gives the edges of each tile as it is drawn | `RangeError` for two tiles on one cell, edges that are not as many as the sides, or a cell that is not two whole numbers |
| `Tiling` | What `tiling` makes: `at(cell)` (the place in `laid` of the tile there, or -1), `edge(cell, side)` (what the tile shows on a side, turned as it was laid), `spots()`, `fits(cell, edges, rules?)`, `placements(edges, rules?)` and `bounds()` (the least and the greatest column and row, or `null`) | |
| `spots()` | The free cells that touch a tile, in the order the tiles were laid and the sides went round. With no tile there is one, `[0, 0]`, where the first tile goes | |
| `fits(cell, edges, rules?)` | Whether a tile that shows these edges, as it lies, may be laid on the cell: it is free and allowed, it touches a tile (or is the first), and each side that touches a tile matches | `RangeError` for edges that are not as many as the sides |
| `placements(edges, rules?)` | Every way a tile with these edges, as it is drawn, may be laid: each free cell where it fits with each turn that shows it differently, in the order of the cells and then of the turns | |
| `TileRules` | `matches(laid, against)`, whether two edges that touch go together (equal by default), and `allowed(cell)`, the cells a tile may be laid on (any by default): a table that has an end, a kingdom that may not grow wider than five | |
| `Placement` | A cell and a turn: what `placements` lists | |
| `Segment` | A part of a tile: its `kind` (the game's word for a road, a city, a field) and its `ports`, the places where it touches the sides of its tile, each a side and a slot along it. A segment with no port is alone: a monastery | |
| `features(grid, segmentsOf, { slots })` | The roads, the cities and the fields of a whole layout: each segment joined to the segments of its kind that it touches across a side, and those in turn. `slots` says how many ports a side has, 1 by default and 3 for Carcassonne | `RangeError` for a port that is not on the tile or that two segments hold |
| `Feature` | What `features` lists: `kind`, `parts` (each the tile, as its place in `laid`, and the segment, as its place in the tile's list) and `open`, how many of its sides face a cell with no tile. 0 when nothing more can be added | |
| `segmentProblems(lattice, segments, { slots, complete })` | The mistakes in the segments of one tile, as sentences: a port that is not on the tile, a port that two segments hold, and a port that none holds | |

- The state keeps `{ at, tile, turns }` for each tile, in the order they were laid, and nothing derived ([Lean state](../01-the-game/09-state.md#lean-state)). An order comes from the array, never from the keys of an object, and the free cells and the placements come in a fixed order, so the same state always lists the same places.
- A tile turned once shows on its south what it had on its east, as a `Board` goes round: clockwise, seen from above, from the east. A tile is drawn with its north up, so the edge that is on top in the picture is the last of its edges.
- The first tile goes on `[0, 0]`. The layout has no end, so a game that has one, or a kingdom of five by five, says where tiles may go with `allowed`, which is given the cell and may read the `bounds()` of the layout.
- A player names a place, and the engine checks it: the cell must be among the `spots` and `fits` must say yes for the turn, with a code of the game's own when it does not. Nothing a client sends is trusted for where a tile goes.
- A tile that fits nowhere has `placements` of none. The game decides what happens, and in the specimen it goes back in the box and the next one is drawn.
- The edges are the game's own values, compared with `===`. A game that wants more than equality, a road that also goes with a field, gives `matches`, which is told the edge of the tile that is laid and the one it lies against.
- A road, a city and a field are segments, and the joining is the kit's. A side has `slots` ports counted clockwise round the tile, so on the north the first is on the west and on the east the first is on the north. The slot `k` of a side meets the slot `slots - 1 - k` of the side it touches. A road is on the middle port of a side and a field on each side of it, which is why a field is not joined to the field across a road.
- A feature is closed when `open` is 0. The score of a city is its `parts` counted by tile, `new Set(feature.parts.map((part) => part.tile)).size`, plus whatever the game puts on its tiles; a monastery is a segment with no port, closed when `around` finds every cell laid. A side that touches a tile where nothing joins is not open.
- The table of tiles is written by hand and a port left out joins a road to a field without a word, so test it: `expect(segmentProblems("square", segments, { slots: 3 })).toEqual([])` for every tile, and that the edge of each side agrees with what its ports hold.
- Hexagons work the same way: `tiling("hex", …)` has six sides, and a tile of a `hexBoard` is the same cell. A tile of several cells, a domino or a shape that is flipped, is [not built](../03-not-built-yet.md).

## On the table

### The tiles

```tsx
const spots = squareCells(grid.spots(), { size: 1.5, gap: 0.05, at: { x: -2.2, z: 0.2 }, anchor: [0, 0] })
const cells = squareCells(laid.map((one) => one.at), { size: 1.5, at: { x: -2.2, z: 0.2 }, anchor: [0, 0] })

<Board cells={spots} halo={fitting} onCell={(spot) => lay(spots[spot])} onHover={setHover} />
{laid.map((one, index) => (
  <Piece key={index} id={`tile-${index}`} model="square" size={1.45} faces={{ top: face(one.tile) }} at={{ x: cells[index].x, z: cells[index].z, yaw: tileYaw(one.turns) }} />
))}
<Piece key={`hand-${laid.length}`} id={`tile-${laid.length}`} model="square" size={2} faces={{ top: face(hand) }} at={{ x: 6.4, z: -0.4, yaw: tileYaw(spin) }} onClick={turn} />
```

| Part | Role |
| --- | --- |
| `Piece` with `model="square"` | A tile. `hex` is a tile of hexagons. Its picture goes on `faces.top`, painted with its north up, and it carries its own light |
| `tileYaw(turns, sides?)` | The yaw of a tile turned `turns` times clockwise, as the engine counts: minus a quarter of a circle for a turn on squares, minus a sixth with `sides` at 6. A piece turns counterclockwise seen from above |
| `anchor` of `squareCells` and `hexCells` | The cell that lies on `at`, instead of the middle of all the cells, so that the cells that were there stay where they were when more are laid. Without it a layout that grows slides |
| `Board` over `spots()` | The free cells as plates, ringed where the tile fits (`halo`) and pressed to lay it (`onCell`). The cell under the pointer takes a ring |
| `opacity` of `Piece` | How solid a piece is, from 0 to 1. A tile at 0.55 on the cell under the pointer shows where it would lie, and casts no shadow |
| `children` of `Piece` | What the game draws on the top of the tile: here a ring on the tiles of a closed road or city |
| `id` of `Piece` | A tile that leaves the table and a tile with the same id that appears within a second start from where the first was: the tile in hand has the id its cell will have, so it flies there when it is laid |

- Turn the tile by counting turns that only go up, `spin`, and hand `tileYaw(spin)` to the piece: the piece goes the short way round, so a tile always turns clockwise when it is pressed. The engine is given `spin` modulo the number of sides.
- The turns to offer are `distinctTurns` of its edges: a straight road shows two ways, and a meadow one, so a tile that looks the same turned is not made to turn.
- The camera does not move, so a layout that could grow without end would leave the picture. Give the table an end with `allowed` and frame all of it, or give the game its own way to show the part of the layout that matters.
- A tile may be dragged onto a spot like any piece: `draggable` and `dropOn` of the `Piece`, and `drops` of the `Board` ([Dragging](19-dragging.md)).
- The pictures of the tiles are the game's, from its Sanity project. The specimen paints its own from the tokens of the page, since it has no game.

### Settings

Nothing here is tuned on its own: a tile is a `Piece`, so its glide, its hop and its shadow are the settings of the pieces, and the cells are those of a board ([Pieces](13-pieces.md), [Boards](16-boards.md)).

### Not built

- A tile of several cells: the dominoes of Kingdomino, and the shapes that turn and flip and fill a grid in Patchwork, Cartographers or Ark Nova. A tile here covers one cell.
- A tile that is chosen among the placements by an index. A game that wants it numbers the list of `placements`, which is the same on both sides.
- A camera that follows the layout, and an endless table. The camera is fixed ([Camera](02-camera.md)).
- Fields that are scored by the cities they touch, and the pieces that stand on a feature (the followers of Carcassonne): they are the game's. A feature says which tiles and segments it is made of, and a `Piece` stands on a segment of a tile where the game decides.
