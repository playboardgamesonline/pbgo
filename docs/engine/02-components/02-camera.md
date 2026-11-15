# Camera

The camera is fixed during a game: no orbit, no zoom. `Table` puts it where the settings say on every frame, and the share photo uses the same maths from its own settings. Shared: `packages/table/src/table/camera.ts` (the maths, pure and tested) and `camera-rig.tsx` (the frame loop).

## Settings

From `packages/table/src/table/camera.ts`:

```ts
export type CameraSettings = {
  tilt: number
  yaw: number
  distance: number
  fov: number
  targetX: number
  targetZ: number
}
```

| Field | Role |
| --- | --- |
| `tilt` | Degrees from the vertical; zero looks straight down |
| `yaw` | Degrees around the table; zero looks from the viewer's side |
| `distance` | World units from the target to the camera |
| `fov` | The vertical field of view, in degrees |
| `targetX`, `targetZ` | The point of the table in the middle of the picture |

A game keeps its settings in one object and hands it to `Table`; the template's is `CAMERA` in `board/camera.ts`, and its debug folder edits that object ([Tuning](../04-build-a-game/07-tuning.md)).

The sliders change the fields of one settings object, and the next frame follows. `CAMERA_FIELDS` and `INTRO_FIELDS` list the numbers of a `CameraSettings` and of a `CameraIntro` that a panel can tune, each with its range and its step: the Camera, Entrance and Share Photo folders of the debug panel are made from them.

```specimen
scene-camera
```

## The entrance

| Field of `CameraIntro` | Role |
| --- | --- |
| `enabled` | Whether the entrance exists at all |
| `duration` | Seconds it takes to settle |
| `zoom` | How many times farther the camera starts |
| `rotate` | Degrees of yaw it starts away from the settings |
| `tilt` | Degrees of tilt it starts away from the settings |

- The camera starts `zoom` times farther, `rotate` more turned and `tilt` more tilted, and settles on `CameraSettings` over `duration`, slowing as it arrives.
- `CAMERA_INTRO` is the default. Copy it to give a game its own knobs: the rig reads whichever object it is given on every frame.
- It plays when the table mounts. `playIntro` false holds the camera on its settings, and turning it true again plays it again.
- `held` on the `Table` keeps the camera at the first frame of the entrance and plays it from there when it turns false: a board drawn behind the platform's start screen opens when the screen goes.
- A visitor who asks for reduced motion never sees it, whatever the game passes.

## Rules

- The rig sets the camera on every frame, so nothing else may move it: change the settings, not the camera.
- A screen narrower than the aspect ratio the table is framed for backs the camera off so the table still fits (`aspectScale`, which the package exports: the distance of the settings is multiplied by it); a wider one keeps the distance. A game that fits its own camera to the window (below) works out where the camera really stands with it, and gives the settings the distance divided by it.
- A table is fitted to the window with `fitCamera` (below), not with a distance that suits a laptop: the platform draws boxes over the board (the log of the turns, the menu, the list of the players) and a window is any size.
- The camera never sinks below `MIN_HEIGHT`, so a flat view still clears the table. A negative `tilt` counts as straight down, where the far side of the table is up on the screen.
- The `fov` of the settings is applied to the camera, and its projection is refreshed only when the value changes.
- The share photo places its own camera with the same `placeCamera`, with no entrance and no backing off ([Share photo](01-table.md#share-photo)).
- `placeCamera`, `introRest`, `MIN_HEIGHT` and `CameraRig` are internal; the types, `CAMERA_INTRO`, `aspectScale` and what the next section lists are what the package exports.

## Fit the camera to the window

`fitCamera(viewport, base, { seen, reach, avoid })` (`packages/table/src/table/fit.ts`) gives the camera for a window: the nearest that has the whole table in it, with **the scene always in the middle**. A game lists the shapes lying on the table as the corners of each box, on the ground (`Quad`: `{ x, z }` points), and hands it the camera it starts from (`base`: it keeps its tilt, its turn and its field of view). It gives back `{ camera, fits, clear, covered }`.

| Option | Role |
| --- | --- |
| `seen` | What the player has to see (plates, lines, piles, buttons). The middle of the smallest rectangle that holds them is the middle of the window: the camera looks at the point that makes it so, across and along the table. A table made the same on both sides keeps `targetX` where it was |
| `reach` | What has to be in the window too without weighing on the centre: the zones that are pressed but not drawn, which reach a little past what is seen |
| `avoid` | What the platform draws over the window (`hudBoxes(viewport, players)`, measured on the HUD of core, the same for every game). The camera stands back while they cover more than `coverage` (0.04) of any one thing that is seen (a plate half under a box is a name lost), but not so far that a unit of the table is smaller than `dodgeUnit` for that alone (6.5 % of the height): in a small window the boxes cover the edge of a plate of a table in the middle, rather than the table being made small to be clear of them. `covered` says how much of the worst-covered thing they do cover |
| `nearest`, `leastUnit`, `gap` | The nearest the camera may stand, the least a unit of the table may be at the point it looks at (38 px: below it the table is kept there and `fits` is false) and the air kept round the window |

- It never stands to a side of the table to get out from under a box: a lopsided scene is worse than a corner under the log.
- The rig backs the camera off below a 16:10 window (`aspectScale`): the distances worked out are where the camera really stands, and the `distance` given back is that divided by it. `standingDistance(camera, viewport)` gives it back.
- `windowRectOf(quad, distance, targetX, targetZ, camera, viewport)` is where a shape of the table falls in the window, for a camera that looks straight at the table (the shortcut for points on the ground, tested against a real camera), for the tests of a board.
- `useViewport()` is the size of the window as a value that only changes when it does; give it to `useDeferredValue` before fitting a camera to it, so that a window dragged to another size does not fit at every step. The fit costs a few milliseconds.
- Flip 7 uses it in `games/flip-7/src/components/board/camera.ts` (`fitFor`), with `seenQuads` and `reachQuads` of its layout.
