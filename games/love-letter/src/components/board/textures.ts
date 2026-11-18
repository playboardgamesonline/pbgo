"use client"

import { CHARACTER_KEYS, type CharacterKey } from "@love-letter/engine"
import { missing } from "@pbgo/core/lib/missing"
import { type CardSize, PLATE_FONT, paintFace, standIn, TABLE_FONT } from "@pbgo/table"
import { use } from "react"
import type { Texture } from "three"
import type { ClientCatalog } from "../../lib/catalog"
import { CARD } from "./layout"
import { FACE, LINE_HEIGHT, NAME_PLATE, setName, setText, textPlateOf } from "./lettering"

/** The size of a card of the game in world units: the same for every card (the faces of Sanity are 760 by 1060) */
export const CARD_SIZE: CardSize = CARD

/** Pixels across a face: the size of the pictures, so that the lettering drawn over them is as sharp as they are */
const ACROSS = FACE.width

/** How the lettering of a face is set: the fonts of the name and of the text (the family names of the settings' fonts, each with its fallback), and the ink */
export type FaceStyle = { nameFont: string | undefined; textFont: string | undefined; ink: string }

/** A picture of Sanity decoded, null when it cannot be loaded: the card then shows a stand-in with the key of what is missing, never a blank. */
async function decode(url: string): Promise<HTMLImageElement | null> {
  try {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.src = url
    await image.decode()
    return image
  } catch (error) {
    console.error(`[textures] ${url} could not be loaded`, error)
    return null
  }
}

/** A number for a text, the same on every client: a hash of its characters (to key a texture by everything its picture depends on) */
const hashOf = (text: string) => {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** The fonts of the lettering loaded, so that a fallback is never frozen into a texture: the page declares the families, and nothing asks for them until a canvas does. A font that cannot be loaded is a fallback, never an error. */
async function loadFonts({ nameFont, textFont }: Required<FaceStyle>) {
  const ask = (font: string) => Promise.resolve(document.fonts?.load(font)).catch(() => null)
  await Promise.all([ask(`700 40px ${nameFont}`), ask(`500 40px ${textFont}`)])
}

/** A face painted: the picture over the whole rectangle (the card's shape cuts the corners), then the name centred in its banner and the card text centred in its plate, the lettering set smaller when it overflows. */
function drawFace(g: CanvasRenderingContext2D, width: number, image: HTMLImageElement, key: CharacterKey, catalog: ClientCatalog, style: Required<FaceStyle>) {
  g.drawImage(image, 0, 0, width, (width * FACE.height) / FACE.width)
  // the plates are measured in pixels of the 760 by 1060 pictures: `k` takes them to the canvas
  const k = width / FACE.width
  g.fillStyle = style.ink
  g.textAlign = "center"

  const name = catalog.names[key]
  const nameAt = (size: number) => {
    g.font = `700 ${size * k}px ${style.nameFont}`
    return (text: string) => g.measureText(text).width / k
  }
  const { size: nameSize } = setName(name, NAME_PLATE, nameAt)
  g.font = `700 ${nameSize * k}px ${style.nameFont}`
  g.textBaseline = "alphabetic"
  const ink = g.measureText(name)
  // the ink is centred in the banner, not the em box: capitals sit above the baseline and have no descender
  g.fillText(name, (NAME_PLATE.x + NAME_PLATE.width / 2) * k, (NAME_PLATE.y + NAME_PLATE.height / 2) * k + (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2)

  const plate = textPlateOf(key)
  const textAt = (size: number) => {
    g.font = `500 ${size * k}px ${style.textFont}`
    return (text: string) => g.measureText(text).width / k
  }
  const setting = setText(catalog.texts[key], plate, textAt)
  g.font = `500 ${setting.size * k}px ${style.textFont}`
  g.textBaseline = "middle"
  setting.lines.forEach((line, i) => g.fillText(line, (plate.x + plate.width / 2) * k, (plate.y + plate.height / 2 + (i - (setting.lines.length - 1) / 2) * setting.size * LINE_HEIGHT) * k))
}

type Pictures = { faces: Record<CharacterKey, Texture | null>; back: Texture | null }

const loading = new Map<string, Promise<Pictures>>()

/** The pictures of a catalog, loaded and lettered once for the page: the same catalog asked for again, with the same lettering, gets the promise it had. */
function load(catalog: ClientCatalog, style: FaceStyle): Promise<Pictures> {
  const full: Required<FaceStyle> = { nameFont: style.nameFont ?? PLATE_FONT, textFont: style.textFont ?? TABLE_FONT, ink: style.ink }
  const id = hashOf(JSON.stringify([catalog.faces, catalog.names, catalog.texts, catalog.backUrl, full]))
  let promise = loading.get(id)
  if (!promise) {
    promise = (async () => {
      await loadFonts(full)
      const faces = Object.fromEntries(
        await Promise.all(
          CHARACTER_KEYS.map(async (key) => {
            const url = catalog.faces[key]
            const image = url ? await decode(url) : null
            return [key, image ? paintFace(`face:${key}:${id}`, CARD_SIZE, (g, width) => drawFace(g, width, image, key, catalog, full), ACROSS) : null] as const
          }),
        ),
      ) as Record<CharacterKey, Texture | null>
      const backImage = catalog.backUrl ? await decode(catalog.backUrl) : null
      const back = backImage ? paintFace(`back:${hashOf(catalog.backUrl!)}`, CARD_SIZE, (g, width, height) => g.drawImage(backImage, 0, 0, width, height), ACROSS) : null
      return { faces, back }
    })()
    loading.set(id, promise)
  }
  return promise
}

export type Faces = {
  /** The texture of the face of a character, by its key in the engine's catalogue: its picture from Sanity with its name and its text drawn over it, or a stand-in that says `[missing: …]` */
  face: (key: CharacterKey) => Texture
  /** The canvas a face is painted on, which the lens of the screen draws again at the size of the page: the same face, lettering and all */
  source: (key: CharacterKey) => HTMLCanvasElement
  /** The back of every card: the picture of the `game` document, or a stand-in that says `[missing: card back]` */
  back: Texture
}

/**
 * The faces and the back of the cards, from the pictures of the catalog and its texts. It suspends until they are all in, so the `Table` reports itself loaded (`onLoaded`) once the cards can be drawn: nothing shows a card half drawn.
 * Every picture Sanity does not have shows as a stand-in with its key on it, so the gap stays in sight.
 */
export function useFaces(catalog: ClientCatalog, style: FaceStyle): Faces {
  const pictures = use(load(catalog, style))
  const face = (key: CharacterKey) => pictures.faces[key] ?? standIn(key, CARD_SIZE, { label: missing(`characters.${key}.image`) })
  return {
    face,
    source: (key) => face(key).image as HTMLCanvasElement,
    back: pictures.back ?? standIn("back", CARD_SIZE, { label: missing("card back") }),
  }
}
