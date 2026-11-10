# Drawing

A player draws on a sheet of paper and the others see it: a clue sketched for them to guess, as in Pictionary or Telestrations, a map, a mark on a board. A drawing is not a picture that the game keeps. It is strokes, each a line of points in one colour and one width, kept in the state as plain numbers and drawn again by every board. In the engine a drawing is bounded data that is cleaned and refused like any other answer; on the table it is a `Sketch`, a sheet laid on the table that the pointer draws on.

Draw on the left sheet. The line is there at once, and a moment after you lift the pen the sheet sends it, the engine cleans it and keeps it, and the sheet on the right, which can only be read, shows what the engine kept. The specimen takes twelve strokes, so that a full sheet can be seen: the engine refuses the next ones with `DRAWING_FULL` and the sheet lets them go. Switch the turn off and the left sheet can only be looked at.

```specimen
scene-sketch
```

## The parts of a drawing

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Stroke | A line of points in one colour and one width | The engine: a `Stroke`, cleaned by `cleanStroke` |
| Drawing | The strokes of a sheet, in the order they were drawn | The state of the engine: a `Drawing`, a list of strokes |
| Grid | The 1,000 by 1,000 points that a sheet is drawn on, whatever its size on the table | The kit: `DRAWING_GRID` |
| Palette and brushes | The colours and the widths a stroke may take, as indexes | The game: its rules and its look |
| Limits | The most strokes, the most points in all and the most in one stroke | The game's rules, with the defaults of `DRAWING_LIMITS` |
| Sheet | The paper a player draws on, or reads | `Sketch` of `@pbgo/table` |
| Pen | The colour and the brush that the next stroke takes | The board: a palette on the table, a row of brushes, a control |

## In the engine

The engine takes a drawing from a player, so it does what it does for a text or a number: it trusts nothing and keeps what it has cleaned.

| Export | What it does | Errors |
| --- | --- | --- |
| `cleanStroke(input, rules)` | One stroke a player drew, checked against the rules and given back as a new object with its three fields: the numbers rounded, a point that comes twice in a row kept once | `EngineError("INVALID_DRAWING")` for anything that is not a stroke: a colour or a width that is not one of the palette's, points that are not pairs of numbers on the grid, no points, or more than a stroke may have |
| `addStrokes(drawing, input, rules)` | The drawing with the strokes of `input`, a list, added to it, each one cleaned. The drawing it is given is left alone | `INVALID_DRAWING` for what is not a list of strokes, `DRAWING_FULL` when the strokes or the points would pass the limits |
| `cleanDrawing(input, rules)` | A whole drawing handed in at once, checked as strokes added to an empty sheet | The same |
| `undoStroke(drawing)` | The drawing without its last stroke | |
| `drawingPoints(drawing)` | How many points the drawing holds in all, which is what the limit of the whole drawing counts | |
| `emptyDrawing()` | A sheet with nothing on it | |
| `DrawingRules` | How many `colors` and `widths` the palette and the brushes have, and the limits `strokes`, `points` and `strokePoints` | A rule that is not a whole number above zero is a bug of the game and throws a `RangeError` |
| `DRAWING_LIMITS`, `DRAWING_GRID` | What a drawing may hold unless a game says less (60 strokes, 2,500 points in all, 400 in a stroke) and the grid the points lie on (1,000) | |

- A stroke is `{ color, width, points }`. `color` and `width` are indexes of the game's palette and of its brushes, counted from 0: the engine does not know a colour, so the colours are the board's, and a game can change its look without changing a drawing in progress. `points` is a flat list, `x` then `y` for each point, whole numbers from 0 to `DRAWING_GRID` on both axes, the origin at the top left of the sheet and `y` growing downward. A single point is a dot.
- The grid is the same whatever the size of the sheet, so a drawing is the same on every screen. The board maps the grid to its sheet and the engine never sees a pixel. A sheet needs the same proportions for every player at the table, or the drawing is stretched on one of them.
- Call `addStrokes` in `apply`, on the field of the action, and keep what it returns. The action is checked like any other: a missing field is `INVALID_ACTION`, a stroke that does not pass is `INVALID_DRAWING` and a sheet with no room is `DRAWING_FULL`, shared codes that the platform words for the player ([The shared codes](../01-the-game/05-actions.md#the-shared-codes)). `DRAWING_FULL` is the sheet's fault and not the stroke's, so it has a code of its own: the board can say that the sheet is full.
- The points of a request are counted as they were sent, before anything is taken out, so that a request cannot make the engine walk a million of them. A board takes its own repeats out before it sends: the sheet does.
- The limits are what keeps a player from filling the table, and a game narrows them in the rules it passes. The state is a row that every request reads, and a drawing at the limits is some 20 kB: a point is about eight characters as JSON. A game that draws a map or a long game of many rounds lowers them to what its drawings need, or keeps the drawing of the round only.
- The state keeps the strokes as they are, with the rest of the state: lean, bounded by the rules, and gone with the table ([Lean state](../01-the-game/09-state.md#lean-state)). The view gives them to whoever may read them.
- Who may draw is the game's rule, as who may play: the engine refuses the others with `NOT_YOUR_TURN`, and the sheet shows the same thing with `disabled`, so a sheet that is not the viewer's turn can only be looked at.
- A drawing everybody makes at once and reveals together is a `Submissions<Drawing>` ([Simultaneous steps](../01-the-game/03-turns.md#simultaneous-steps)): the view says who has drawn, never what, until the step is resolved. Keep the points out of the log, which is for people to read ([Events and the log](../01-the-game/12-events-and-the-log.md)): an event says that a player drew.
- What a player draws is read by the others. Nothing filters it ([Not built](#not-built)).
- A game that keeps a drawing stores something new about its players: the inventory of personal data and the Privacy Policy say it ([legal](../../legal.md)).

```ts
type State = { /* ... */ drawer: string; drawing: Drawing }

const RULES: DrawingRules = { colors: 4, widths: 3, strokes: 40 }

const game: GameDefinition<State, Action, View> = {
  clientActions: ["draw", "undo"],
  apply: (state, action) => {
    // Only the drawer draws: the others are refused, whatever their board shows
    if (action.playerId !== state.drawer) throw new EngineError("NOT_YOUR_TURN")
    // Every stroke is cleaned, and a sheet with no room left refuses them
    if (action.type === "draw") return { ...state, drawing: addStrokes(state.drawing, action.strokes, RULES) }
    if (action.type === "undo") return { ...state, drawing: undoStroke(state.drawing) }
    throw new EngineError("INVALID_ACTION")
  },
  // Everybody reads the drawing as it is kept
  view: (state) => ({ /* ... */ drawing: state.drawing }),
}
```

## On the platform

Nothing is new: a stroke is an action, and the route that takes it is the one that takes every action.

- The action route lets a player send 20 requests in 10 seconds. A pen that sent every stroke as it was lifted would pass that in a busy minute, so the sheet sends in batches: it calls `onStrokes` with a list, and a board posts the list as one action. A quick scribble of several strokes is one request.
- A stroke of 400 points is some 3 kB, and the sheet thins every stroke before it is sent, so a request stays small. The drawing goes in the view of every read of the table, so a drawing at the limits is some 20 kB for every player on every read.
- A drawing is part of the state, so it goes with the table: 30 days after its last move, and 24 hours after a game is over once the game is recorded. The results of a game keep nothing of it.
- The platform does not read a drawing: it does not filter it and has no way to report it yet.

## On the table

### The sheet

A `Sketch` is shared: `packages/table/src/sketch/sketch.tsx`. It is a sheet of paper that lies on the table, drawn on with the pointer. The props are `SketchProps`:

```tsx
<Sketch
  strokes={view.drawing}
  onStrokes={(strokes) => void send({ type: "draw", strokes })}
  at={{ x: 0, z: 0 }}
  colors={PALETTE}
  widths={BRUSHES}
  pen={pen}
  disabled={view.drawer !== meId}
/>
```

| Prop | Role |
| --- | --- |
| `strokes` | The strokes the board holds, the engine's `Drawing`. The sheet shows them and keeps no drawing of its own |
| `onStrokes` | Called with the strokes the player finished, in a batch: what a board posts as an action. Without it the sheet cannot be drawn on and only shows its strokes, which is how the sheet of another player is drawn |
| `at` | Where the middle of the sheet lies on the table, `x` and `z`, and the way it faces, `yaw` |
| `width`, `height` | Its size in world units (default 6 by 4.5). The same proportions for every player at the table |
| `colors` | The colour of each index of the game's palette. A stroke with an index that has no colour is drawn in a dark ink |
| `widths` | The width of each brush, as a part of the width of the sheet |
| `pen` | The colour and the brush that the next stroke takes, as indexes (default the first of each). The board owns them: a palette on the table, a row of pens, a control |
| `paper` | The colour of the paper |
| `disabled` | Nobody can draw on the sheet now: it only shows its strokes |
| `strokePoints` | The most points a stroke may have, which a longer one is thinned to: the engine's `strokePoints` (default 400) |

How it behaves:

- Press on the sheet, move and let go: that is a stroke. The line is drawn under the pointer as it moves, with a curve bent through the points so that it is not a polygon, and the stroke is finished when the pointer is lifted. Pressing without moving is a dot. Escape, the window losing the focus or the browser taking the touch away gives the stroke up.
- When the pointer is lifted the stroke is put on the grid and thinned: the points closer than `spacing` to the one before are left out, the line is simplified within `tolerance` (Douglas and Peucker), and again more roughly until it has no more points than a stroke may have. What is sent is what the engine would keep: a test holds the thinning of the table and `cleanStroke` of the kit together.
- A finished stroke shows at once and waits to be sent. It goes a moment after the last stroke (`settle`) and never later than `flush` after the first one that waits, with the others that wait, in one batch. When the board gives the strokes back the sheet draws them from `strokes`, and the ones that waited are no longer waited for.
- A stroke that the board never gives back, one that the engine refused or that a failed request lost, is let go `pending` seconds after it was sent: the sheet does not keep what the engine did not. It does not send a stroke twice. A sheet that leaves the table sends what is finished.
- A sheet draws one stroke at a time, and while one is drawn nothing else on the table can be dragged ([Dragging](19-dragging.md)). On a touch screen it asks the page not to scroll under a finger as long as it can be drawn on.
- The picture is painted on a canvas, 120 pixels for each unit of the table, and laid on the table with a soft shadow like the rest of the board: it is unlit and not tone mapped, so the colours are the ones painted ([Rules of the board](22-rules-of-the-board.md)). Nothing in it moves by itself, so a visitor who asks for less motion sees no difference.
- A sheet that several players draw on at once works, but the sheet waits for its own strokes by their place in the list, so a stroke of the viewer can blink out for a moment when another player's is kept first.

### Settings

`SKETCH_SETTINGS` is read by every sheet: `tolerance` (how far the thinned line may stray from what was drawn, in points of the grid), `spacing` (the least distance between two points the pen records), `settle` (the seconds a finished stroke waits for the next one before the batch goes), `flush` (the most seconds a stroke waits to be sent) and `pending` (the seconds a sent stroke is kept on the sheet for the board to give it back). The debug panel has a Sketch folder for it ([Tuning](../04-build-a-game/07-tuning.md)), and the Tuning tab of the [playground](/docs/playground) has the same sliders.

### Not built

- Drawing that the others watch as it is drawn: they see a stroke when the pen is lifted and the engine has kept it. A game that needs it, where the others guess as the line grows, needs a channel that does not go through the action route, with the points as they come and the state keeping the finished strokes only.
- An eraser, a fill, shapes and text: a stroke has a colour and a width and nothing else, and `undoStroke` is the only way to take one off.
- The pressure and the tilt of a pen: every stroke has one width.
- Drawing with the keyboard, or a way for a player who cannot draw with a pointer: the sheet is the pointer's. The colour, the brush, undo and clear are controls of the board, which have a keyboard way, and a game gives a player who cannot draw something else to do.
- A picture behind the strokes, a map or a grid to trace: the paper has a colour.
- Sending a stroke again: a stroke that a failed request lost is let go. A board that wants to try again keeps the batch it posted, and posts it once more.
- Playing a drawing back stroke by stroke. The strokes are in order, so a board can; the table has no component for it.
- A filter of what is drawn, and a way to report it ([Not built yet](../03-not-built-yet.md)).
