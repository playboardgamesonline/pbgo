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

From `template/src/components/board/scene.tsx`, where `World` is what lies on the table and the surface is a colour, a lattice laid over it and a pool of light:

```tsx
export function Scene(props: SceneProps) {
  useCameraSettings()
  return (
    <Table camera={CAMERA} photo={PHOTO} surface={{ color: MAT_COLOR, layers: MAT_LAYERS, resolution: MAT_RESOLUTION, light: MAT_LIGHT }} held={props.held} onLoaded={props.onLoaded}>
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

The table the cards lie on is an endless surface: a colour and, if the game gives them, layers laid over it, which the table bakes into one picture that repeats. It has no edge and no horizon, and it is never an oval or a rectangle. Shared: `packages/table/src/table/surface.tsx`, with the layers in `mat.ts` and the numbers behind them in `mat-field.ts`; the component `Surface` is internal.

A mat is data, and each game gives its own: a colour, a pattern, a material, a picture of its own, a pool of light. The table owns the mechanism (baking the layers, repeating the picture over a plane wider than the camera sees, fading it into the colour with distance, adding the pool of light), so a change to it changes the table of every game at once, and a game owns the data, so its table is dressed as it likes. Set a mat below: pick a colour and a pattern, lay planks of wood over it with a blend, and light it.

```specimen
scene-mat
```

| Field of `SurfaceProps` | Role |
| --- | --- |
| `color` | The colour of the table, and of everything beyond it: the bottom of the mat, which the layers are laid over. With a picture on top, give the picture's average colour, or the fade shows as a haze |
| `layers` | What lies on the table, from the bottom up, each laid over what is below it: `MatLayer`s ([Layers](#layers)). The table bakes them once into one seamless picture |
| `resolution` | Pixels across the baked picture, a power of two (`MAT_SIZE`, 512, when not given): more for a picture with detail that is seen up close |
| `tile` | How many world units one repeat of the picture covers (`SURFACE_TILE` in `surface.tsx`, 2, when not given) |
| `light` | A pool of light on the table, as a vignette is ([A pool of light](#a-pool-of-light)): `{ color or center, radius, at, glow }` |
| `map` | Deprecated. A seamless picture the game made and repeats over the table: say `layers`, so that the table bakes the picture itself and the game paints none |

- Without layers, the surface is the colour the canvas is cleared to, not a shape in the scene. There is no edge to reach and no size to outgrow, so no camera sees an end of it: tilted to the horizon or pulled back (try both in [Camera](02-camera.md)), in the entrance or in the share photo.
- With layers, the picture covers a plane `REACH` times wider than the camera's `far` and fades into `color` with distance, from `FOG_START` of `far` to `far`. The fade is the scene's fog: keep `far` well past the cards, or they fade too.
- The surface lies under everything and takes no clicks ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)). The cards and the seats lie over it, a card at `RESTING_HEIGHT` ([Poses](05-poses-and-motion.md)).
- The surface is pushed back in the depth buffer (`POLYGON_OFFSET` in `surface.tsx`). It is one plane a thousand units wide, whose depth is not exact over such a size, and without the push what lies a hair above it, the plates of a board or the line of a zone, sank into it wherever the camera stood far from the table.
- A game may make its `layers` again on every render: the table keys the baked picture by what the layers say (`matKey`: the colour, the resolution, each layer's kind and parameters, a picture by the object it is) and bakes again only when that changed. The picture is let go when the mat is.
- **No table needs a grain**, and the default is none: a flat colour, a pool of light, at the most a pattern a hair off the colour. A grain's repeat is seen when its picture is narrower than the window: 256 texels of 0.85 px are 218 px on the screen, six repeats across a window, and a pattern shows, however fine it is. The mottling is slight and fine on purpose, since a coarse one reads as clouds laid on the table.
- Give `tile` a size that suits the camera, not a number picked by eye: a unit of the table is 120 px in a big window and 40 in a small one, so a tile in world units makes a speckle of 1 px in one and 3 px in the other. Ask for a texel of a pixel or so at the point the camera looks at (the resolution times that, over the pixels a unit is), and a fine pattern is as fine in every window.
- A board picture is a plane the game draws on the table. It has an edge, so it is the game's to place and to hide. A bounded mat with an edge, such as the playmat a card game has on its table, is a `Playmat` ([Playmat](#playmat)), which lies on the surface and rolls out.

### Layers

A layer says what it is with its `kind`. The table starts as its colour, and each layer is laid over what is below it, in order. Every layer must repeat with no seam, since the table is one repeat of the mat over and over: the lattice, the mosaic and the grain are made to, and a picture is the game's to give so.

| `kind` | Fields | What it lays |
| --- | --- | --- |
| `fill` | `color` | A flat colour over everything below. With the blend `multiply` it tints what is below with the colour and darkens it, with `screen` it lightens it |
| `lattice` | `line`, `diamonds`, `width` | Thin lines that cross at an angle, `diamonds` of them across one repeat, as a printed playing mat has. Keep `line` close to the colour of the mat (`#17171b` on `#0c0c0e`): a lattice that is seen is too loud for a table |
| `picture` | `picture`, `repeat` | A picture of the game's own: wood, stone, leather, cloth, as a texture it loaded or an image, a bitmap or a canvas. It is drawn `repeat` times across one repeat of the mat (default 1). It is the game's asset: the table makes none |
| `mosaic` | `cells`, `shade`, `crack`, `grain`, `seed` | A cracked-glass mosaic, `cells` across one repeat (default 9): each cell a hair lighter or darker than what is below (`shade`, a share of the colour) and a fine light crack along every border (`crack`), with a fine grain over it all (`grain`). Low, so that it reads as a surface and not as a pattern. It changes what is below it in place |
| `grain` | `strength`, `seed` | A felt-like grain: a fine speckle and a slow mottling that move the colour up or down. `strength` is 0 to 1, and 0.5 moves the finest speckle by about 6 % of the range. It changes what is below it in place |

Every layer takes an `opacity`, 0 to 1 (default 1): the share of it that is laid, or for a mosaic and a grain how strong the effect is. A `fill`, a `lattice` and a `picture` take a `blend`, how they are laid over what is below: `normal` covers it, `multiply` darkens it by the layer, `screen` lightens it, `overlay`, `soft-light` and `hard-light` deepen its darks and its lights by the layer's, `lighten` and `darken` keep the lighter or the darker of the two (`BLENDS`, the names of CSS's `mix-blend-mode`, which a canvas knows by the same names). Wood or leather over a pattern with `multiply` leaves the pattern showing through the grain of the picture; with `normal` it covers it.

Each layer is painted on a canvas of `resolution` pixels, the colour first, and the result is the texture that repeats (`bakeMat` of `mat.ts`, which is exported for a board that wants the picture itself). The numbers behind a layer are pure and tested without a canvas: the lines of the lattice, the cells of the mosaic and how a point lies in them (`mosaicAt`, which repeats every 1 across and down), the grain (`grainField`).

### A pool of light

A table that is lit at its middle and darker toward its edges, as a vignette makes it, is `light` of the `Surface`: a plane with a radial gradient that is **added** to the table (additive blending, no fog), laid a hair over it and under everything that stands on it, so the cards and the plates are not darkened and the picture of the table shows through everywhere alike.

| Field of `SurfaceLight` | Role |
| --- | --- |
| `color` | The light that is added at the middle, a dark colour: a mat of `#0c0c0e` lit with `#2c2c31` reads as dark grey in the middle and black at the edges. A light that is seen is a spotlight and no vignette |
| `center` | Instead of `color`: the colour the table has at the middle of the pool, which is what a game's settings say (`surface` in the middle, over `surfaceDark` beyond). The light is what it has more than the table's own colour, channel by channel (`lightBetween`) |
| `radius` | How far it reaches (`LIGHT_RADIUS`, 20, a little past the far seats of a table of eight) |
| `at` | Where its middle lies (the middle of the table) |
| `glow` | A faint wheel of colours that turns through the pool, `{ colors, strength }`: the colours go round once, the first given again at the end so that the circle closes, and `strength` (0.14 when not given) is how bright it is where it is brightest, low so that the cards stay the brightest colours of the table |

The falloff is smooth to nothing at the edge of the plane (`poolFalloff`), so the plane has no edge to see, and each level of the gradient is dithered by one level (`dithered`, `poolPixels`) so that its 8 bits do not band: a dark pool over a dark table is where the bands show, and where the eye looks. All of it is in `mat-field.ts`, tested in `mat-field.test.ts`.

## Playmat

A playmat is a bounded mat laid on the table: a rounded rectangle with a rim, a picture on its face and, over the picture, a cloth, that can be rolled up and roll out. It is the mat of a game that has one on its table, as a card game has its playmat, and the endless [Surface](#surface) is the cloth under it. Shared: `packages/table/src/table/playmat.tsx`, with what is pure (the clock of the roll-out, the roll of cloth, the blends) in `playmat-look.ts` and `playmat-look.test.ts`. The picture and the cloth are the game's own, as any picture of a table is: the table makes none.

```specimen
scene-playmat
```

| Prop of `PlaymatProps` | Role |
| --- | --- |
| `size` | `{ width, depth, radius? }` in world units: its width along x, its depth along z, and the radius of its corners (`PLAYMAT.rounding` of its shorter side when not given) |
| `frame` | Where it lies and which way it faces, a `Spot` (the middle, unturned, when not given). It rolls out from its left edge toward its right one, in its own frame |
| `picture` | The picture on its face, a texture of the game's, stretched over the whole playmat edge to edge. Null draws `color` |
| `color` | The colour of its face when it has no picture, which the roll of cloth takes too when `roller` says no other |
| `cloth` | `{ picture, blend?, strength?, tile? }`: a seamless colour picture repeated across the playmat and laid over the face's, with a blend (`PLAYMAT.blend`, soft light), how strongly (`PLAYMAT.strength`, 0.8) and how many world units one repeat covers (`PLAYMAT.tile`, 2, as the table's mat). Give `picture: null` while the cloth loads. It is read every frame, so a game can tune its blend and its strength live |
| `desaturate` | How much colour the picture is stripped of, 0 to 1 (0): a picture made for a screen is a touch loud for a table |
| `thickness` | The thickness of the rim, which is also how high the playmat lies above the table (`PLAYMAT.thickness`) |
| `unroll` | How it is: `rolled`, `unrolling` or `flat` (default). See below |
| `delay`, `duration` | Seconds it waits before it begins to roll out, and takes to do it (`PLAYMAT.delay` and `PLAYMAT.duration`) |
| `roller` | The colour of the roll of cloth at the front of the part that has rolled out (the colour of the face when not given) |
| `onUnrolled` | Called once when a roll-out ends |

- **Rolling out.** `rolled` holds the playmat at nothing, still rolled up and waiting: a roll lies at its left edge. `unrolling` rolls it out toward the right and then leaves it out: it waits `delay`, goes fast at first and slows as it settles (a cubic ease-out, `unrollProgress`), and the roll of cloth at its front shrinks as the cloth is let out (`rollerAt`). `flat` is laid out. A board holds it `rolled` while its start screen is up, asks `unrolling` when its opening begins and `flat` once the opening is over. The clock starts the first time the playmat is asked to roll out, whatever the time of the page, and begins again after a `rolled` (`unrollClock`). A visitor who asks for less motion gets a playmat that is asked to roll out laid flat at once, and `onUnrolled` is called at once for them, so that the opening goes on.
- **Cut, not folded.** What is not yet rolled out is cut away: the picture is discarded beyond the share that has rolled out, and the rim with it. The roll of cloth is a cylinder along the depth of the playmat, whose size is a share of that depth, so a small playmat has a small roll. It is unlit like the rest of the table, and shaded by a gradient painted round it (bright on top, dark where the cloth turns away), so it reads as a roll on a board that has no lights.
- **The cloth.** The cloth is laid over the face in the shader, per pixel, in the space the screen shows (`blendCloth`), with one blend for each of the table's `BLENDS` (normal, multiply, screen, overlay, soft light, hard light, lighten, darken), whose formulas are also in `blendChannel` for a test or a reader. Soft light is the formula of Pegtop, smooth where the W3C's has a corner, as the playmat of Courtisans has always been laid: the mat of the surface bakes its layers with the canvas's blends, which are the W3C's, so one name is a hair apart between the two.
- **The rim.** It is the thickness of the playmat, extruded from its outline, and it reads the border of the picture, so it is the colour of the edge of the playmat and rolls out with it.
- **What lies under and on it.** The playmat lies at `thickness` above the table and under what is on it: a card lies at `RESTING_HEIGHT`, higher than the rim of a playmat of the usual thickness. The pool of light of the surface is drawn under it and does not light it: a game that wants the playmat lit paints the light in its picture. It takes no click: the playmat is the table's, and what lies on it is the game's.
- **Pictures.** The picture and the cloth are sRGB colour textures. The table copies the cloth, so the game's texture keeps its wrapping, and lets the copy go with the playmat; a face with no picture is its colour, as a picture of one texel.

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
