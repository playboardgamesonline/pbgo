"use client"

import { Card, CARD_SETTINGS, type CameraSettings, onTable } from "@pbgo/table"
import { useEffect } from "react"
import { back, CARD_SIZE, face } from "./art"
import { Mat, Stage } from "./parts"

// One `Card` and the two poses of its `target`. A click (or the button under the scene) changes the target between face up and face down and the card glides there; `gloss` and `shadow` are two of its props. How dark the shadow is is a field of
// `CARD_SETTINGS`, the one object every card of the page reads: the scene writes the slider into it while it is on the page and puts back what it found when it leaves.

// The point looked at is on the table and the card floats above it, so it is put a little behind the card's foot for the card itself to be in the middle of the picture
const CAMERA: CameraSettings = { tilt: 22, yaw: 0, distance: 11, fov: 34, targetX: 0, targetZ: -0.7 }

/** Held above the mat, high enough that the card clears it halfway through its turn. */
const POSES = {
  up: onTable(0, 0, { y: 1.9, face: "up", scale: 1.4 }),
  down: onTable(0, 0, { y: 1.9, face: "down", scale: 1.4 }),
}

export function CardScene({ side, gloss, shadow, shadowOpacity, onFlip }: { side: "up" | "down"; gloss: boolean; shadow: boolean; shadowOpacity: number; onFlip: () => void }) {
  useEffect(() => {
    const found = CARD_SETTINGS.shadow
    return () => {
      CARD_SETTINGS.shadow = found
    }
  }, [])
  useEffect(() => {
    CARD_SETTINGS.shadow = shadowOpacity
  }, [shadowOpacity])
  return (
    <Stage id="scene-card" camera={CAMERA} playIntro={false}>
      <Mat width={10} depth={6.5} />
      <Card
        target={POSES[side]}
        front={face(17)}
        back={back()}
        size={CARD_SIZE}
        gloss={gloss}
        shadow={shadow}
        onClick={(event) => {
          event.stopPropagation()
          onFlip()
        }}
      />
    </Stage>
  )
}
