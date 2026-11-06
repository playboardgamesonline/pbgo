"use client"

import { type CameraSettings, fan, row, Zone, type ZoneCard } from "@pbgo/table"
import { MEMORY_CARDS } from "../defaults"
import { back, CARD_SIZE, face } from "./art"
import { Mat, Stage, TableLabel } from "./parts"

// Two zones, a hand and a middle. A card that changes zone is not the same React element: it unmounts from one `Zone` and mounts in the other. It has the same `id` in both, so the table's pose memory hands the new one the pose the old one left
// from and it flies from where it was instead of popping into place.

const CAMERA: CameraSettings = { tilt: 40, yaw: 0, distance: 17, fov: 34, targetX: 0, targetZ: 1.6 }

export function PoseMemoryScene({ middle, onMove }: { middle: readonly number[]; onMove: (id: number) => void }) {
  const cardBack = back()
  const hand = MEMORY_CARDS.filter((id) => !middle.includes(id))
  const cards = (ids: readonly number[]): ZoneCard[] =>
    ids.map((id) => ({
      key: id,
      id,
      front: face(id),
      back: cardBack,
      onClick: (event) => {
        event.stopPropagation()
        onMove(id)
      },
    }))
  return (
    <Stage id="scene-pose-memory" camera={CAMERA} playIntro={false}>
      <Mat width={16} depth={10.5} />
      <TableLabel text="hand" x={0} z={6.4} />
      <TableLabel text="middle" x={0} z={-3.1} />
      <Zone layout={fan(hand.length, { gap: 1.25, y: 1, rise: 0.004, z: 4.2, curve: 0.05, tilt: 0.6, roll: 0.05, scale: 1.1 })} size={CARD_SIZE} cards={cards(hand)} />
      <Zone layout={row(middle.length, { gap: 1.7, rise: 0.012, z: -0.9 })} size={CARD_SIZE} cards={cards(middle)} />
    </Stage>
  )
}
