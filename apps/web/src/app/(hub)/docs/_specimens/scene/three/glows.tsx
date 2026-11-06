"use client"

import { Card, type CameraSettings, defineGlows, onTable } from "@pbgo/table"
import { back, CARD_SIZE, face } from "./art"
import { Stage, TableLabel } from "./parts"

// A glow is a set of parts, and a part a glow leaves out is not drawn at all. Four cards each wear one part and a fifth wears all four, all built with `defineGlows` and `{}`, which is every default of a part.

const CAMERA: CameraSettings = { tilt: 34, yaw: 0, distance: 18, fov: 34, targetX: 0, targetZ: 0.8 }

const GLOWS = defineGlows({
  halo: { halo: {} },
  outline: { outline: {} },
  frame: { frame: {} },
  sparkle: { sparkle: {} },
  all: { halo: {}, outline: {}, frame: {}, sparkle: {} },
})

const ENTRIES = [
  { key: "halo", text: "halo", n: 6 },
  { key: "outline", text: "outline", n: 11 },
  { key: "frame", text: "frame", n: 20 },
  { key: "sparkle", text: "sparkle", n: 29 },
  { key: "all", text: "all four", n: 34 },
] as const

/** The cards stand this far apart, which leaves room for the widest halo between two. */
const SPACING = 2.9

export function GlowsScene() {
  const cardBack = back()
  return (
    <Stage id="scene-glows" camera={CAMERA} playIntro={false}>
      {ENTRIES.map(({ key, text, n }, i) => {
        const x = (i - (ENTRIES.length - 1) / 2) * SPACING
        return (
          <group key={key}>
            <Card target={onTable(x, -0.2, { scale: 1.1 })} front={face(n)} back={cardBack} size={CARD_SIZE} glow={GLOWS[key]} />
            <TableLabel text={text} x={x} z={2.3} />
          </group>
        )
      })}
    </Stage>
  )
}
