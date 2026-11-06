"use client"

import { type CameraSettings, fan, grid, onTable, pile, type Pose, row, Zone } from "@pbgo/table"
import { LAYOUT_CARDS, type LayoutName } from "../defaults"
import { back, CARD_SIZE, face } from "./art"
import { Mat, Stage } from "./parts"

// One `Zone`, four layout helpers. The cards keep their keys when the helper changes, so they glide from the slots of one to the slots of the next; the zone owns nothing, the helper only says where slot `i` is.

const CAMERA: CameraSettings = { tilt: 42, yaw: 0, distance: 18, fov: 34, targetX: 0, targetZ: 0.8 }

/** The room each helper is given, so that the most cards still fit the mat: the gap between two cards shrinks as they come. */
const WIDTH = 10.5

function slots(layout: LayoutName, n: number): Pose[] {
  switch (layout) {
    case "fan":
      return fan(n, { gap: Math.min(1.1, WIDTH / n), y: 1, rise: 0.004, z: 1.6, curve: 0.04, tilt: 0.55, roll: 0.05, scale: 1.1 })
    case "row":
      return row(n, { gap: Math.min(1.6, WIDTH / n), rise: 0.012, z: 0.4 })
    case "pile":
      return pile(n, { face: "up", step: 0.03, lean: "layouts", leanAmplitude: 0.12 })
    case "grid":
      return grid(n, { columns: 4, gapX: 1.7, gapZ: 2.3, rows: Math.ceil(LAYOUT_CARDS.max / 4) })
  }
}

/** Where a card is dealt from when the slider brings one more. */
const DEAL_FROM = onTable(0, -4.5, { y: 3, face: "down", scale: 0.9 })

export function LayoutsScene({ layout, count }: { layout: LayoutName; count: number }) {
  const cardBack = back()
  return (
    <Stage id="scene-layouts" camera={CAMERA} playIntro={false}>
      <Mat width={15} depth={10} />
      <Zone
        layout={slots(layout, count)}
        size={CARD_SIZE}
        enter={DEAL_FROM}
        stagger={0.04}
        cards={Array.from({ length: count }, (_, i) => ({ key: i, front: face(i * 5 + 1), back: cardBack }))}
      />
    </Stage>
  )
}
