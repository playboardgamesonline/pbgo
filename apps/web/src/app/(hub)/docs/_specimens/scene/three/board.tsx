"use client"

import { type CameraSettings, defineGlows, fan, Pile, type Pose, RESTING_HEIGHT, row, seats, shifted, type Spot, Zone, type ZoneCard } from "@pbgo/table"
import { useState } from "react"
import { back, CARD_SIZE, DECK, face } from "./art"
import { Stage, TableLabel } from "./parts"

// A whole small board on the shared tools, the way the template builds one (`template/src/components/board/`, whose numbers these are): the viewer's hand in a `Zone` over `fan`, the cards each other player holds in a `Zone` framed on
// their seat from `seats`, a draw `Pile` and the middle of the table, which is a `Zone` too. The scene holds no rule: it is given what is where, and sends the card that was clicked.

const CAMERA: CameraSettings = { tilt: 40, yaw: 0, distance: 21, fov: 34, targetX: 0, targetZ: 1.6 }

/** The ring of seats. */
const RING = { radiusX: 7.4, radiusZ: 4.4 }

const GLOWS = defineGlows({ selection: { frame: {} } })

/** The cards each other player holds. */
const OPPONENT_CARDS = 5

type Seat = Required<Spot>

/** The slots of a hand of `n` cards, a fan in front of the viewer; the card at `raised` (-1: none) lifts toward them. */
function handLayout(n: number, raised: number): Pose[] {
  const slots = fan(n, { gap: 1.05, y: 1.1, rise: 0.004, z: 6.1, curve: 0.06, tilt: 0.62, roll: 0.05, scale: 1.2 })
  return slots.map((slot, i) => (i === raised ? shifted(slot, { y: 0.45, z: -0.25 }) : slot))
}

/** The frame of the cards an opponent holds: just beyond their seat, turned like it. */
function backFrame(seat: Seat): Spot {
  return { x: seat.x * 1.08, z: seat.z * 1.08, yaw: seat.yaw }
}

/** Their backs, in a row in that frame. */
function backLayout(seat: Seat, n: number): Pose[] {
  return row(n, { gap: 0.32, y: 0.02, rise: 0.004, face: "down", turn: -(2 * seat.yaw + Math.PI), scale: 0.62 })
}

/** The cards played to the middle, side by side. */
function middleLayout(n: number): Pose[] {
  return row(n, { gap: 1.45, y: RESTING_HEIGHT, rise: 0.012, z: 0.3 })
}

const DRAW_PILE: Spot = { x: -5.9, z: 0.3 }

export function BoardScene({ players, hand, played, onPlay }: { players: number; hand: readonly number[]; played: readonly number[]; onPlay: (id: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const cardBack = back()
  const ring = seats(players, { ...RING, me: 0 })
  const raised = hand.indexOf(hovered ?? -1)

  const handCards: ZoneCard[] = hand.map((id) => ({
    key: id,
    id,
    front: face(id),
    back: cardBack,
    glow: hovered === id ? GLOWS.selection : null,
    gloss: hovered === id,
    onHover: (over) => setHovered((current) => (over ? id : current === id ? null : current)),
    onClick: (event) => {
      event.stopPropagation()
      setHovered(null)
      onPlay(id)
    },
  }))
  const middleCards: ZoneCard[] = played.map((id) => ({ key: id, id, front: face(id), back: cardBack }))

  return (
    <Stage id="scene-board" camera={CAMERA}>
      {ring.slice(1).map((seat, i) => (
        <group key={i}>
          {/* The name stands behind the cards, on the far side of them from the middle of the table */}
          <TableLabel text={`Player ${i + 2}`} x={backFrame(seat).x} z={backFrame(seat).z - 1.7} />
          <Zone
            frame={backFrame(seat)}
            layout={backLayout(seat, OPPONENT_CARDS)}
            size={CARD_SIZE}
            enter={DECK}
            cards={Array.from({ length: OPPONENT_CARDS }, (_, k) => ({ key: `back-${k}`, front: cardBack, back: cardBack }))}
          />
        </group>
      ))}
      <Pile frame={DRAW_PILE} count={14} size={CARD_SIZE} back={cardBack} lean="draw" leanAmplitude={0.06} />
      <Zone layout={handLayout(hand.length, raised)} size={CARD_SIZE} enter={DECK} cards={handCards} />
      <Zone layout={middleLayout(played.length)} size={CARD_SIZE} cards={middleCards} />
    </Stage>
  )
}
