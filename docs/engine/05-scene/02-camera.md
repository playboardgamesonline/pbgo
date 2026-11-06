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

A game keeps its settings in one object and hands it to `Table`; the template's is `CAMERA` in `board/camera.ts`, and its debug folder edits that object ([Tuning](24-tuning.md)).

The sliders change the fields of one settings object, and the next frame follows.

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
- A screen narrower than the aspect ratio the table is framed for backs the camera off so the table still fits (`aspectScale`); a wider one keeps the distance.
- The camera never sinks below `MIN_HEIGHT`, so a flat view still clears the table. A negative `tilt` counts as straight down, where the far side of the table is up on the screen.
- The `fov` of the settings is applied to the camera, and its projection is refreshed only when the value changes.
- The share photo places its own camera with the same `placeCamera`, with no entrance and no backing off ([Share photo](05-share-photo.md)).
- `placeCamera`, `aspectScale`, `introRest`, `MIN_HEIGHT` and `CameraRig` are internal; the types and `CAMERA_INTRO` are what the package exports.
