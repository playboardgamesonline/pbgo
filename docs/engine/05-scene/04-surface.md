# Surface

`Surface` is the mat the cards are played on: a flat ellipse or rectangle with a picture or a colour, and an optional rim. Shared: `packages/table/src/table/surface.tsx`. A board with no mat lays its cards on the bare floor.

## Props

| Prop | Role |
| --- | --- |
| `size` | The width and the depth of the mat, in world units |
| `shape` | `"ellipse"` or `"rectangle"`; the default is the ellipse |
| `map` | The picture of the mat, a `Texture` |
| `color` | The colour of the mat; it tints the picture when there is one |
| `rim` | `{ width, color }`: a band of that colour all around the mat, outside `size` |

`SurfaceProps` is the type of the props.

## Rules

- The mat is unlit and not tone mapped: the picture is shown as it is.
- It lies over the floor and under the cards. The rim is the lowest, then the mat, at heights fixed in `surface.tsx`; cards rest higher, at `RESTING_HEIGHT`.
- It takes no clicks: the cards on it do ([Clicks and hover](20-clicks-and-hover.md)).
- The picture is stretched over the whole box of `size`; an ellipse shows only the part inside its curve.
- A mat with a behaviour of its own, such as a shader that unrolls it, is not a `Surface`; it stays in the game.

The template sizes its mat from the radii of its seat ring plus a margin. From `template/src/components/board/scene.tsx`:

```tsx
<Surface
  size={[2 * (LAYOUT_SETTINGS.radiusX + MAT.margin), 2 * (LAYOUT_SETTINGS.radiusZ + MAT.margin)]}
  // …
  map={mat}
/>
```
