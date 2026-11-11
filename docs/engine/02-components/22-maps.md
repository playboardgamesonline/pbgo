# Maps

A map is places joined by roads: the cities and the routes of Ticket to Ride, the cities of Pandemic and the links between them, the territories of Risk and their borders. The corners of a board are a map too: on the island of Catan a settlement stands on a point where hexagons meet and a road runs along a side, and on a board of Go a stone stands on a point where squares meet. In the engine a map is a `graph`, numbered places and numbered roads, and the corners of a board are a `cornerGraph`. On the table it is a `RoadMap`, which draws the roads that belong to somebody and offers the places and the roads that can be chosen; the pieces that stand on it are the game's.

Pick a player and what to build, then press a ring or a strip on the island. A settlement goes on a point with no settlement next to it, a road on a side that leaves a place or a road of the player's, and the longest road is the kit's `longestTrail`, which another player's settlement cuts. The button under the scene builds at the first place that is allowed, which is the way to it with the keyboard.

```specimen
scene-road-map
```

## The parts of a map

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Place | A point of the map: a city, a territory, a corner of a board where a settlement stands | The engine: a number from 0 |
| Road | What joins two places: a route, a border, a side of a board | The engine: a number from 0, and the two places it joins |
| Graph | All the places and all the roads, and who is next to whom | The kit: `graph(size, edges)` for a map of the game's own, `cornerGraph(board)` for the corners of a board |
| Position | Where each place lies on the table | The board's: `hexPoints`, `squarePoints`; the game's own for a map it draws |
| Map | The places and the roads drawn, and what can be chosen | `RoadMap` |
| Piece | What stands on a place or lies along a road: a settlement, a train, a pawn | `Piece`, at a place, or along a road with `edgePlace` |

## In the engine

| Export | What it does | Errors |
| --- | --- | --- |
| `graph(size, edges)` | A graph of `size` places joined by `edges`, each the two places a road joins. Two places may have several roads between them, each with a number of its own | `RangeError` for a size that is not a whole number, a road to a place the graph does not have, or a road from a place to itself |
| `Graph`, `Edge` | What `graph` makes: `size`, `edges` (an `Edge` is the two places of a road), `neighbours(place)`, `edgesAt(place)` (the roads that leave it), `edgeBetween(a, b)` (the road, or -1) and `edgesBetween(a, b)` (all of them: two for a double route) | `RangeError` for a place the graph does not have |
| `Network` | What a search needs of a board: `size` and `neighbours`. A `Board`, a `Graph` and the `Corners` of a board are all networks, so `reachable`, `shortestPath` and `regionOf` of the [boards](16-boards.md) go along the roads of a map as they go from cell to cell | |
| `cornerGraph(board)` | The corners of a square or hexagonal board as a graph: its points are the places where the cells meet and its sides are the roads. The island of Catan, 19 hexagons, has 54 points and 72 sides | |
| `Corners` | A `Graph` that also says `cellsAt(point)` (the cells that meet there, one to three on a hexagonal board and one to four on a square one), `pointsOf(cell)` and `sidesOf(cell)` (the corners and the sides of a cell, in order round it), `cellsOfSide(side)` (the cells on its two sides) and `place(point)` (where it is on the plane) | `RangeError` for a cell, a point or a side the board does not have |
| `longestTrail(graph, roads, rules?)` | The most that a trail along those roads is worth: a trail goes from place to place along roads, uses a road once and may come back to a place. The longest road of Catan, the longest route of Ticket to Ride | `RangeError` for a road the graph does not have, and for a worth that is not a number of zero or more |
| `TrailRules` | `blocked(place)`, the places a trail may not go through, though it may start or end at one (another player's settlement), and `weight(road)`, what a road is worth (1 for each by default: the trains of a route are its worth) | |

- The state keeps numbers and nothing else: who has a settlement on each place and who owns each road, as arrays indexed by the number of the place and of the road, so an order never comes from the keys of an object ([Lean state](../01-the-game/09-state.md#lean-state)). The graph itself is data of the game that never changes, made once at the top of a file.
- The rules of the island are looks at the graph. A settlement is never next to another: `corners.neighbours(point).every((next) => state.settlements[next] === null)`. A road leaves a place of the player's or goes on from one of their roads: `corners.edgesAt(point)`. The tiles that give a settlement their resource when their number is rolled are `corners.cellsAt(point)`. A tile that has a settlement is a look at `corners.pointsOf(cell)`.
- The longest road is `longestTrail(corners, roadsOf(player), { blocked: (point) => state.settlements[point] === other })`. The search tries every trail, which takes no time for the roads of one player in a game, some dozens, and long for a hundred that cross one another.
- A square board gives the points where the stones of Go stand: the 361 points of a board of 19 lines are the corners of a board of 18 by 18 squares, `cornerGraph(squareBoard({ columns: 18, rows: 18 }))`, and `regionOf` finds a group of stones along its roads.
- A map of the game's own is `graph(cities, routes)`, the routes being the pairs of the cities they join. Where the cities lie, and the picture under them, are the board's, not the engine's.
- A place or a road that a player names goes through `cleanChoice` first, with the ones that are allowed as its options, or through `cleanNumber` before the rules say whether it is allowed ([Bets and choices](12-bets-and-choices.md)).

```ts
const BOARD = hexBoard({ radius: 2 })
const CORNERS = cornerGraph(BOARD)

function settle(state: State, player: number, point: number): State {
  // The point is one of the board's, and free
  if (!Number.isInteger(point) || point < 0 || point >= CORNERS.size || state.settlements[point] !== null) throw new EngineError("INVALID_TARGET")
  // A settlement is never next to another
  if (CORNERS.neighbours(point).some((next) => state.settlements[next] !== null)) throw new EngineError("TOO_CLOSE")
  return { ...state, settlements: state.settlements.map((owner, at) => (at === point ? player : owner)) }
}
```

## On the table

### The map

```tsx
const points = useMemo(() => hexPoints(BOARD.coords, { size: 1.55 }), [])

<RoadMap
  places={points}
  roads={CORNERS.edges}
  placeLook={() => ({ hidden: true })}
  roadLook={(side) => (view.roads[side] === null ? { hidden: true } : { color: PLAYER_COLORS[view.roads[side]] })}
  halo={{ places: view.canSettle, roads: view.canRoad }}
  onPlace={(point) => send({ type: "settle", point })}
  onRoad={(side) => send({ type: "road", side })}
/>
```

The props are `RoadMapProps`:

| Prop | Role |
| --- | --- |
| `places` | Where each place lies on the table, `{ x, z }` for each. Keep the list from one render to the next |
| `roads` | The roads, each the two places it joins by their number: the `edges` of the graph |
| `placeLook` | `(index) => PlaceLook`, `{ color?, label?, ink?, hidden? }`: what each place shows, the colour of its disc, a label written on it, and `hidden` for a place that is drawn only while it can be chosen or is under the pointer |
| `roadLook` | `(index) => RoadLook`, `{ color?, hidden? }`: what each road shows. A road with a colour belongs to somebody and is drawn in it, wider; a road with none is a faint line; a `hidden` road is drawn only while it can be chosen |
| `halo` | `{ places?, roads? }`, the numbers of the places and the roads that can be chosen now: a ring pulses on each place and a strip on each road, and only those can be pressed. Without it nothing pulses and everything that has a handler can be pressed |
| `onPlace`, `onRoad` | Pressing a place, or a road, does this, with its number |
| `onHover` | The pointer comes onto a place or a road that can be pressed, and leaves it: a `RoadMapTarget`, `{ kind, index }`, or null |
| `color`, `ink`, `haloColor` | The colour of the places and of the roads that give none, of the labels, and of the rings and the strips |
| `placeSize`, `roadWidth` | The diameter of a place and the width of a road in world units, the settings' by default |

- A place that can be pressed has a disc to press that is larger than its ring, and a road one that is wider than its line, so that a thin road is easy to press. Under the pointer a ring or a strip is full, and the cursor is a pointer.
- The map draws no piece. A settlement is a `Piece` that stands at `points[point]`. A road of a piece lies along its side, long along its own x: `edgePlace(a, b)` gives the middle of the road, the `yaw` that turns it along it and its length, and `makeFlatPiece` makes a long flat piece from a rectangle ([Pieces](13-pieces.md)).
- The rings and the strips pulse through one material, so a map of any size costs a few meshes for each place and each road and no more per frame. A visitor who asks for less motion sees them lit and still.

### The places of a board

| Helper | What it does |
| --- | --- |
| `hexPoints(coords, { size, at? })` | The place on the table of each point of the kit's `cornerGraph` of a hexagonal board, in its order: the corners of the hexagons of `coords` where they meet, at the `size` and `at` that `hexCells` makes the cells with |
| `squarePoints(coords, { size, at? })` | The same for a board of squares: the corners of the squares where they meet |
| `edgePlace(from, to)` | `{ x, z, yaw, length }`: the middle of a road between two places, the `yaw` that lays a piece that is long along its own x along it, and the length |

A test holds the numbering of the points to the engine's: the table reads the kit's graph and checks that every side is the length of a side, that every distance is the same, and that the corners of a cell are those of the cells it draws.

### Settings

`ROAD_MAP_SETTINGS` is read by every map: how wide a road is (`roadWidth`) and how much wider when it is owned (`ownedGrow`), how big a place is (`placeSize`), how much room a road leaves to the pointer (`hitGrow`, `minHit`), how far its ring stands and how wide it is (`ringGrow`, `ringWidth`), how fast it pulses (`pulseSpeed`) and how opaque a road with no owner, and a ring at its dimmest and at its brightest, are (`faint`, `haloLow`, `haloHigh`). `ROAD_MAP_FIELDS` lists the knobs of the Road map folder of the debug panel ([Tuning](../04-build-a-game/07-tuning.md)).

### Not built

- The art of a map, a world or a city plan, and territories drawn as areas: the picture under the places is a plane that the game draws on the table ([Surface](01-table.md#surface)), the places lie on it where the game puts them, and an area is the game's polygon. A zone for the drag can have the shape of a territory ([Dragging](19-dragging.md)).
- A road that bends, or whose length is drawn as spaces (the trains of a route): a road is a straight line between two places, and the trains are pieces the game lays along it.
- Two roads between the same two places drawn side by side: the double routes have a number each and are drawn on one another, until a road can be offset.
- A way for a keyboard to choose a place or a road on the map itself: a board gives the choice beside it, as the specimen does, with a button or a list.
