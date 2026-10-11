"use client"

import { EASING_NAMES } from "@pbgo/core/components/game/easing"
import { CARD_SETTINGS } from "./card3d"
import { LAYOUT_SETTINGS } from "./layout"
import { useSettings } from "./settings"

export function CardSettingsPanel() {
  useSettings(
    "Card",
    LAYOUT_SETTINGS,
    {
      randomRotation: ["random rotation (rad)", 0, 0.3, 0.001],
      pileSpacing: ["stack spacing", 0.001, 0.05, 0.001],
      deckSpacing: ["draw pile spacing", 0.001, 0.05, 0.001],
    },
    { order: 1 },
  )
  useSettings(
    "Card",
    CARD_SETTINGS,
    {
      thickness: ["thickness (× width)", 0.001, 0.03, 0.0005],
      foldable: ["bendability", 0, 1, 0.01],
      flightDuration: ["flight duration (×)", 0.2, 3, 0.01],
      flightHeight: ["flight height (×)", 0, 3, 0.01],
      easing: ["flight easing", EASING_NAMES as string[]],
      shadow: ["shadow", 0, 1, 0.01],
    } as never,
    { order: 1 },
  )
  useSettings(
    "Card Effects",
    CARD_SETTINGS,
    {
      assassinColor: "assassin color",
      assassinHalo: ["assassin glow", 0, 1, 0.01],
      assassinPulse: ["assassin pulse", 0, 0.5, 0.01],
      assassinOutline: "assassin solid outline",
      goldColor: "completed mission color",
      goldHalo: ["completed mission glow", 0, 1, 0.01],
      goldPulse: ["completed mission pulse", 0, 0.5, 0.01],
      sparkle: ["sparkle", 0, 1, 0.01],
      sparkleSpeed: ["sparkle speed", 0, 2, 0.01],
      pulseSpeed: ["pulse speed", 0, 8, 0.1],
      selectionColor: "selection frame color",
      frameOpacity: ["frame opacity", 0, 1, 0.01],
      framePulse: ["frame pulse", 0, 0.5, 0.01],
      frameBreath: ["frame breathing", 0, 0.1, 0.001],
      frameSpeed: ["frame speed", 0, 10, 0.1],
      reflection: ["reflection", 0, 1, 0.01],
      reflectionMotion: ["reflection motion", 0, 1.5, 0.01],
    } as never,
    { order: 7 },
  )
  return null
}
