import { type SettingsFiles, UPLOADED_BODY_FONT, UPLOADED_TITLE_FONT } from "@pbgo/core/lib/settings"
import { PLATE_FONT, TABLE_FONT } from "@pbgo/table"

/** The fonts of the lettering lying on the table: one for the names, the buttons and the counts (the display font), one for the sentences (the body font). Each is `undefined` for a game that uploaded no such font, so that the table keeps its own */
export type TableFonts = { display: string | undefined; body: string | undefined }

/**
 * The fonts the lettering on the table is drawn in, from the font files the game uploaded to its Sanity project (`settings`: `displayFontFile`, `bodyFontFile`), which the page declares as `@font-face` under the platform's family names
 * (`UPLOADED_TITLE_FONT`, `UPLOADED_BODY_FONT`, `fontFaceCss` of core). The kit's own font follows each as the fallback, so that the lettering reads in it until the uploaded font has loaded, and if it never does.
 */
export function tableFonts(files: Pick<SettingsFiles, "fontBody" | "fontDisplay">): TableFonts {
  return {
    display: files.fontDisplay ? `"${UPLOADED_TITLE_FONT}", ${PLATE_FONT}` : undefined,
    body: files.fontBody ? `"${UPLOADED_BODY_FONT}", ${TABLE_FONT}` : undefined,
  }
}
