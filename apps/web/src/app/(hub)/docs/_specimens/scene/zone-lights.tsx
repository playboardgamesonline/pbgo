"use client"

import { useState } from "react"
import { Choice, Knob, Option } from "./controls"
import { SceneFrame } from "./frame"
import { ZoneLightsScene } from "./lazy"

// The light half of the zone lights specimen: the state and the controls, laid out in a `SceneFrame`, and the scene itself (`lazy.tsx`), which is drawn only when the frame is near the window.

/** The colours of the glow the specimen offers (the scene, `three/zone-lights.tsx`, paints them). */
const COLORS = { gold: "Gold", blue: "Blue", rose: "Rose" } as const
type Color = keyof typeof COLORS

export function SceneZoneLightsSpecimen() {
  const [strength, setStrength] = useState(1)
  const [color, setColor] = useState<Color>("gold")
  const [stars, setStars] = useState(0.5)
  const [speed, setSpeed] = useState(0.4)
  const [light, setLight] = useState(true)
  const [dark, setDark] = useState(true)
  const [pulse, setPulse] = useState(0.15)
  const [fade, setFade] = useState(1.6)
  return (
    <SceneFrame
      label="A card table seen from above with a few cards on it, a glow round a zone on its left that has a rim of light going round it, a soft halo and stars that twinkle, and two bands of light on its right, a light one that runs away from the viewer and a dark one that runs toward them, each fading away from its bright end"
      controls={
        <>
          <Knob label="Glow strength" value={strength} min={0} max={2} step={0.05} onChange={setStrength} />
          <Choice label="Glow colour" value={color} options={Object.entries(COLORS).map(([value, label]) => ({ value, label, description: label }))} onChange={(value) => setColor(value as Color)} />
          <Knob label="Stars in the glow" value={stars} min={0} max={3} step={0.05} onChange={setStars} />
          <Knob label="Speed of the glow" value={speed} min={0} max={3} step={0.05} onChange={setSpeed} />
          <Option label="Light band" checked={light} onChange={setLight} />
          <Option label="Dark band" checked={dark} onChange={setDark} />
          <Knob label="Swell of the bands" value={pulse} min={0} max={0.6} step={0.01} onChange={setPulse} />
          <Knob label="Fade of the bands" value={fade} min={0.5} max={4} step={0.1} onChange={setFade} />
        </>
      }
    >
      <ZoneLightsScene strength={strength} color={color} stars={stars} speed={speed} light={light} dark={dark} pulse={pulse} fade={fade} />
    </SceneFrame>
  )
}
