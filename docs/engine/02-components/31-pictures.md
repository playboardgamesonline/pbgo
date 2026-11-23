# Pictures

A **picture** is a flat image that lies on the table: a sticker, a stamp, a sign, an arrow, a soft disc under a number. The game gives the texture and the width; the table lays it flat, unlit and not tone mapped like everything on it, over the mat and under the lettering that comes in at the end, and takes no press and no pointer from it. A picture that comes onto the table is put in an `Appear` or a `Stamp` ([Staging](30-staging.md)).

Press "Land it": the sticker thumps down onto the table. The sliders change how wide it is and which way it faces.

```specimen
scene-picture
```

## Picture

Shared: `packages/table/src/floor/picture.tsx`, with the pure `pictureAspect` and `PICTURE` in `picture-look.ts` (tested in `picture-look.test.ts`).

| Prop of `PictureProps` | Role |
| --- | --- |
| `texture` | The picture: a texture whose transparent parts are cut out |
| `width` | How wide it lies, in world units |
| `aspect` | Its proportions, width over height: those of the image the texture holds, and a square when it holds none. A picture that must be stretched to a shape says it |
| `at` | `{ x, z }`: where it lies, in the frame it is put in (the origin of that frame when not given) |
| `lift` | How high it lies above that plane (0) |
| `yaw` | Its turn about the vertical axis, in radians (0) |
| `order` | What it is drawn after, its `renderOrder`: `PICTURE.order`, 4, over the mat and what lies flat on it |
| `opacity` | How much of it shows, 0 to 1 (1) |
| `color` | A colour the picture is multiplied by: a white picture takes it whole, as a tinted disc does. Not given, the picture is as it is |

- **It is a plane with the texture** and nothing else: no light, no tone mapping, no shadow, and no depth written, so its transparent edge never hides what lies under it. It takes the `raycast` away, so a press goes through it to what lies under.
- **It is cut out by the alpha of its texture.** A soft disc is a picture whose texture fades to nothing at its edge, tinted by `color`; a game that needs a round shape, or any other, paints it into the texture.
- **The texture is the game's.** It is painted on a canvas (`paintFace`, a `CanvasTexture`) or comes from the game's Sanity project, as the stickers of Flip 7 and the arrows of Courtisans do. The table paints none for it.
- **To fade it in**, put it in an `Appear`, which fades its material and brings it down; **to thump it down**, put it in a `Stamp`.

## Limits

- A picture lies flat. One that stands up or follows the camera is not a picture of the table.
- One texture, one plane: a picture made of several is several pictures.
