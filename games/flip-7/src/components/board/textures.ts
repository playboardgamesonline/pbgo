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
 * The pool of light the table is lit by, painted once for a pair of colours: how much lighter `inner` is than `outer`, in the middle, falling away to nothing at the edge, to be ADDED to the table (additive blending): `outer` is the colour of the endless table, so
 * the pool is `inner` in the middle and the table's own colour, grain and all, at its edge, with no line between the two. Both come from the game's settings (`surface` and `surfaceDark`), so changing them in the gamemaster changes the mat.
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
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, `rgb(${r},${g},${b})`)
  gradient.addColorStop(0.3, `rgb(${r},${g},${b})`)
  gradient.addColorStop(1, "rgb(0,0,0)")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  mats.set(id, texture)
  return texture
}
