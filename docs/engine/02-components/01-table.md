# Table

`Table` is the canvas a board is drawn on. It owns the camera, the endless table the cards lie on, the lights, the share photo and the memory that lets a card fly from where it was; the cards and the seats go inside it as children. Shared: `packages/table/src/table/table.tsx`, with the props type `TableProps`. A board on the shared tools never writes a `Canvas` of its own.

The camera's entrance plays when the table mounts, and the button plays it again.

```specimen
scene-table
```

## Props

| Prop | Role |
| --- | --- |
| `camera` | The `CameraSettings` the camera follows. Required ([Camera](02-camera.md)) |
| `intro`, `playIntro` | The camera's entrance, and whether it plays ([The entrance](02-camera.md#the-entrance)) |
| `held` | The entrance waits at its first frame until this turns false, then plays from there: for a table drawn behind the platform's start screen |
| `onLoaded` | Called once, when what the children suspend on (`useTexture`, `useLoader`) is in; what a game loads without suspending, it reports itself |
| `surface` | The table the cards lie on, as `SurfaceProps`. Required: it has no end, the canvas is never transparent and the page behind it never shows through |
| `lights` | `true` for `DEFAULT_LIGHTS`, or a `LightsProps` that overrides the fields it names; without it, no light |
| `photo` | The `CameraSettings` of the share photo; without it the share image is the pixels of the canvas |
| `id` | The DOM id of the canvas's wrapper; `TABLE_CANVAS_ID` of core when not given, which is the id the share image looks for: leave it at its default |
| `near`, `far` | How close and how far the camera sees; read once, when the canvas is created |
| `children` | What lies on the table: cards, seats |

## The canvas

- What every game shares is fixed: a range for the pixel ratio, `preserveDrawingBuffer` (the share image reads the canvas) and one `Suspense` with no fallback, so nothing but the surface is drawn until the textures under it are ready.
- `camera` and `intro` are plain objects read on every frame: keep one object and change its fields, and the next frame follows.
- `Table` makes one pose memory and provides it to the cards under it; a `Card` outside a `Table` has none ([Pose memory](05-poses-and-motion.md#pose-memory)).
- The entrance is the only thing that reads the visitor's motion preference; a card ignores it.
- Children are three.js objects drawn by react-three-fiber. DOM belongs to the HUD around the canvas, never inside the `Table`.
- A game splits its scene in two, the component that renders `Table` and the one that renders what lies on it, so hooks like `useFrame` run under the canvas.

From `template/src/components/board/scene.tsx`, where `World` is what lies on the table and the surface is a colour and a felt:

```tsx
export function Scene(props: SceneProps) {
  useCameraSettings()
  const [mat] = useState(matTexture)
  return (
    <Table camera={CAMERA} photo={PHOTO} surface={{ color: MAT_COLOR, map: mat }} held={props.held} onLoaded={props.onLoaded}>
      <World {...props} />
    </Table>
  )
}
```

## Lights

The lights of a table are an ambient light and a sun. Shared: `packages/table/src/table/lights.tsx`; the component `Lights` is internal.

| Field of `LightsProps` | Role |
| --- | --- |
| `ambient` | The strength of the light that falls everywhere alike |
| `sun` | The strength of the sun, the light that gives lit materials their shade |
| `sunPosition` | Where the sun stands; it shines toward the middle of the table |

Every material the package draws is unlit, so the lights show only on a material the game adds that reacts to light. A board of flat materials, like the template's, asks for none.

## Surface

The table the cards lie on is an endless surface: one colour and, if the game gives one, a picture that repeats. It has no edge and no horizon, and it is never an oval or a rectangle. Shared: `packages/table/src/table/surface.tsx`; the component `Surface` is internal.

| Field of `SurfaceProps` | Role |
| --- | --- |
| `color` | The colour of the table, and of everything beyond it. With a picture, give the picture's average colour, or the fade shows as a haze |
| `map` | A seamless picture that repeats over the whole table: felt, linen, wood. The table repeats a copy of it, so the game's own texture keeps its wrapping and its `repeat`. It is shown as it is: no light and no tone mapping touch it |
| `tile` | How many world units one repeat of the picture covers; `TILE` in `surface.tsx` when not given |

- Without a `map`, the surface is the colour the canvas is cleared to, not a shape in the scene. There is no edge to reach and no size to outgrow, so no camera sees an end of it: tilted to the horizon or pulled back (try both in [Camera](02-camera.md)), in the entrance or in the share photo.
- With a `map`, the picture covers a plane `REACH` times wider than the camera's `far` and fades into `color` with distance, from `FOG_START` of `far` to `far`. The fade is the scene's fog: keep `far` well past the cards, or they fade too.
- The surface lies under everything and takes no clicks ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)). The cards and the seats lie over it, a card at `RESTING_HEIGHT` ([Poses](05-poses-and-motion.md)).
- The surface is pushed back in the depth buffer (`POLYGON_OFFSET` in `surface.tsx`). It is one plane a thousand units wide, whose depth is not exact over such a size, and without the push what lies a hair above it, the plates of a board or the line of a zone, sank into it wherever the camera stood far from the table.
- A mat, a board picture or a vignette is a plane the game draws on the table. It has an edge, so it is the game's to place and to hide. A mat with a behaviour of its own, such as a shader that unrolls it, stays in the game.

## Share photo

At the game over, the share dialog makes an image of the finished table; the panel itself is the shared UI's ([Game over](../../design/04-in-game/07-game-over.md)). With a `photo` camera, `Table` registers a capture function (`setPhotoCapture` of core) that renders the scene once from that camera, at the size the dialog asks for. Shared: `packages/table/src/table/share-photo.tsx`; the component `SharePhoto` is internal.

- `photo` is a `CameraSettings` ([Camera](02-camera.md)), usually farther away than the live camera so the whole table is in the picture. The template keeps it in `PHOTO` of `board/camera.ts`. It is read when the photo is taken, so a game can change it live; the capture registers again when the object itself is replaced, and is unregistered when the table unmounts.
- The photo has a camera of its own, placed by `placeCamera` with no entrance and no backing off: it does not depend on where the live camera stands or on the shape of the screen. It sees as near and as far as the live camera.
- An object with `userData.hiddenInPhoto` set is left out of the picture: use it for what is not part of the table itself, such as a veil laid over the screen. Only objects visible at that moment are hidden, and they come back right after.
- The render goes through the live renderer, sized for the photo and not for the screen. The renderer's size, pixel ratio and live view are restored afterwards, even if the render throws.
- The Share Photo folder of the table's debug panel edits the camera of the photo, and has a "Download test photo" button that calls `captureGamePhoto` ([Tuning](../04-build-a-game/07-tuning.md)).

## Debug tools

While the debug panel is open (`?debug` or Shift+D, never on the production deployment), the `Table` mounts its tools in the canvas: the folders for the camera and its entrance, the cards, the seats, the lights, the floor and the glows; the helpers drawn over the table (axes, the frame and slots of every `Zone`, the spot and plate of every `Seat`); an inspector for the card under the pointer; and a slow motion that freezes or slows the canvas's clock. The page [Tuning](../04-build-a-game/07-tuning.md) lists the folders. The `Table` also loads the panel's tools when they are asked for, but the panel itself is the board's `<DebugSlot />`.

## Coordinates

- The world is y up. Distances are world units: a card's `size`, the `tile` of the surface and the camera's `distance` are in them.
- The viewer sits on the +z side and looks toward -z; +x runs to the right of the screen at a camera `yaw` of zero.
- A card is a plane facing +z. `FACE_UP` lays it flat with its front to the sky and its top edge toward -z, away from the viewer; `FACE_DOWN` shows the back and points the top edge toward +z.
- The `y` of a pose is the height of the card's centre above the table; `RESTING_HEIGHT` is a card lying on it.
- `yaw` turns about the vertical axis, counterclockwise seen from above. Poses and layouts take radians; the camera's `tilt`, `yaw` and `fov` are degrees.
- A `Spot` is `{ x, z, yaw? }`: a place on the table and the way it faces. A layout is drawn in the frame of a spot and `inFrame` puts it on the table.
