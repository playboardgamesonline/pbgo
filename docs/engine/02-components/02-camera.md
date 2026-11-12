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
- A table that has to stay clear of what the platform draws over it (the log of the turns, the menu, the list of the players) is fitted to the window by the game: the nearest distance, and the offset of the target, at which every footprint of the table is in the window and clear of those boxes. Flip 7 does it in `games/flip-7/src/components/board/camera.ts` (`fitCamera`), with the boxes of the HUD measured in pixels, since nothing publishes them yet.
- The camera never sinks below `MIN_HEIGHT`, so a flat view still clears the table. A negative `tilt` counts as straight down, where the far side of the table is up on the screen.
- The `fov` of the settings is applied to the camera, and its projection is refreshed only when the value changes.
- The share photo places its own camera with the same `placeCamera`, with no entrance and no backing off ([Share photo](01-table.md#share-photo)).
- `placeCamera`, `introRest`, `MIN_HEIGHT` and `CameraRig` are internal; the types, `CAMERA_INTRO` and `aspectScale` are what the package exports.
