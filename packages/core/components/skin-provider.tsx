"use client"

import { createContext, useCallback, useContext, useMemo } from "react"
import type { UiTextKey } from "@pbgo/studio-kit/constants"
import { setErrorOverrides } from "../lib/api"
import { DEFAULT_SKIN, engineText, fill, optionalEngineText, type Skin } from "../lib/skin"

const SkinContext = createContext<Skin>(DEFAULT_SKIN)

export function SkinProvider({ skin, children }: { skin: Skin; children: React.ReactNode }) {
  setErrorOverrides(skin.errors)
  return <SkinContext.Provider value={skin}>{children}</SkinContext.Provider>
}

export function useSkin() {
  return useContext(SkinContext)
}

/** `t("turnOf", { name })` → Sanity or default label, variables replaced. */
export function useText() {
  const { texts } = useSkin()
  return useCallback((key: UiTextKey, params?: Record<string, string | number>) => fill(texts[key], params), [texts])
}

/**
 * The words of the engine's options, presets and score lines (`engineText`, `optionalEngineText` of the skin): `text(key, legacy, params)` for the ones a table needs, which read `[missing: <key>]`
 * until Sanity holds them, `optional(...)` for those that may be left out, such as a help. `legacy` is what the engine still carries.
 */
export function useEngineTexts() {
  const skin = useSkin()
  const { engineTexts } = skin
  return useMemo(
    () => ({
      text: (key: string, legacy?: string | null, params?: Record<string, string | number>) => engineText({ engineTexts }, key, legacy, params),
      optional: (key: string, legacy?: string | null, params?: Record<string, string | number>) => optionalEngineText({ engineTexts }, key, legacy, params),
    }),
    [engineTexts],
  )
}

export function usePlayerColor() {
  const { playerColors } = useSkin()
  return useCallback((index: number) => playerColors[index % playerColors.length]!, [playerColors])
}
