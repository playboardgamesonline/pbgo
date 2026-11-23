"use client"

import { missing } from "@pbgo/core/lib/missing"
import { type CardSize, faceResolution, type MatLayer, standIn, type SurfaceProps } from "@pbgo/table"
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

/** What lies on the colour of the mat: the cracked-glass mosaic of the card back, low in contrast so that the cards and the plates keep theirs. The table bakes it once into the picture that repeats over it */
const MAT_LAYERS: readonly MatLayer[] = [{ kind: "mosaic", ...MOSAIC }]

/** How many world units one repeat of the mosaic covers: nine cells across, so a cell is about half a world unit, a bit more than a card's width */
const MAT_TILE = 5

/** How far the pool of light spreads, in world units: past it the table is the plain colour it fades into */
const MAT_LIGHT_RADIUS = 22

/**
 * The mat the table lies on, as data for the shared `Table`: the dark end of the rainbow of the card back, a deep indigo felt (`surfaceDark` of the game's settings) under the mosaic, lit in the middle by a pool of the violet of `surface` with the faint rainbow
 * of the card back (`RAINBOW`) turning through it. The colours are the settings', so changing them in the gamemaster changes the mat.
 */
export const matOf = ({ surface, surfaceDark }: { surface: string; surfaceDark: string }): SurfaceProps => ({
  color: surfaceDark,
  layers: MAT_LAYERS,
  tile: MAT_TILE,
  light: { center: surface, radius: MAT_LIGHT_RADIUS, glow: { colors: RAINBOW, strength: GLOW_STRENGTH } },
})
