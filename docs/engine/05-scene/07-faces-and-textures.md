# Faces and textures

A card shows two textures, and the package paints them. `paintFace` paints any face or back on a canvas, and `standIn` paints the plain face a card shows while its picture is missing. Shared: `packages/table/src/card/face.ts`.

| Name | Role |
| --- | --- |
| `CardSize` | `{ width, height, radius? }` in world units, the same for every card of a game. The corners are rounded to a share of the smaller side unless `radius` is set |
| `paintFace(key, size, draw, across?)` | Paints a face or a back once for a key and a size. `draw(g, width, height)` gets the 2D context and the canvas size in pixels, and paints the whole rectangle: the card's shape cuts the rounded corners |
| `faceResolution(size, across?)` | The canvas size in pixels for a card size: `across` wide, as high as the proportions ask |
| `standIn(key, size, options?)` | A plain face, still a texture on the card. `StandIn` holds its options: `color`, a neutral paper by default, and `label`, written across the middle |

## Rules

- The same key at the same size and resolution gives back the same texture, painted once and kept. Put in the key everything the picture depends on: a card's id for its face, the colours for a back.
- Textures are sRGB, with anisotropic filtering.
- A missing picture is never a DOM card and never a blank: pass `standIn` the label `[missing: <key>]`, so the gap stays visible. A game's pictures come from its Sanity project; the template, a demo, paints its faces in code.
- `across` is a width in pixels. The default is sharp at the size a card has on screen and light on memory.
- The shine, the shadow, the halo and the sparkle are textures the package generates itself (`card/textures.ts`, internal).

From `template/src/components/board/textures.ts`, a face painted for each card:

```ts
export function faceTexture(card: Card): Texture {
  const { bg, ink, symbol } = CARD_STYLES[card.color]
  return paintFace(card.id, CARD_SIZE, (ctx, w, h) => {
    // …
  })
}
```
