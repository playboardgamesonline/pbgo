"use client"

import { createContext, useCallback, useContext } from "react"
import type { UiTextKey } from "@pbgo/studio-kit/constants"
import { setErrorOverrides } from "../lib/api"
import { DEFAULT_SKIN, fill, type Skin } from "../lib/skin"

const SkinContext = createContext<Skin>(DEFAULT_SKIN)

export function SkinProvider({ skin, children }: { skin: Skin; children: React.ReactNode }) {
  setErrorOverrides(skin.errors)
  return <SkinContext.Provider value={skin}>{children}</SkinContext.Provider>
}

export function useSkin() {
  return useContext(SkinContext)
}

/** `t("turnOf", { name })` → libellé Sanity ou par défaut, variables remplacées. */
export function useText() {
  const { texts } = useSkin()
  return useCallback((key: UiTextKey, params?: Record<string, string | number>) => fill(texts[key], params), [texts])
}

export function usePlayerColor() {
  const { playerColors } = useSkin()
  return useCallback((index: number) => playerColors[index % playerColors.length]!, [playerColors])
}
