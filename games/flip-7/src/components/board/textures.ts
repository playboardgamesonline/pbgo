"use client"

import { missing } from "@pbgo/core/lib/missing"
import { type CardSize, faceResolution, standIn } from "@pbgo/table"
import { use } from "react"
import { CanvasTexture, SRGBColorSpace, type Texture } from "three"
import type { ClientCatalog } from "../../lib/catalog"
import { CARD } from "./layout"

/** Width and height of a card in world units: the same for every card of the game (the faces of Sanity are 326 by 512) */
export const CARD_SIZE: CardSize = CARD

/** Pixels across a face. The faces are SVG files, drawn at this size, so a card stays sharp however big it is on the screen, and the memory it costs stays small */
const ACROSS = 640

/** A picture of Sanity painted on a canvas, null when it cannot be loaded: the card then shows a stand-in with the key of what is missing, never a blank. */
async function paint(url: string): Promise<Texture | null> {
  try {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.src = url
    await image.decode()
    const { width, height } = faceResolution(CARD_SIZE, ACROSS)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    canvas.getContext("2d")!.drawImage(image, 0, 0, width, height)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    return texture
  } catch (error) {
    console.error(`[textures] ${url} could not be loaded`, error)
    return null
  }
}

/** A sticker: a picture with its own proportions, painted on a canvas as wide as `STICKER_ACROSS` and as tall as the picture is, with nothing behind it. `aspect` is its width over its height */
export type StickerPicture = { texture: Texture; aspect: number }

/** Pixels across a sticker. The two of them are SVG files, drawn at this size: sharp from a few cards wide to a few more */
const STICKER_ACROSS = 1024

/** A sticker of Sanity painted at its own proportions, null when it cannot be loaded: nothing is drawn then. */
async function paintSticker(url: string): Promise<StickerPicture | null> {
  try {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.src = url
    await image.decode()
    const aspect = image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 1.6
    const canvas = document.createElement("canvas")
    canvas.width = STICKER_ACROSS
    canvas.height = Math.round(STICKER_ACROSS / aspect)
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    return { texture, aspect }
  } catch (error) {
    console.error(`[textures] ${url} could not be loaded`, error)
    return null
  }
}

type Pictures = { faces: Record<string, Texture | null>; back: Texture | null; stickers: { bust: StickerPicture | null; bonus: StickerPicture | null } }

const loading = new Map<string, Promise<Pictures>>()

/** The pictures of a catalog, loaded once for the page: the same catalog asked for again gets the promise it had. */
function load({ faces, backUrl, bustUrl, bonusUrl }: ClientCatalog): Promise<Pictures> {
  const key = JSON.stringify([faces, backUrl, bustUrl, bonusUrl])
  let promise = loading.get(key)
  if (!promise) {
    promise = (async () => {
      const entries = await Promise.all(Object.entries(faces).map(async ([card, url]) => [card, url ? await paint(url) : null] as const))
      const [back, bust, bonus] = await Promise.all([backUrl ? paint(backUrl) : null, bustUrl ? paintSticker(bustUrl) : null, bonusUrl ? paintSticker(bonusUrl) : null])
      return { faces: Object.fromEntries(entries), back, stickers: { bust, bonus } }
    })()
    loading.set(key, promise)
  }
  return promise
}

export type Faces = {
  /** The texture of the face of a card, by its key in the engine's catalogue: its picture from Sanity, or a stand-in that says `[missing: <key>]` */
  face: (key: string) => Texture
  /** The back of every card: the picture of the `game` document, or a stand-in that says `[missing: card back]` */
  back: Texture
  /** The two stickers that lie on the table over a line: the BUST! stamp and the "+15 point bonus" badge, each null while the `game` document has none (nothing is drawn then) */
  stickers: { bust: StickerPicture | null; bonus: StickerPicture | null }
}

/**
 * The faces and the back of the cards, and the two stickers, from the pictures of the catalog. It suspends until they are all in, so the `Table` reports itself loaded (`onLoaded`) once the cards can be drawn: nothing shows a card half drawn.
 * Every picture Sanity does not have shows as a stand-in with its key on it, so the gap stays in sight.
 */
export function useFaces(catalog: ClientCatalog): Faces {
  const pictures = use(load(catalog))
  return {
    face: (key) => pictures.faces[key] ?? standIn(key, CARD_SIZE, { label: missing(key) }),
    back: pictures.back ?? standIn("back", CARD_SIZE, { label: missing("card back") }),
    stickers: pictures.stickers,
  }
}

const mats = new Map<string, Texture>()

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** A number between 0 and 1 for each whole number, the same on every client: a hash, not `Math.random` */
const unit = (n: number) => {
  let h = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * A colour level rounded up or down by chance, in proportion to what it has after the point (12.3 is 13 three times in ten): the levels of a gradient that is painted in 8 bits then step by a level here and there instead of all along a line, and
 * the gradient shows no bands. The change is of one level, 0.4 % of the range, which no eye sees as a grain.
 */
export const dithered = (level: number, index: number) => Math.floor(level + unit(index))

/** How much of its light the pool has at a share `t` of its radius, from the middle (0) to the edge (1): all of it in the middle, easing away to nothing at the edge, with no flat part and no knee, so the pool has no rim to be seen */
export const poolLight = (t: number) => {
  const c = Math.min(1, Math.max(0, t))
  return 1 - c * c * (3 - 2 * c)
}

/**
 * The pool of light the table is lit by, painted once for a pair of colours: how much lighter `inner` is than `outer`, in the middle, falling away to nothing at the edge, to be ADDED to the table (additive blending): `outer` is the colour of the endless table, so
 * the pool is `inner` in the middle and the table's own colour, grain and all, at its edge, with no line between the two (`poolLight`). Both come from the game's settings (`surface` and `surfaceDark`), so changing them in the gamemaster changes the mat.
 */
export function matTexture(inner: string, outer: string): Texture {
  const id = `${inner}|${outer}`
  const kept = mats.get(id)
  if (kept) return kept
  const size = 512
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  const [r, g, b] = channels(inner).map((value, i) => Math.max(0, value - channels(outer)[i]!))
  const image = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const light = poolLight(Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2))
      const o = (y * size + x) * 4
      image.data[o] = dithered(r * light, o)
      image.data[o + 1] = dithered(g * light, o + 1)
      image.data[o + 2] = dithered(b * light, o + 2)
      image.data[o + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  mats.set(id, texture)
  return texture
}
