# Pieces

A piece is a thing with a shape, a colour and a place that changes: a token, a coin, a tile, a cube, a pawn, a meeple. The engine keeps where each piece is, as a value of its state (a cell, the reserve of a player, a count); the board draws it with a `Piece`, which stands where the state says, glides when the place changes and flies when it jumps far, the way a card does. The shape and the pictures are the game's, and the same piece serves a worker, a coin and a tile. The table's side is `packages/table/src/piece/`.

Press a piece of the row to pick it up, send the pawn across, turn the tile over and change the count of the stack.

```specimen
scene-pieces
```

## The parts of a piece

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Shape | The solid: how tall it is, how wide a circle it fits in, whether it has two flat faces, and how it is drawn | `pieceModel` gives a disc, a square, a hex, a cube, a sphere and a pawn (`PIECE_SHAPES` lists them and a `PieceShape` is one of them); `makeFlatPiece` makes a flat piece of any silhouette (a meeple, a standee) from its outline; `makePiece` makes a piece from a solid the game modelled |
| Colour | The edge of the piece, and its faces that wear no picture | `color` |
| Pictures | What the top and the bottom of a flat piece show | `faces.top` and `faces.bottom`, textures painted by the game |
| Place | Where it stands, which way it faces, how high, which face is up | `at`, `y`, `lift`, `face` |
| Name | What tells one piece from another across places | `id` |

## In the engine

The kit has no helper for a piece, because a piece has no rule of its own: it is an id and a place in the state, like a card.

- The state keeps where each piece is: a cell, the reserve of a player, the supply. A piece that moves leaves one place and joins another in the same step, and a move that takes a piece from a place it is not in is a bug of the game, which throws a `RangeError` ([Where cards are](07-zones.md#the-places)).
- Pieces that are all the same (coins, gems, cubes of one colour) are a count for each place, not a list of pieces: the board draws the count as a `Stack`. Pieces that differ (workers that each have a place of their own) are a place for each.
- A bag of tokens that are only told apart by their kind is a count for each kind, drawn with `drawFromBag` and the seeded stream, and the board draws the bag with a `Bag` that the pieces come out of ([Bags](18-bags.md)). A bag of pieces that are each their own is a deck of ids ([Decks and piles](06-decks-and-piles.md)), with opaque ids while they are hidden.
- A piece that only some players may see the face of is in the view of the others as hidden, like a card ([Hidden information](../01-the-game/10-views.md#hidden-information)).
- The state names no shape and no colour: a piece's shape and pictures are the game's data, in its Sanity project, and its colour is the colour of its player's seat or of what it is. The view gives the board the id and the place.

## On the table

A `Piece` is shared: `packages/table/src/piece/piece.tsx`. The props are `PieceProps`:

| Prop | Role |
| --- | --- |
| `id` | Names the piece. When a piece with this id leaves the table and one with the same id appears within a second, in another place, the new one starts from where the old one was. A given `from` wins. Needs a `Table` around it |
| `model` | The shape: `disc` by default, another piece of the package, or a `PieceModel` of the game's own |
| `at` | `{ x, z, yaw? }`: where the piece stands and which way it faces. When it changes the piece glides there; when it jumps far, it flies |
| `y` | How high the base of the piece is above the table: the height of what it stands on, to put a piece on another |
| `size` | The width of the piece in world units, the diameter of a disc, `PIECE_SIZE` by default. Its height follows its model |
| `color` | The colour of the piece |
| `faces` | The picture of the top and of the bottom of a flat piece: `{ top, bottom }`, textures in sRGB |
| `face` | Which flat face is up, `top` by default. When it changes the piece hops and turns over |
| `lift` | How high the piece is raised above its place: a piece the player holds, or has picked |
| `halo` | A ring on the table round the piece, in this colour, that pulses: the piece can be chosen |
| `shadow` | Casts a drop shadow (default true) |
| `opacity` | How solid the piece is, from 0 to 1 (default 1): a piece that shows where another would go, as a tile does under the pointer ([Tiles](24-tiles.md)). One that is not solid casts no shadow |
| `from` | Where the piece comes from when it appears: it flies from there to its place |
| `onClick`, `onHover` | Make the piece a click target ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)) |
| `draggable` | The player can pick the piece up with the pointer and let it go on the table: it follows the pointer, lifted, with its shadow growing, and goes back to its `at` when it is let go ([Dragging](19-dragging.md)) |
| `dropOn`, `onDragStart`, `onDrop`, `onDragCancel` | The zones it may be let go on, and what it reports: `onDrop` is called with the zone it was let go on or `null`, and where it lay ([Dragging](19-dragging.md#dragging-a-card-or-a-piece)) |
| `onArrive` | Called when a flight ends |
| `children` | What the game draws on the top of the piece, as three.js elements: their origin is the middle of the top, x to the right and y away from the viewer. They turn over with the piece |

A `Stack` (props: `StackProps`, those of a `Piece` but a few) is `count` pieces of the same kind, one on the other, for a supply of coins or gems:

| Prop | Role |
| --- | --- |
| `id` | Names the stack: its pieces are named after it, so a piece that leaves the stack and appears elsewhere under the same name flies from where it was |
| `count` | How many pieces are in the stack, whole |
| `cap` | The most pieces drawn: a stack of a hundred coins is a tall stack of a few, not a hundred meshes |
| `halo` | A ring round the top piece: the stack can be chosen |
| `model`, `size`, `at`, `color`, `faces`, `face`, `lift`, `shadow`, `onClick`, `onHover` | As on a `Piece`; each piece of the stack is a little askew, the same way every time |

```tsx
const picked = view.picked === worker.id

<Piece
  id={worker.id}
  model="pawn"
  color={seatColour(worker.owner)}
  at={cellPoint(worker.cell)}
  lift={picked ? 0.4 : 0}
  halo={canPick ? ring : null}
  onClick={() => canPick && post({ type: "pick", worker: worker.id })}
/>
<Stack id={`gems-${player.id}`} count={view.gems[player.id]} model="disc" color={gemColour} at={reservePoint(player.id)} />
```

### How a piece moves

- A piece glides to a new place; a place farther than a few widths away sends it flying along the curve of a card's flight, which is tuned by the same settings (`CARD_SETTINGS`), so everything crosses the table the same way.
- A piece whose `face` changes hops and turns over, and stands on the table again: a piece with its bottom up is raised by its height, so it never sinks into the table.
- A piece carries its own light, so it needs none from the table: its top is brighter than its sides, and the faces that turn away are darker as it turns.
- The shadow follows the piece and fades as it rises.

### Models

A flat piece is a silhouette with a thickness: the corners of an outline, seen from above. The top and the bottom are cut into triangles whatever the shape, a concave one included, and each can wear a picture.

```ts
const meeple = makeFlatPiece({ name: "meeple", outline: fitOutline(corners), height: 0.3 })
```

- An outline (`PieceOutline`) is a list of points (`OutlinePoint`, an `[x, y]` pair): the corners of the edge of a flat piece, seen from above and counterclockwise, inside a box one unit wide and high.
- `regularOutline` makes a regular polygon (a disc is many sides, a hexagon six), `roundedOutline` rounds the corners of an outline, `fitOutline` takes the corners of any drawing, in any size and place, and makes them fit one unit wide, centred, counterclockwise: a game gives the silhouette of its piece and gets the same piece whatever the scale it drew at.
- `makePiece` is for a piece that is not a silhouette: it takes the geometry of a solid at a size, how tall it is and how wide, and whether it has a top and a bottom. The geometry has the `color` attribute that the piece rewrites as it turns, and one material group for each material.
- The shapes of the package: the cube has its corners cut, a pawn is turned on a lathe from a profile, the disc, the square and the hexagon are flat with a rounded edge.

### Settings

`PIECE_SETTINGS` is read on every frame by every piece: how fast a piece glides, its shadow, and how high and how long it hops when it is turned over. The debug panel has a Piece folder for it ([Tuning](../04-build-a-game/07-tuning.md)).

### Not built

- A piece made from a 3D file, or from the path of an SVG drawing: a flat piece takes the corners of an outline, and nothing reads them from the art of a game.
- A piece that is dragged and walks: a piece that is let go on a cell is set there, and a `TrackMarker` that is dragged is carried, with no walk across the spaces ([Dragging](19-dragging.md)).
- Pieces that knock one another, or that are thrown: a piece moves where the state says; a thrown token is a die ([Dice](10-dice.md)).
