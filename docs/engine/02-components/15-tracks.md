# Tracks

A track is a row of spaces that a marker moves along: a score track, the turn order of a round, the squares of a board that runs round and round, the steps of a climb. The state keeps where each marker is, as a whole number, and nothing else; the engine moves it with `moveAlong`, which also says which spaces the marker went through. The board lays the spaces out (in a line, on an arc, round a loop, in a snake, or at the points the game gives), draws them with a `Track`, and puts a `TrackMarker` on the space of each marker, which walks along the spaces one after the other when its number changes. The table's side is `packages/table/src/track/`, the engine's is `track.ts` of the kit.

Ring the spaces the red pawn can reach and press one, send the blue pawn to the start, and reset the score: the markers walk.

```specimen
scene-track
```

## The parts of a track

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Spaces | The places in order: where each is on the table, and the way the track goes there | `lineSpaces`, `arcSpaces`, `loopSpaces`, `snakeSpaces`, `pathSpaces`, or the points the game works out |
| Plates | What a space looks like: a label, a colour, a ring when it can be chosen | `Track`, and its `look` |
| Markers | What stands on a space and moves along | `TrackMarker`: a `Piece` that walks |
| Rules | Where the track starts and ends, and whether it closes on itself | The game's, given to `moveAlong` as `TrackRules` |
| Position | Where a marker is: the number of its space | The state |

## In the engine

The state holds the position of each marker as a whole number, and nothing else: the board knows the spaces by their number ([Lean state](../01-the-game/09-state.md#lean-state)). `moveAlong` moves a marker and says what it went through:

| Export | What it does | Errors |
| --- | --- | --- |
| `TrackRules` | `{ min?, max, loop? }`: the first space (0 by default), the last, and whether the track closes on itself, so that the space after `max` is `min` | |
| `moveAlong(track, from, steps)` | A marker on space `from` moved `steps` spaces: forward above zero, back below. A `Walk`: `from`, `to`, `moved` (the spaces really gone, with their sign), `passed` (the spaces it went through, in order, the last being `to`), `laps` (the crossings of the end of a loop: +1 forward, −1 back) and `stopped` (`"min"` or `"max"`, the end that cut the move short, else `null`) | `RangeError` for a track with no space or whose ends are not whole numbers, a marker that is not on a space of it, and steps that are not a whole number or are more than `MAX_WALK` |

```ts
// A pawn goes round a board of forty squares: passing the start pays, and the log says the way
const walk = moveAlong({ min: 1, max: 40, loop: true }, ctx.s.square[seat], dice)
ctx.s.square[seat] = walk.to
ctx.s.cash[seat] += 200 * Math.max(0, walk.laps)
ctx.events.push({ type: "moved", seat, from: walk.from, to: walk.to, passed: walk.passed })
```

- On a track that does not loop a marker stops at the end, and `stopped` says so: a score track that has no more room, a climb at the top. On a loop nothing stops it, and `laps` counts the times it crossed the start.
- `passed` is for a game that does something on the spaces it goes through and not only on the one it stops on: a toll, the start, a space that turns the marker back. A marker that does not move has none.
- The engine may number its track from any whole number (the squares of a board from 1); the list of spaces of the board is numbered from 0, so the board gives `square - 1`.
- Several markers on a space are kept in the order they came, in an array of the state like every order ([Lean state](../01-the-game/09-state.md#lean-state)): the board stands them side by side in that order.
- A move a player asks for goes through `cleanNumber` ([Bets and choices](12-bets-and-choices.md)) when the player names the space or the steps; `moveAlong` throws for what only a bug can send it.

## On the table

### Laying out the spaces

A `Space` is `{ x, z, yaw }`: where it is, and the way the track goes there (`yaw` turns about the vertical axis, as everywhere on the table). The helpers make the list for a track, in the order of the track, and `spacesIn` moves it where the board has it.

| Helper | The spaces |
| --- | --- |
| `lineSpaces(count, { gap })` | In a straight line along x, centred, the first on the left, the track going to the right |
| `arcSpaces(count, { radiusX, radiusZ?, from, to })` | Along an arc of an ellipse, as far from one another along the curve, the first at the angle `from` and the last at `to`. The angle 0 is the right of the ellipse and a quarter turn the front, nearest the viewer; the track goes clockwise seen from above while `to` is above `from` |
| `loopSpaces(count, { radiusX, radiusZ?, start?, clockwise? })` | Round an ellipse, as far from one another along the curve, the first at `start` (the front by default), the track going clockwise unless it is told otherwise, the space after the last being the first |
| `snakeSpaces(count, { columns, gapX, gapZ, start? })` | In lines that the track goes along in turn, left to right and then right to left, as the squares of a board of snakes and ladders. The first line is the nearest the viewer unless `start` is `"far"` |
| `pathSpaces(points)` | At the points the game gives, each facing the next one |
| `spacesIn(frame, spaces)` | The same spaces moved and turned into the frame of a spot `{ x, z, yaw? }`, the way `inFrame` does for a card: a track described round its own middle and put where the board has it |

### Track

`packages/table/src/track/track.tsx`. The props are `TrackProps`:

| Prop | Role |
| --- | --- |
| `spaces` | The spaces, in order. Keep the list from one render to the next, or compute it in `useMemo`; a list made anew with the same spaces costs a comparison and no painting |
| `size` | The size of a plate in world units: its side, or `{ width, depth }`. Default: a little under the distance to the nearest neighbour, so that two plates never touch |
| `look` | `(index) => { label?, color?, ink? }`: what each space shows, its label (a number, a word, a sign), the colour of its plate and of its ink. The start, the end and the spaces that pay are the ones that give a colour. The labels come from the game's data and the visitor's language |
| `upright` | The plates face the viewer whichever way their space faces, so that a label reads upright (default true); without it a plate turns with its space |
| `halo`, `haloColor` | The numbers of the spaces that can be chosen, which a ring pulses round, and the colour of the ring |
| `onSpace` | Pressing a space does this, with its number. The space under the pointer takes a ring. Without it the plates only show |
| `onHover` | The pointer comes onto a space, with its number, and leaves it, with `null` |
| `font`, `color`, `ink` | The font of the labels and the colours of the plates and of the ink for the spaces that give none |

The plates are one mesh and one picture whatever their number, painted again only when a label or a colour changes, so a track of a hundred spaces costs no more than one of ten. A label shrinks to fit its plate and stops shrinking at under half its size: a label that long is the game's to shorten.

### TrackMarker

`packages/table/src/track/marker.tsx`. A marker is a [piece](13-pieces.md) that stands on a space, so it takes every prop of a `Piece` (`id`, `model`, `size`, `color`, `faces`, `lift`, `halo`, `onClick`…) except the places, which it works out. The props of its own are `TrackMarkerProps`:

| Prop | Role |
| --- | --- |
| `spaces` | The spaces of the track, the list given to the `Track` |
| `space` | The space the marker is on: its number in that list |
| `loop` | The track closes on itself: a marker sent to another space takes the shorter way round |
| `route` | The spaces to go through to the new `space`, when the way is not the straight one or the shorter one: the `passed` of `moveAlong`. It is used when it ends on the new space |
| `slot`, `of` | Which of the markers that share this space this one is, from 0 in the order they came, and how many there are: they stand side by side in the space |
| `spread` | The distance between two markers that share a space (default 0.85 widths of the marker) |
| `yaw` | The way the marker faces (default: the way the track goes on its space) |
| `onStep` | Called each time the marker reaches a space on its way, with it: a step of sound |

```tsx
const loop = useMemo(() => loopSpaces(40, { radiusX: 5, radiusZ: 2.6 }), [])

<Track spaces={loop} look={(space) => ({ label: view.names[space] })} halo={canMove ? reachable : null} onSpace={(space) => post({ type: "move", space })} />
{view.players.map((player) => (
  <TrackMarker key={player.id} id={player.id} spaces={loop} space={player.square - 1} loop model="pawn" color={seatColour(player.id)} slot={player.slot} of={player.sharing} />
))}
```

### How a marker walks

- The first space is shown at once. When `space` changes the marker goes through each space between the old one and the new one, one after the other, hopping at each step, and a long walk takes its steps quicker: no walk takes more than `maxSeconds`.
- It goes the straight way, or round a loop the shorter way, forward when both ways are as long. A game that wants another way says it with `route`, the `passed` of the move.
- A new `space` that comes while the marker is walking sends it on from the space it is on.
- Markers that share a space stand side by side as the viewer sees them, whichever way the track goes there, and spread out again when one leaves.
- A visitor who asks for less motion gets no walk and no hop: the marker goes straight to the new space, gliding to it the way a piece does everywhere.
- `onStep` fires at each space reached, the last included: a step of sound for a pawn, a coin on a score track.

### Settings

`TRACK_SETTINGS` is read on every frame by every marker: the seconds for a space, the most a walk may take, and how high a step hops. The debug panel has a Track folder for it ([Tuning](../04-build-a-game/07-tuning.md)).

### Not built

- A track that forks, or one whose spaces differ in shape or size: the plates are rectangles of one size and a marker walks one list of spaces. A board with a fork is two tracks, or a [board](../03-not-built-yet.md).
- A track drawn on the art of a board: the spaces follow the points of `pathSpaces`, and the picture under them is a plane the game draws on the table ([Surface](01-table.md#surface)).
- A marker the player drags along the track, passing each space: a `TrackMarker` is a `Piece`, so it can be picked up and let go on a space (put the spaces on the table with `useDropZones`), and it is carried there with no walk ([Dragging](19-dragging.md)).
- A space that holds a card or a piece: it lies on the same place, as a [zone](07-zones.md) or a `Piece` of the game's own.
