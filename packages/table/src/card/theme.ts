"use client"

import { useOptionalSiteSettings } from "@pbgo/core/components/settings-provider"
import { useOptionalBinding } from "@pbgo/core/lib/binding-context"
import type { CardColor, UiTheme } from "@pbgo/core/lib/binding"
import { isHex, type ThemeColors } from "@pbgo/core/lib/settings"
import { cardTheme } from "@pbgo/core/lib/ui-theme"
import { useMemo } from "react"
import type { BloomKey } from "./states"

/** The colours a table has when no game is shown (the specimens of the docs): the platform's accent and its text colour */
export const FALLBACK_COLORS: ThemeColors = { background: "#133640", foreground: "#f5f2ea", accent: "#f5c542", surface: "#2f7683", surfaceDark: "#1c4a55" }

/** The bloom of a card in one state: a `#rrggbb` colour and the strength that multiplies the table's own for that state */
export type Bloom = { color: string; strength: number }

/** `#rrggbb` for a colour of `UI_THEME.card`: itself, or the key of the game's theme it names (the accent for a key that is not one) */
export function bloomColor(color: CardColor, colors: ThemeColors): string {
  if (isHex(color)) return color
  const named = (colors as Record<string, string>)[color]
  return isHex(named) ? named : colors.accent
}

/** The bloom of each state that has one, from the game's `UI_THEME.card` over the defaults and the colours of its theme. Pure: the hook below reads the game */
export function cardBlooms(card: UiTheme["card"], colors: ThemeColors): Record<BloomKey, Bloom> {
  const theme = cardTheme(card)
  const bloom = (key: BloomKey): Bloom => ({ color: bloomColor(theme[key].color, colors), strength: theme[key].strength })
  return { interactive: bloom("interactive"), hover: bloom("hover"), pressed: bloom("pressed"), selected: bloom("selected") }
}

/** The blooms of the game shown (`UI_THEME.card` of its binding, in the colours of its settings); the platform's own outside a game's runtime */
export function useCardBlooms(): Record<BloomKey, Bloom> {
  const card = useOptionalBinding()?.UI_THEME?.card
  const colors = useOptionalSiteSettings()?.theme ?? FALLBACK_COLORS
  return useMemo(() => cardBlooms(card, colors), [card, colors])
}
