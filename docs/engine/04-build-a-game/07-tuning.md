# Tuning

A scene is tuned live. Every visual value is a field of a plain object that a frame reads, and the debug panel edits that object. The shared tools take such objects: `CARD_SETTINGS`, `DIE_SETTINGS`, `SEAT_SETTINGS`, the camera's settings and the entrance, the glows. The shared `Table` makes the folders for them; a game binds the objects of its own (its layout) to folders with `useSettings`.

## The panel

- It is core's `DebugPanel` (`packages/core/components/game/debug.tsx`), which a board mounts with `<DebugSlot />` in its overlay. `?debug` in the address opens it, and Shift+D toggles it and remembers the choice ([Debug](../../design/04-in-game/01-screens-and-game-flow.md#debug)). Leva and the panel are a chunk of their own: nothing is fetched until the panel is asked for (a development build fetches it at once, and shows it on `?debug` or Shift+D).
- It never runs on the production deployment. `NEXT_PUBLIC_APP_ENV` (the `VERCEL_ENV`, copied by `apps/web/next.config.ts`) is `production` there, and then the address, the browser's storage and the keyboard are not even read: no panel, no folders, no chunk. A preview deployment and a machine in development have it, which is where a table is tuned. The rule is `debugAllowed` of `components/game/debug-rule.ts`, and `debug-rule.test.ts` checks each way in.
- It has three tabs (`DEBUG_TABS`): GAME, for the game's own commands (the template's "Phases" folder: START, NEXT TURN and END, which call the debug route, [Debug commands](../01-the-game/11-the-contract.md#debug-commands)); SCENE, for the board's folders; TRANSITION, for the announcement presets and their "Replay" buttons ([Turn change](../01-the-game/03-turns.md#turn-change)).
- "Copy all settings" copies every value of every tab as JSON, and a frame-rate meter with the worst frame shows while the panel is open.
- Every folder that `useSettings` makes has a "Copy values" button that copies the folder as JSON, to paste back as the defaults in code. The panel finds values; the defaults live in the code.

## Keeping and loading a state

A situation of a game is reached once, then kept. The Table folder of the GAME tab, which every board gets from the HUD (`TableDebug`), has two buttons, both off on the production deployment (`debugEnabled`, which the debug route has always asked; `DEBUG_GAMES=1` turns them on elsewhere).

- *Copy state* copies the state of the table, saved with the ids of its seats in order (`SavedState`). *Load state from the clipboard* puts a saved state in the place of the state of the table, and the log starts again.
- A saved state is portable: its seats are mapped on the seats of the table it is loaded into, in the same order (`restoreState`), so a situation copied from a 5-seat table loads into any 5-seat table of the game. A state the engine cannot read (`isOver`, `waitingFor`, `view` for each seat) is refused with `INVALID_STATE` and nothing is written. The same JSON is a fixture for an engine test.
- The commands behind the buttons are `state` and `load` of the debug route (`POST /api/<slug>/games/<code>/debug`, [Debug commands](../01-the-game/11-the-contract.md#debug-commands)).
- For a test or a debug command of a game, `playUntil(game, state, stop)` of the kit plays for the player the game waits for until `stop` says so (the end of a round, the turn of a seat).

## What the table brings

The `Table` mounts its own tools while the panel is open (`packages/table/src/debug/table-debug.tsx`, a chunk of its own). A board on the `Table` gets all of this with no code:

| Folder | What it edits |
| --- | --- |
| Camera | The `camera` prop: `tilt`, `yaw`, `distance`, `fov`, `targetX`, `targetZ`. Open when the panel opens |
| Entrance | The `intro` prop (`CAMERA_INTRO` without one), with a "Play again" button that plays the entrance anew, whatever the clock |
| Card | `CARD_SETTINGS`: the knobs a frame reads (`CARD_FIELDS`) |
| Die | `DIE_SETTINGS` (`DIE_FIELDS`): gravity, bounce and grip, how hard a die is thrown and how it spins (read when a roll is thrown), then the playback speed, the shadow and the glide, with a "Roll again" button that throws every die again toward the face it shows |
| Piece | `PIECE_SETTINGS` (`PIECE_FIELDS`): how fast a piece glides, its shadow, and how high and how long it hops when it is turned over |
| Counter | `COUNTER_SETTINGS` (`COUNTER_FIELDS`): how long a change takes to count, how many numbers it shows on the way, how much the number swells and how a change floats up |
| Cup | `CUP_SETTINGS` (`CUP_FIELDS`): how long a cup takes to reach each pose (the slam is the quickest), how far it rattles when shaken and how often, and its shadow |
| Bag | `BAG_SETTINGS` (`BAG_FIELDS`): how far and how long a bag rocks when a hand rummages in it, how fast it slumps as it empties, and its shadow |
| Track | `TRACK_SETTINGS` (`TRACK_FIELDS`): the seconds a marker takes for a space, the most a walk may take, and how high a step hops |
| Stepper | `STEPPER_SETTINGS` (`STEPPER_FIELDS`): how long a held arrow waits before it repeats, how often and how much faster each repeat is, and how far an arrow rises under the pointer and sinks when it is pressed |
| Slider | `SLIDER_SETTINGS` (`SLIDER_FIELDS`): how far the knob rises under the pointer and when it is held, and how thick the rail is |
| Road map | `ROAD_MAP_SETTINGS` (`ROAD_MAP_FIELDS`): how wide a road is and how much wider when it is owned, how big a place is, how much room a road leaves to the pointer, how far its ring stands and how it pulses, and how opaque a road with no owner is |
| Sketch | `SKETCH_SETTINGS` (`SKETCH_FIELDS`): how far a thinned line may stray from what was drawn, the least distance between two recorded points, how long a finished stroke waits for the next before the batch goes, the most it waits, and how long a sent stroke stays on the sheet for the board to give it back |
| Timer | `TIMER_SETTINGS` (`TIMER_FIELDS`): how long an hourglass takes to turn over and how high it hops, how many seconds before the end the sand reddens and the glass trembles, how far it trembles, and its shadow |
| Drag | `DRAG_SETTINGS` (`DRAG_FIELDS`): how far the pointer goes before a press is a drag, how high a held thing floats and how fast it follows, how much a card grows, how far a drag may go, and the line, glow, pulse and inside of a zone |
| Seat | `SEAT_SETTINGS` (`SEAT_FIELDS`); the plates follow the knobs as they move |
| Lights | With a `lights` prop only: `ambient`, `sun` and where the sun stands. The lights are props, not an object a frame reads, so the folder lays what it changed over them |
| Floor | The colour of the surface and the size of one repeat of its picture, laid over the `surface` prop the same way |
| Glow · name | One folder for each glow `defineGlows` made, a sub-folder for each of its parts: the colours, opacities and speeds a frame reads (`spread` and `blend` are read when the card is drawn) |
| Share Photo | The `photo` prop, with the "Download test photo" button of `captureGamePhoto` |
| View | What to draw over the table: the axes at its middle, the frame and the slots of every `Zone`, the spot and the plate of every `Seat`. And whether to inspect the card under the pointer |
| Inspector | With the inspection on: the id, the place, the target, the size, the flight and the glow of the card under the pointer, read live |
| Time | A slow motion (`speed ×`) and a `freeze`: the frame's delta and the clock of the canvas are stretched, so cards, glows and everything damped slow down together. The camera's entrance counts real time and does not |

Closing the panel takes the folders away, and puts the view and the time back to normal. What was tuned stays in the objects until the page is reloaded.

## Binding an object to a folder

`useSettings(folder, object, fields, options)`, from `@pbgo/table`:

| Argument | Role |
| --- | --- |
| `folder` | The name of the folder in the panel |
| `object` | The settings object, plain and mutable: `LAYOUT_SETTINGS`... A constant of the game: the knobs are made once, from the object as it is when the component mounts |
| `fields` | For each key to tune, a `Field`: a label alone (a switch, or a colour for a string like `"#ffffff"`), `[label, min, max, step]` for a number, or `[label, options]` for a choice (a list or a record). A key with no field has no knob |
| `options` | `tab` (SCENE unless told), `order` among the folders, and `closed`, whether the folder starts collapsed |

- A change writes the value into the object. A frame reads it on its own.
- The component that calls `useSettings` re-renders when a knob moves, so what it computes from the object follows. A component that does not call it, but computes in a `useMemo`, lists `useSettingsVersion()` among the dependencies, or its layout stays as it was. `notifySettings()` does the same after a change made by hand.
- `useSettings` loads nothing. It writes the folder down (`useDebugFolder` of core), and the panel draws it whenever it is there. A board needs no remount when the panel loads, and on the production deployment the call does nothing.
- A folder that needs more than knobs, such as the template's "Phases" buttons, asks for itself: `useDebugFolder({ folder, tab, schema: ({ button }) => ({ ... }) }, deps)` from `@pbgo/core/components/game/debug-folders`. The `schema` is called when the panel is there, with leva in hand; like leva's own `deps`, it is made again when one of them changes.

```tsx
useSettings("Layout", LAYOUT_SETTINGS, { handZ: ["hand z", 0, 10, 0.05], handScale: ["hand scale", 0.5, 2, 0.01] }, { order: 1 })
```

## Rules

- A setting is a field of an object, not React state: a frame reads it, and the panel writes it.
- A layout helper reads no setting. A value that shapes a layout, such as a radius, reaches the layout functions as an argument ([Layout helpers](../02-components/08-layout-helpers.md)).
- A board never imports leva. `useControls` and `button` of `components/game/debug-controls` (Courtisans') are the older way in: they return the defaults until leva is in, so the component that calls them must remount once the tools are loaded (key it on `useDebugTools()`). A new board has no use for them.
