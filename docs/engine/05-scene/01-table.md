# Table

`Table` is the canvas a board is drawn on. It owns the camera, the endless table the cards lie on, the lights, the share photo and the memory that lets a card fly from where it was; the cards and the seats go inside it as children. Shared: `packages/table/src/table/table.tsx`. A game never writes a `Canvas` of its own.

The camera's entrance plays when the table mounts, and the button plays it again.

```specimen
scene-table
```

## Props

| Prop | Role |
| --- | --- |
| `camera` | The `CameraSettings` the camera follows. Required, and read on every frame ([Camera](02-camera.md)) |
| `intro`, `playIntro` | The camera's entrance, and whether it plays ([The entrance](02-camera.md#the-entrance)) |
| `held` | The entrance waits at its first frame until this turns false, then plays from there: for a table drawn behind the platform's start screen ([The entrance](02-camera.md#the-entrance)) |
| `onLoaded` | Called once, when what the children suspend on (`useTexture`, `useLoader`) is in; what a game loads without suspending, it reports itself |
| `surface` | The table the cards lie on, as `SurfaceProps`: a colour and a picture that repeats. Required: it has no end and the canvas is never transparent ([Surface](04-surface.md)) |
| `lights` | `true` for `DEFAULT_LIGHTS`, or a `LightsProps`; without it, no light |
| `photo` | The `CameraSettings` of the share photo; without it the share image is the pixels of the canvas ([Share photo](05-share-photo.md)) |
| `id` | The DOM id of the canvas's wrapper; `TABLE_CANVAS_ID` of core when not given, which is the id the share image looks for |
| `near`, `far` | How close and how far the camera sees; read once, when the canvas is created |
| `children` | What lies on the table: cards, seats |

`TableProps` is the type of the props.

## Rules

- What every game shares is fixed: a range for the pixel ratio, `preserveDrawingBuffer` (the share image reads the canvas) and one `Suspense` with no fallback, so nothing but the surface is drawn until the textures under it are ready.
- `camera` and `intro` are plain objects read on every frame: keep one object and change its fields, and the next frame follows. Only `near` and `far` are fixed when the canvas is created.
- `Table` makes one pose memory and provides it to the cards under it; a `Card` outside a `Table` has none ([Pose memory](10-pose-memory.md)).
- The entrance is the only thing that reads the visitor's motion preference; a card ignores it.
- Children are three.js objects drawn by react-three-fiber. DOM belongs to the HUD around the canvas, never inside the `Table`.
- A game splits its scene in two, the component that renders `Table` and the one that renders what lies on it, so hooks like `useFrame` run under the canvas.

From `template/src/components/board/scene.tsx`, where `World` is what lies on the table:

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
