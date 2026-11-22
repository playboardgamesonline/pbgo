import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from "three"
import { grainField, seeded } from "./grain-field"
import { latticeLines, mosaicAt, mosaicPoints } from "./mat-field"

// The mat of a table as data. A game says its colour and what lies on it, layer by layer, from the bottom up; the table bakes that once into the seamless picture that repeats over the whole table (`Surface`). The numbers behind each layer are pure and
// tested in `mat-field.ts`; the painting is a canvas, so it is done in the browser only, once for each mat.

/** How a layer is laid over what lies below it. The names are those of CSS's `mix-blend-mode`: `multiply` tints what is below with the layer and darkens it, `screen` lightens it, `overlay` and `soft-light` deepen the darks and the lights of what is below by the layer's, and `normal` covers it */
export const BLENDS = ["normal", "multiply", "screen", "overlay", "soft-light", "hard-light", "lighten", "darken"] as const
export type Blend = (typeof BLENDS)[number]

/** The name a canvas gives a blend: `normal` is `source-over` and the others keep their name */
export function compositeOf(blend: Blend): GlobalCompositeOperation {
  return blend === "normal" ? "source-over" : blend
}

/** What a game draws a picture from: a texture it loaded, or an image, a bitmap or a canvas */
export type MatSource = Texture | CanvasImageSource

type Laid = {
  /** How the layer is laid over what lies below it (default `normal`). A layer that changes what is below it in place, the mosaic and the grain, takes none */
  blend?: Blend
  /** How strongly, 0 to 1 (default 1): the share of the layer that is laid, or for the mosaic and the grain how strong the effect is */
  opacity?: number
}

/** One layer of a mat. The table starts as its colour and each layer is laid over what is below it, in order. Every layer must repeat with no seam: the table is one repeat of the mat over and over */
export type MatLayer =
  /** A flat colour over everything below: with `multiply` it tints it, with `screen` it lightens it */
  | ({ kind: "fill"; color: string } & Laid)
  /** Thin lines that cross at an angle, as a printed playing mat has: a lattice of diamonds, `diamonds` across one repeat. Keep `line` close to the colour of the mat: a lattice that is seen is too loud for a table */
  | ({ kind: "lattice"; line: string; diamonds?: number; width?: number } & Laid)
  /** A picture of the game's own: wood, stone, leather, cloth. It must repeat with no seam, and it is drawn `repeat` times across one repeat of the mat (default 1) */
  | ({ kind: "picture"; picture: MatSource; repeat?: number } & Laid)
  /** A cracked-glass mosaic: `cells` across one repeat (default 9), each cell a hair lighter or darker than what is below (`shade`) and a fine light crack along every border (`crack`), with a fine grain over it all (`grain`), each a share of the colour. Low, so that it reads as a surface and not as a pattern */
  | { kind: "mosaic"; cells?: number; shade?: number; crack?: number; grain?: number; seed?: number; opacity?: number }
  /** A felt-like grain: a fine speckle and a slow mottling that move the colour up or down, `strength` 0 to 1 (default 0.5, the finest speckle moving a dark colour by about 6 % of the range). A table need not have one */
  | { kind: "grain"; strength?: number; seed?: number; opacity?: number }

/** Pixels across the picture a mat is baked to unless told otherwise: one repeat of the mat */
export const MAT_SIZE = 512

const clamp = (n: number) => Math.min(1, Math.max(0, n))

let nextId = 1
const ids = new WeakMap<object, number>()

/** What tells one picture from another in a `matKey`: a texture's own id, else a number for the object, the same for the same object */
function pictureId(picture: object): string {
  if ("uuid" in picture && typeof picture.uuid === "string") return picture.uuid
  let id = ids.get(picture)
  if (id === undefined) {
    id = nextId++
    ids.set(picture, id)
  }
  return `#${id}`
}

/** A string that is the same for the same mat and different for another, which a table keys its baked picture by: a game may make its `layers` again on every render and the picture is made again only when they changed */
export function matKey(color: string, layers: readonly MatLayer[], size: number = MAT_SIZE): string {
  return JSON.stringify([color, size, layers.map((layer) => (layer.kind === "picture" ? { ...layer, picture: pictureId(layer.picture) } : layer))])
}

/** The picture a source is: a texture's own, or the source itself */
const imageOf = (picture: MatSource): CanvasImageSource => ("isTexture" in picture ? (picture.image as CanvasImageSource) : picture)

/** Lays what `draw` paints over the canvas with the layer's blend and opacity */
function laid(ctx: CanvasRenderingContext2D, { blend = "normal", opacity = 1 }: Laid, draw: () => void) {
  ctx.save()
  ctx.globalAlpha = clamp(opacity)
  ctx.globalCompositeOperation = compositeOf(blend)
  draw()
  ctx.restore()
}

/** A canvas of the repeat's size, for what must be painted whole before it is laid, so that the crossings of a lattice's lines are not blended twice */
function scratch(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  return [canvas, canvas.getContext("2d")!]
}

function paint(ctx: CanvasRenderingContext2D, size: number, layer: MatLayer) {
  switch (layer.kind) {
    case "fill":
      laid(ctx, layer, () => {
        ctx.fillStyle = layer.color
        ctx.fillRect(0, 0, size, size)
      })
      return
    case "lattice": {
      const [canvas, lines] = scratch(size)
      lines.strokeStyle = layer.line
      lines.lineWidth = layer.width ?? 2
      for (const { from, to } of latticeLines(size, layer.diamonds ?? 3)) {
        lines.beginPath()
        lines.moveTo(from[0], from[1])
        lines.lineTo(to[0], to[1])
        lines.stroke()
      }
      laid(ctx, layer, () => ctx.drawImage(canvas, 0, 0))
      return
    }
    case "picture": {
      const times = Math.max(1, Math.round(layer.repeat ?? 1))
      const source = imageOf(layer.picture)
      const step = size / times
      laid(ctx, layer, () => {
        for (let i = 0; i < times; i++) for (let j = 0; j < times; j++) ctx.drawImage(source, i * step, j * step, step, step)
      })
      return
    }
    case "mosaic": {
      const cells = Math.max(1, Math.round(layer.cells ?? 9))
      const [shade, crack, grain] = [layer.shade ?? 0.05, layer.crack ?? 0.06, layer.grain ?? 0]
      const amount = clamp(layer.opacity ?? 1)
      const seed = layer.seed ?? 20_240_101
      const points = mosaicPoints(cells, seed)
      const random = seeded(seed + 1)
      const image = ctx.getImageData(0, 0, size, size)
      for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
          const field = mosaicAt(points, cells, px / size, py / size)
          const lift = 1 + (field.shade * shade + (random() * 2 - 1) * grain) * amount
          const light = field.crack * crack * 255 * amount
          const o = (py * size + px) * 4
          image.data[o] = Math.min(255, image.data[o]! * lift + light)
          image.data[o + 1] = Math.min(255, image.data[o + 1]! * lift + light)
          image.data[o + 2] = Math.min(255, image.data[o + 2]! * lift + light)
        }
      }
      ctx.putImageData(image, 0, 0)
      return
    }
    case "grain": {
      const field = grainField(size, layer.seed ?? 7)
      const strength = (layer.strength ?? 0.5) * clamp(layer.opacity ?? 1)
      const image = ctx.getImageData(0, 0, size, size)
      for (let i = 0; i < size * size; i++) {
        const shift = field[i]! * strength * 255 * 0.5
        const o = i * 4
        image.data[o] = image.data[o]! + shift
        image.data[o + 1] = image.data[o + 1]! + shift
        image.data[o + 2] = image.data[o + 2]! + shift
      }
      ctx.putImageData(image, 0, 0)
    }
  }
}

/**
 * Bakes a mat into the picture that repeats over the table: a canvas of `size` pixels square (a power of two), the colour first, then each layer laid over it in order, as a texture that wraps with no seam. Give it to `Surface` through its `layers`,
 * which does this once for each mat and lets the picture go when the mat does; it is exported for a board that wants the picture itself.
 */
export function bakeMat(color: string, layers: readonly MatLayer[], size: number = MAT_SIZE): CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)
  for (const layer of layers) paint(ctx, size, layer)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.minFilter = LinearMipmapLinearFilter
  texture.anisotropy = 8
  return texture
}
