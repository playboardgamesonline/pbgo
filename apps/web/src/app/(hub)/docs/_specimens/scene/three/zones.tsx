"use client"

import { type CameraSettings, fan, HandShadow, type Pose, row, seats, type Spot, Zone } from "@pbgo/table"
import { back, CARD_SIZE, DECK, face } from "./art"
import { Stage, TableLabel } from "./parts"

// The three zones a board is made of, each a `Zone` with its own frame and layout: the viewer's hand (no frame, a fan in front of them), the cards another player holds (framed on their seat, a fan of backs held up with its shadow) and a shared zone in the middle
// of the table (no frame, the game's own layout, here a row).

const CAMERA: CameraSettings = { tilt: 40, yaw: 0, distance: 20, fov: 34, targetX: 0, targetZ: 1.4 }

const RING = { radiusX: 6, radiusZ: 4 }

export function ZonesScene() {
  const cardBack = back()
  const other = seats(2, { ...RING, me: 0 })[1]
  if (!other) return null
  const frame: Spot = { x: other.x * 1.2, z: other.z * 1.2, yaw: other.yaw }
  const backs: Pose[] = fan(5, { gap: 0.34, y: 0.8, rise: 0.004, curve: 0.08, tilt: -0.55, roll: 0.11, face: "down", scale: 0.68 })
  return (
    <Stage id="scene-zones" camera={CAMERA} playIntro={false}>
      <Zone
        layout={fan(5, { gap: 1.1, y: 1.1, rise: 0.004, z: 4.7, curve: 0.06, tilt: 0.62, roll: 0.05, scale: 1.2 })}
        size={CARD_SIZE}
        enter={DECK}
        cards={[3, 9, 14, 18, 23].map((n) => ({ key: n, front: face(n), back: cardBack }))}
      />
      <HandShadow at={frame} radius={1.7} />
      <Zone frame={frame} layout={backs} size={CARD_SIZE} enter={DECK} cards={backs.map((_, i) => ({ key: i, front: cardBack, back: cardBack }))} />
      <Zone layout={row(3, { gap: 1.6, rise: 0.012, z: 0.3 })} size={CARD_SIZE} enter={DECK} cards={[26, 31, 5].map((n) => ({ key: n, front: face(n), back: cardBack }))} />
      <TableLabel text="the viewer's hand" x={0} z={6.6} />
      <TableLabel text="a player's cards" x={0} z={-7.7} />
      <TableLabel text="the middle" x={0} z={1.9} />
    </Stage>
  )
}
