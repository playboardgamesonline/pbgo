"use client"

import { missing } from "@pbgo/core/lib/missing"
import { type CardSize, faceResolution, standIn } from "@pbgo/table"
import { use } from "react"
import { CanvasTexture, SRGBColorSpace, type Texture } from "three"
import type { ClientCatalog } from "../../lib/catalog"
import { GLOW_STRENGTH, MOSAIC, RAINBOW } from "../../lib/palette"
import { CARD } from "./layout"

/** Width and height of a card in world units: the same for every card of the game (the faces of Sanity are 296 by 476) */
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

type Pictures = { faces: Record<string, Texture | null>; back: Texture | null }

const loading = new Map<string, Promise<Pictures>>()

/** The pictures of a catalog, loaded once for the page: the same catalog asked for again gets the promise it had. */
function load({ faces, backUrl }: ClientCatalog): Promise<Pictures> {
  const key = JSON.stringify([faces, backUrl])
  let promise = loading.get(key)
  if (!promise) {
    promise = (async () => {
      const entries = await Promise.all(Object.entries(faces).map(async ([card, url]) => [card, url ? await paint(url) : null] as const))
      return { faces: Object.fromEntries(entries), back: backUrl ? await paint(backUrl) : null }
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
}

/**
 * The faces and the back of the cards, from the pictures of the catalog. It suspends until they are all in, so the `Table` reports itself loaded (`onLoaded`) once the cards can be drawn: nothing shows a card half drawn.
 * Every picture Sanity does not have shows as a stand-in with its key on it, so the gap stays in sight.
 */
export function useFaces(catalog: ClientCatalog): Faces {
  const pictures = use(load(catalog))
  return {
    face: (key) => pictures.faces[key] ?? standIn(key, CARD_SIZE, { label: missing(key) }),
    back: pictures.back ?? standIn("back", CARD_SIZE, { label: missing("card back") }),
  }
}

const mats = new Map<string, Texture>()

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/**
 * The pool of light the table is lit by, painted once for a pair of colours: how much lighter `inner` is than `outer`, in the middle, falling away to nothing at the edge, with the rainbow of the card back (`RAINBOW`) turning faintly through it, to be ADDED to the
 * table (additive blending): `outer` is the colour of the endless table, so the pool is `inner` in the middle and the table's own colour, texture and all, at its edge, with no line between the two. Both come from the game's settings (`surface` and
 * `surfaceDark`), so changing them in the gamemaster changes the mat.
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
  const pool = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  pool.addColorStop(0, `rgb(${r},${g},${b})`)
  pool.addColorStop(0.3, `rgb(${r},${g},${b})`)
  pool.addColorStop(1, "rgb(0,0,0)")
  ctx.fillStyle = pool
  ctx.fillRect(0, 0, size, size)
  // the rainbow: a conic gradient, kept to the middle by a radial mask and dimmed to `GLOW_STRENGTH`
  const glow = document.createElement("canvas")
  glow.width = glow.height = size
  const g2 = glow.getContext("2d")!
  const cone = g2.createConicGradient(-Math.PI / 2, size / 2, size / 2)
  RAINBOW.forEach((hue, i) => cone.addColorStop(i / (RAINBOW.length - 1), hue))
  g2.fillStyle = cone
  g2.fillRect(0, 0, size, size)
  g2.globalCompositeOperation = "destination-in"
  const mask = g2.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  mask.addColorStop(0, `rgba(0,0,0,${GLOW_STRENGTH})`)
  mask.addColorStop(0.45, `rgba(0,0,0,${GLOW_STRENGTH * 0.7})`)
  mask.addColorStop(1, "rgba(0,0,0,0)")
  g2.fillStyle = mask
  g2.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = "lighter"
  ctx.drawImage(glow, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  mats.set(id, texture)
  return texture
}

const felts = new Map<string, Texture>()

/** A small deterministic generator, so that the felt is the same on every client and every load */
function sequence(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

/**
 * The felt of the table: a cracked-glass mosaic (a Voronoi diagram with a jittered point in each cell of a grid, wrapping at the edges so that the texture repeats without a seam), each cell a hair lighter or darker than the base and a fine light crack along
 * every border, with a fine grain over it all. Painted in code once for a colour, 512 pixels square, low in contrast: the cards and the plates keep theirs. One repeat of it covers `MOSAIC.cells` cells across.
 */
export function feltTexture(base: string): Texture {
  const kept = felts.get(base)
  if (kept) return kept
  const size = 512
  const cells = MOSAIC.cells
  const random = sequence(20_240_101)
  const points = Array.from({ length: cells * cells }, (_, i) => ({ x: ((i % cells) + 0.15 + 0.7 * random()) / cells, y: (Math.floor(i / cells) + 0.15 + 0.7 * random()) / cells, shade: random() * 2 - 1 }))
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  const image = ctx.createImageData(size, size)
  const [br, bg, bb] = channels(base)
  const wrapped = (d: number) => d - Math.round(d)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = px / size
      const y = py / size
      const cx = Math.floor(x * cells)
      const cy = Math.floor(y * cells)
      let first = Infinity
      let second = Infinity
      let shade = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const point = points[((cy + dy + cells) % cells) * cells + ((cx + dx + cells) % cells)]!
          const distance = Math.hypot(wrapped(x - point.x), wrapped(y - point.y))
          if (distance < first) {
            second = first
            first = distance
            shade = point.shade
          } else if (distance < second) second = distance
        }
      }
      // how close the pixel is to a border: the gap between the nearest point and the next, in cell widths
      const crack = Math.max(0, 1 - ((second - first) * cells) / 0.09)
      const grain = (random() * 2 - 1) * MOSAIC.grain
      const lift = 1 + shade * MOSAIC.shade + grain
      const light = crack * MOSAIC.crack * 255
      const i = (py * size + px) * 4
      image.data[i] = Math.min(255, br * lift + light)
      image.data[i + 1] = Math.min(255, bg * lift + light)
      image.data[i + 2] = Math.min(255, bb * lift + light)
      image.data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  felts.set(base, texture)
  return texture
}
