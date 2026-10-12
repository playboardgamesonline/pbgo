"use client"

import { useSkin } from "@pbgo/core/components/skin-provider"
import { gameDict } from "../lib/i18n"

/** Courtisans' own texts (board, rules) in the player's language. */
export function useDict() {
  return gameDict(useSkin().locale)
}
