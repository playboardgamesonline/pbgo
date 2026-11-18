"use client"

import { Card, type CameraSettings, type CardState, onTable } from "@pbgo/table"
import { useState } from "react"
import { back, CARD_SIZE, face } from "./art"
import { Stage, TableLabel } from "./parts"

// The states of a card, side by side. The game says which state a card is in; the table draws it: a bloom of light in the game's colours, a lift, a dip while it is pressed, a dark for a card that cannot be chosen. The second card can be chosen: move
// the pointer over it, press it, press it again to pick it, and the table does the rest. The three next to it are held in `hover`, `pressed` and `selected` so that each look is in view at once.

const CAMERA: CameraSettings = { tilt: 34, yaw: 0, distance: 24, fov: 34, targetX: 0, targetZ: 0.8 }

const ENTRIES: readonly { state: CardState; text: string; n: number }[] = [
  { state: "base", text: "base", n: 6 },
  { state: "interactive", text: "interactive", n: 11 },
  { state: "hover", text: "hover", n: 20 },
  { state: "pressed", text: "pressed", n: 29 },
  { state: "selected", text: "selected", n: 34 },
  { state: "disabled", text: "disabled", n: 40 },
  { state: "out", text: "out", n: 45 },
]

/** The cards stand this far apart, which leaves room for the bloom of a card and the lift of its neighbour. */
const SPACING = 3

export function CardStatesScene() {
  const cardBack = back()
  const [picked, setPicked] = useState(false)
  return (
    <Stage id="scene-card-states" camera={CAMERA} playIntro={false}>
      {ENTRIES.map(({ state, text, n }, i) => {
        const x = (i - (ENTRIES.length - 1) / 2) * SPACING
        const live = state === "interactive"
        return (
          <group key={state}>
            <Card
              target={onTable(x, -0.2, { scale: 1.1 })}
              front={face(n)}
              back={cardBack}
              size={CARD_SIZE}
              state={live && picked ? "selected" : state}
              ariaLabel={live ? "Pick the card" : undefined}
              onPress={live ? () => setPicked((now) => !now) : undefined}
            />
            <TableLabel text={live && picked ? "selected" : text} x={x} z={2.5} height={0.55} />
          </group>
        )
      })}
    </Stage>
  )
}
