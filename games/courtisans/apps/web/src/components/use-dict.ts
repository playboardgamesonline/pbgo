"use client"

import { useSkin } from "@pbgo/core/components/skin-provider"
import { gameDict } from "@/lib/i18n"

/** Textes propres à Courtisans (plateau, règles) dans la langue du joueur. */
export function useDict() {
  return gameDict(useSkin().locale)
}
