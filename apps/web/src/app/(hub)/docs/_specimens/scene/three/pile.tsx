"use client"

import { type CameraSettings, inFrame, pile, Pile, type PileOptions, type Pose, type Spot, Zone } from "@pbgo/table"
import type { Drawn } from "../defaults"
import { back, CARD_SIZE, face } from "./art"
import { Mat, Stage } from "./parts"

// A `Pile` is a stack of cards the game only counts. Its top card can be turned up, and it is a card like any other: it takes an `onClick`. A card drawn from it is a card of the game's own now, so it goes to a `Zone` over `pile` (a discard
// pile whose cards stay named) and starts from the pose the top of the draw pile had, which the scene works out with the same `pile` the `Pile` calls.

const CAMERA: CameraSettings = { tilt: 40, yaw: 0, distance: 13, fov: 34, targetX: 0, targetZ: 0.3 }

/** The most cards the draw pile draws: past it a taller pile looks no different, and the slider reaches farther than that on purpose. */
const LIMIT = 24

const DRAW_PILE: Spot = { x: -3.3, z: 0 }
const DISCARD_PILE: Spot = { x: 3.3, z: 0 }

const OPTIONS: Pick<PileOptions, "lean" | "leanAmplitude" | "scale"> = { lean: "draw", leanAmplitude: 0.06, scale: 1.25 }

/** Where the top card of a draw pile of `count` cards lies. */
function topPose(count: number, topUp: boolean): Pose {
  const n = Math.min(count, LIMIT)
  const slots = pile(n, { ...OPTIONS, face: "down", topFace: topUp ? "up" : "down" })
  return inFrame(DRAW_PILE, slots[n - 1] as Pose)
}

export function PileScene({
  count,
  topUp,
  next,
  drawn,
  onDraw,
}: {
  count: number
  topUp: boolean
  /** The number of the card on top of the draw pile */
  next: number
  drawn: readonly Drawn[]
  onDraw: () => void
}) {
  const cardBack = back()
  return (
    <Stage id="scene-pile" camera={CAMERA} playIntro={false}>
      <Mat width={13} depth={8} />
      <Pile
        frame={DRAW_PILE}
        count={count}
        size={CARD_SIZE}
        back={cardBack}
        limit={LIMIT}
        {...OPTIONS}
        top={{ id: next, front: topUp ? face(next) : undefined, onClick: onDraw }}
      />
      <Zone
        frame={DISCARD_PILE}
        layout={pile(drawn.length, { face: "up", step: 0.03, lean: "discard", leanAmplitude: 0.12, scale: OPTIONS.scale })}
        size={CARD_SIZE}
        cards={drawn.map(({ id, from }) => ({ key: id, id, front: face(id), back: cardBack, from: topPose(from, topUp) }))}
      />
    </Stage>
  )
}
