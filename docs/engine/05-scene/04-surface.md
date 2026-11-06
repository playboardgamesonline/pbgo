# Surface

The table the cards lie on is an endless surface: one colour and, if the game gives one, a picture that repeats. It has no edge and no horizon, and it is never an oval or a rectangle. Shared: `packages/table/src/table/surface.tsx`. A game asks for it with the `surface` prop of [Table](01-table.md); the component `Surface` is internal.

## Props

| Field of `SurfaceProps` | Role |
| --- | --- |
| `color` | The colour of the table, and of everything beyond it. With a picture, give the picture's average colour |
| `map` | A seamless picture that repeats over the whole table: felt, linen, wood |
| `tile` | How many world units one repeat of the picture covers; `TILE` in `surface.tsx` when not given |

`SurfaceProps` is the type of the props.

Tilt the camera down to the horizon and pull it back in [Camera](02-camera.md): the table has no end to see.

## Rules

- Every table has a surface and it has no end: `surface` is required, so the canvas is never transparent and the page behind it never shows through.
- Without a `map`, the surface is the colour the canvas is cleared to, not a shape in the scene. There is no edge to reach and no size to outgrow, so no camera sees an end of it: tilted to the horizon, pulled back, in the entrance or in the share photo.
- With a `map`, the picture covers a plane `REACH` times wider than the camera's `far` and fades into `color` with distance, from `FOG_START` of `far` to `far`. The fade is the scene's fog: keep `far` well past the cards, or they fade too.
- The picture must be seamless. The table repeats a copy of it, so the game's own texture keeps its wrapping and its `repeat`.
- The picture is shown as it is: no light and no tone mapping touch it. When `color` is not its average colour, the fade shows as a haze.
- The surface lies under everything and takes no clicks ([Clicks and hover](20-clicks-and-hover.md)). The cards and the seats lie over it, a card at `RESTING_HEIGHT` ([Poses](11-poses.md)).
- A mat, a board picture or a vignette is a plane the game draws on the table. It has an edge, so it is the game's to place and to hide. A mat with a behaviour of its own, such as a shader that unrolls it, stays in the game.

The template gives its table the colour and the felt of its skin. From `template/src/components/board/scene.tsx`:

```tsx
const [mat] = useState(matTexture)
return (
  <Table camera={CAMERA} photo={PHOTO} surface={{ color: MAT_COLOR, map: mat }}>
```
