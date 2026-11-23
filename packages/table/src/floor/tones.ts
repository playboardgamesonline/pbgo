"use client"

import { useOptionalSiteSettings } from "@pbgo/core/components/settings-provider"
import { useOptionalBinding } from "@pbgo/core/lib/binding-context"
import type { UiTheme } from "@pbgo/core/lib/binding"
import type { ThemeColors } from "@pbgo/core/lib/settings"
import { buttonTheme } from "@pbgo/core/lib/ui-theme"
import { useMemo } from "react"
import { bloomColor, FALLBACK_COLORS } from "../card/theme"
import { isHex } from "./lift"

/** The two tones of a button on the table: the action that goes on (Hit, Deal, Play) and the quieter ones (Stay, Keep, Swap). The game's theme gives each its colour */
export type FloorTone = "primary" | "neutral"

/** The grey a tone that is neither a name nor a colour is drawn in */
const UNKNOWN = "#808080"

/** `#rrggbb` for each tone, from the game's `UI_THEME.button` over the defaults and the colours of its theme. Pure: the hook below reads the game */
export function floorTones(button: UiTheme["button"], colors: ThemeColors): Record<FloorTone, string> {
  const theme = buttonTheme(button)
  return { primary: bloomColor(theme.primary, colors), neutral: bloomColor(theme.neutral, colors) }
}

/** The tones of the game shown (`UI_THEME.button` of its binding, in the colours of its settings, which the gamemaster can change); the platform's own outside a game's runtime */
export function useFloorTones(): Record<FloorTone, string> {
  const button = useOptionalBinding()?.UI_THEME?.button
  const colors = useOptionalSiteSettings()?.theme ?? FALLBACK_COLORS
  return useMemo(() => floorTones(button, colors), [button, colors])
}

/** The colour a `tone` prop stands for: a tone's own, the primary for none, a `#rrggbb` as it is (a board that still types one: it should not), grey for anything else */
export function toneColour(tone: string | undefined, tones: Record<FloorTone, string>): string {
  if (tone === undefined) return tones.primary
  if (tone === "primary" || tone === "neutral") return tones[tone]
  return isHex(tone) ? tone : UNKNOWN
}
