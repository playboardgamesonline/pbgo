"use client"

import { useOptionalSiteSettings } from "@pbgo/core/components/settings-provider"
import { type SettingsFiles, UPLOADED_BODY_FONT, UPLOADED_TITLE_FONT } from "@pbgo/core/lib/settings"
import { useMemo } from "react"
import { PLATE_FONT } from "./seat/seat"
import { TABLE_FONT } from "./seat/table-text"

/** The weight of the lettering that lies on the table: the names on the plates, the counts, the pads, the sentences. The bold of the platform's own fonts */
export const LETTERING_WEIGHT = 700

/** The fonts of the lettering on the table, and its weight: the display font for the names, the counts and the pads, the body font for the sentences */
export type Lettering = { display: string; body: string; weight: number }

/** The lettering when a game uploaded a display font and a body font, or not: the kit's own font follows each as its fallback, so the lettering reads in it until the uploaded font has loaded, and for a game that uploaded none */
export function lettering({ display, body }: { display: boolean; body: boolean }): Lettering {
  return {
    display: display ? `"${UPLOADED_TITLE_FONT}", ${PLATE_FONT}` : PLATE_FONT,
    body: body ? `"${UPLOADED_BODY_FONT}", ${TABLE_FONT}` : TABLE_FONT,
    weight: LETTERING_WEIGHT,
  }
}

/**
 * The lettering of a game's table from the font files it uploaded to its Sanity project (`settings`: `displayFontFile`, `bodyFontFile`), which the page declares as `@font-face` under the platform's family names (`fontFaceCss` of core). Pure: `useLettering`
 * reads the game.
 */
export const letteringOf = (files: Pick<SettingsFiles, "fontBody" | "fontDisplay"> | null | undefined): Lettering => lettering({ display: !!files?.fontDisplay, body: !!files?.fontBody })

/** The lettering of the game shown: its uploaded fonts, else the kit's own, so that every block that writes on the table writes the way its plates do */
export function useLettering(): Lettering {
  const files = useOptionalSiteSettings()?.files
  const display = !!files?.fontDisplay
  const body = !!files?.fontBody
  // Only whether a font was uploaded decides the lettering: a new settings object with the same files is the same lettering
  return useMemo(() => lettering({ display, body }), [display, body])
}
