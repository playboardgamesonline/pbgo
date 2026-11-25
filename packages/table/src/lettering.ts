"use client"

import { useOptionalSiteSettings } from "@pbgo/core/components/settings-provider"
import { type SettingsFiles, UPLOADED_ACCENT_FONT, UPLOADED_BODY_FONT, UPLOADED_TITLE_FONT } from "@pbgo/core/lib/settings"
import { useMemo } from "react"
import { PLATE_FONT } from "./seat/seat"
import { TABLE_FONT } from "./seat/table-text"

/** The weight of the lettering that lies on the table: the names on the plates, the counts, the pads, the sentences. The bold of the platform's own fonts */
export const LETTERING_WEIGHT = 700

/** The fonts of the lettering on the table, and its weight: the display font for the names, the counts and the pads, the body font for the sentences, and the accent font for what a board writes large in the game's own flourish (a card's name on its face), which is the display font where the game uploaded no accent */
export type Lettering = { display: string; body: string; accent: string; weight: number }

/** The lettering when a game uploaded a display font, a body font and an accent font, or not: the kit's own font follows each as its fallback (the display font follows the accent), so the lettering reads in it until the uploaded font has loaded, and for a game that uploaded none */
export function lettering({ display, body, accent = false }: { display: boolean; body: boolean; accent?: boolean }): Lettering {
  const displayFont = display ? `"${UPLOADED_TITLE_FONT}", ${PLATE_FONT}` : PLATE_FONT
  return {
    display: displayFont,
    body: body ? `"${UPLOADED_BODY_FONT}", ${TABLE_FONT}` : TABLE_FONT,
    accent: accent ? `"${UPLOADED_ACCENT_FONT}", ${displayFont}` : displayFont,
    weight: LETTERING_WEIGHT,
  }
}

/**
 * The lettering of a game's table from the font files it uploaded to its Sanity project (`settings`: `displayFontFile`, `bodyFontFile`, `accentFontFile`), which the page declares as `@font-face` under the platform's family names (`fontFaceCss` of core). Pure: `useLettering`
 * reads the game.
 */
export const letteringOf = (files: (Pick<SettingsFiles, "fontBody" | "fontDisplay"> & Partial<Pick<SettingsFiles, "fontAccent">>) | null | undefined): Lettering =>
  lettering({ display: !!files?.fontDisplay, body: !!files?.fontBody, accent: !!files?.fontAccent })

/** The lettering of the game shown: its uploaded fonts, else the kit's own, so that every block that writes on the table writes the way its plates do */
export function useLettering(): Lettering {
  const files = useOptionalSiteSettings()?.files
  const display = !!files?.fontDisplay
  const body = !!files?.fontBody
  const accent = !!files?.fontAccent
  // Only whether a font was uploaded decides the lettering: a new settings object with the same files is the same lettering
  return useMemo(() => lettering({ display, body, accent }), [display, body, accent])
}
