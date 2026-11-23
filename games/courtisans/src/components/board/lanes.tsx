"use client"

import { type Family, type CourtisansResults } from "@courtisans/engine"
import { Hotspot, LightBand, NO_TOUCH, type Touch, useSettings, useSettingsVersion } from "@pbgo/table"
import { useState } from "react"
import { CARD_H, type Column, laneArea, laneFrame, STEP, TABLE_FAMILIES } from "./layout"
import type { EndingState } from "./ending"

/**
 * How the lanes of the Queen's table look: the band of light of the light, over the mat above, and the dark one of the disgrace, below it. Each lies along a column of the mat from its edge outward, as long as `logLength` cards, a little narrower than the column.
 * A plain object that the Mat Lines folder of the debug panel edits.
 */
export const LINE_SETTINGS = {
  preview: false,
  width: 0.96,
  logLength: 2.1,
  elevation: 0.07,
  fade: 1.6,
  lightColor: "#ffe8a3",
  lightEdge: "#ffffff",
  lightIntensity: 0.85,
  disgraceColor: "#000000",
  disgraceEdge: "#000000",
  disgraceIntensity: 0.85,
  pulse: 0.15,
  speed: 1.6,
}

/** How much brighter a lane is under the pointer or the keyboard focus */
const LANE_LIFT = 1.4

export function LaneSettings() {
  useSettings(
    "Mat Lines",
    LINE_SETTINGS,
    {
      preview: "preview on all families",
      width: ["width (× column)", 0.1, 1.5, 0.01],
      logLength: ["length (× card height)", 0.2, 5, 0.05],
      elevation: ["height", 0.02, 0.5, 0.005],
      fade: ["fade curve", 0.2, 5, 0.05],
      lightColor: "light color",
      lightEdge: "light edge color",
      lightIntensity: ["light intensity", 0, 3, 0.01],
      disgraceColor: "disgrace color",
      disgraceEdge: "disgrace edge color",
      disgraceIntensity: ["disgrace intensity", 0, 3, 0.01],
      pulse: ["pulse", 0, 1, 0.01],
      speed: ["pulse speed", 0, 8, 0.05],
    },
    { order: 9, closed: false },
  )
  return null
}

/** A band of light along a column of the mat: bright of the light, dark of the disgrace. `lift` brightens it, for a lane the pointer is over */
export function MatLine({ column, light, lift = 1 }: { column: Column; light: boolean; lift?: number }) {
  useSettingsVersion()
  const r = LINE_SETTINGS
  return (
    <LightBand
      frame={laneFrame(column, light)}
      width={STEP * r.width}
      length={CARD_H * r.logLength}
      y={r.elevation}
      fade={r.fade}
      color={light ? r.lightColor : r.disgraceColor}
      edge={light ? r.lightEdge : r.disgraceEdge}
      additive={light}
      strength={(light ? r.lightIntensity : r.disgraceIntensity) * lift}
      pulse={r.pulse}
      speed={r.speed}
    />
  )
}

/** A lane a card can be played along: its band, and the area that takes the press over the part of it where the cards lie */
export function Lane({ column, light, ariaLabel, onPress }: { column: Column; light: boolean; ariaLabel: string; onPress: () => void }) {
  const [touch, setTouch] = useState<Touch>(NO_TOUCH)
  useSettingsVersion()
  return (
    <>
      <MatLine column={column} light={light} lift={touch.hovered || touch.focused ? LANE_LIFT : 1} />
      <Hotspot {...laneArea(column, light, STEP * LINE_SETTINGS.width)} ariaLabel={ariaLabel} onPress={onPress} onTouch={setTouch} />
    </>
  )
}

/** The lanes the end of the game lights, one for each family that has been settled so far: the light of the families that are in it, the dark of the ones in disgrace */
export function MatLines({ results, ending }: { results: CourtisansResults | null; ending: EndingState | null }) {
  useSettingsVersion()
  if (LINE_SETTINGS.preview)
    return (
      <>
        {TABLE_FAMILIES.map((f: Family) => (
          <group key={f}>
            <MatLine column={f} light />
            <MatLine column={f} light={false} />
          </group>
        ))}
      </>
    )
  if (!results || !ending) return null
  return (
    <>
      {TABLE_FAMILIES.slice(0, ending.families).map((f) => {
        const s = results.statuses[f].status
        if (s === "neutral") return null
        return <MatLine key={f} column={f} light={s === "light"} />
      })}
    </>
  )
}
