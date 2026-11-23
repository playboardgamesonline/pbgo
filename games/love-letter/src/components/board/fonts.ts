import { type SettingsFiles, UPLOADED_BODY_FONT, UPLOADED_TITLE_FONT } from "@pbgo/core/lib/settings"
import { PLATE_FONT, TABLE_FONT } from "@pbgo/table"

/** The weight of every lettering lying on the table (the names and the lines of the plates, the pads, the count of the deck, the sentences) */
export const TABLE_WEIGHT = 700

/** The settings that name the fonts: a font of the platform's list (Google Fonts) or a file uploaded to the game's Sanity project, the file winning, as everywhere in the platform */
export type FontSettings = { bodyFont: string | null; displayFont: string | null; files: Pick<SettingsFiles, "fontBody" | "fontDisplay"> }

/** The fonts of the lettering of the table: one for the names, the pads and the counts (the display font), one for the sentences (the body font). Each is `undefined` for a game that set no font, so that the table keeps its own */
export type TableFonts = { display: string | undefined; body: string | undefined }

/** The family the page declares for a font: the uploaded file under the platform's name for it, else the font of the list by its own name, else none */
const familyOf = (uploaded: boolean, upload: string, named: string | null) => (uploaded ? upload : named)

/**
 * The fonts the lettering on the table is drawn in, from the settings (`useSiteSettings()`): the page declares the family (`@font-face` for an upload, the stylesheet of Google Fonts for a name of the list, `app/[game]/layout.tsx`) and the lettering asks
 * for the same family. The kit's own font follows each as the fallback, so that the lettering reads in it until the font has loaded, and if it never does.
 */
export function tableFonts({ bodyFont, displayFont, files }: FontSettings): TableFonts {
  const display = familyOf(!!files.fontDisplay, UPLOADED_TITLE_FONT, displayFont)
  const body = familyOf(!!files.fontBody, UPLOADED_BODY_FONT, bodyFont)
  return {
    display: display ? `"${display}", ${PLATE_FONT}` : undefined,
    body: body ? `"${body}", ${TABLE_FONT}` : undefined,
  }
}

/**
 * A measure of lettering: how wide a text is over the height of its lettering, in `font` at the weight of the table's lettering, as the browser sets it (a canvas, the font loaded: the faces wait for the fonts before the table draws). `fallback` is the table's own font,
 * the one a game that set no font keeps.
 */
function measureIn(font: string | undefined, fallback: string): (text: string) => number {
  const g = document.createElement("canvas").getContext("2d")!
  const size = 100
  g.font = `${TABLE_WEIGHT} ${size}px ${font ?? fallback}`
  return (text) => g.measureText(text).width / size
}

/** The sentences of the strip, in the body font: `fitSentence` of the layout sets them by it, on one line when they fit */
export const sentenceMeasure = (font: string | undefined) => measureIn(font, TABLE_FONT)
