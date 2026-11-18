"use client"

import { DEFAULT_SEAT_THEME } from "@pbgo/core/lib/ui-theme"
import {
  boxOfPoses,
  type CameraSettings,
  centreOf,
  effectiveState,
  Hotspot,
  joinBoxes,
  LightPool,
  NO_TOUCH,
  plateAbove,
  plateBoxOf,
  row,
  Seat,
  seats,
  seatStateOf,
  type Spot,
  type TableBox,
  type Touch,
  turnSentence,
  TurnText,
  whoseTurn,
  Zone,
} from "@pbgo/table"
import { useState } from "react"
import { back, CARD_SIZE, face, palette } from "./art"
import { Stage, TURN_WORDS } from "./parts"
import type { SeatTurn } from "../defaults"

// Three seats of a ring for five players, drawn by the `Seat` of the package itself: the viewer's in front, the left-most opponent's and the right-most's. Each holds a few cards face down, and its plate stands above them, upright for the viewer, whichever way the cards
// are turned. The crown follows whose turn it is, a seat that is away fades, and the line across the middle says whose turn it is, or who the game waits for. With "choose a player" on, the cards of each player glow while they can be chosen, brighter under the pointer,
// brightest while pressed: the area they lie in is invisible, and the plate lies in it without reacting.

const CAMERA: CameraSettings = { tilt: 44, yaw: 0, distance: 20, fov: 34, targetX: 0, targetZ: 0.9 }

const RING = { radiusX: 7.4, radiusZ: 4.4 }

/** The cards each seat holds, a row in the frame of the seat; a few, scaled so that three rows and three plates stand on the ring */
const HELD = 4
const SCALE = 0.8
const LAYOUT = row(HELD, { gap: 0.9, y: 0.02, face: "down", scale: SCALE })
/** The room around a player's cards and plate that a press counts in, in world units */
const PADDING = 0.3
/** Where the line that says whose turn it is lies, across the middle of the table */
const LINE = { x: 0, z: 1.1 }

const NAMES = { you: "Alix", left: "Basile", right: "Camille" } as const
type SeatId = keyof typeof NAMES

export type SeatSceneProps = {
  turn: SeatTurn
  /** The game waits for the two opponents together, as on a simultaneous step: nobody has the turn */
  together: boolean
  /** The left seat is away */
  away: boolean
  /** The right seat has stayed: a status after the score */
  stayed: boolean
  /** The cards of every player glow while they can be chosen, and a press picks the player, who has the turn */
  choosing: boolean
  /** The left seat holds no card: a pool of light shows where its cards would lie */
  empty: boolean
  points: number
  onPick: (seat: SeatId) => void
}

export function SeatScene({ turn, together, away, stayed, choosing, empty, points, onPick }: SeatSceneProps) {
  const p = palette()
  const cardBack = back()
  const ring = seats(5, { ...RING, me: 0 })
  const players: readonly { id: SeatId; color: string; frame: Spot }[] = [
    { id: "you", color: p.ivory, frame: { x: ring[0]!.x, z: ring[0]!.z * 1.08, yaw: ring[0]!.yaw } },
    { id: "left", color: p.marks[2], frame: { x: ring[1]!.x * 1.08, z: ring[1]!.z * 1.08, yaw: ring[1]!.yaw } },
    { id: "right", color: p.marks[0], frame: { x: ring[4]!.x * 1.08, z: ring[4]!.z * 1.08, yaw: ring[4]!.yaw } },
  ]
  const [touches, setTouches] = useState<Partial<Record<SeatId, Touch>>>({})
  // What the table says: who the game waits for, and who has been seen lately
  const waitingFor: SeatId[] = together ? ["left", "right"] : turn === "none" ? [] : [turn]
  const present: SeatId[] = away ? ["you", "right"] : ["you", "left", "right"]
  const table = { status: "playing" as const, waitingFor, present, winners: [] }
  const sentence = turnSentence(whoseTurn({ status: "playing", waitingFor, meId: "you" }), TURN_WORDS, (id) => NAMES[id as SeatId])
  return (
    <Stage id="scene-seat" camera={CAMERA} playIntro={false}>
      <TurnText text={sentence} at={LINE} />
      {players.map(({ id, color, frame }) => {
        // The room of the cards is the same whether they are there or not: the plate does not move when the last one is played
        const cards: TableBox = boxOfPoses(LAYOUT, CARD_SIZE, { frame })!
        const plate = plateBoxOf(plateAbove(cards))
        const area = joinBoxes([cards, plate])!
        const middle = centreOf(area)
        const touch = touches[id] ?? NO_TOUCH
        const none = empty && id === "left"
        const state = choosing ? effectiveState("interactive", touch) : "base"
        const { active, away: gone } = seatStateOf(table, id)
        return (
          <group key={id}>
            <Seat nickname={NAMES[id]} color={color} theme={DEFAULT_SEAT_THEME} above={cards} active={active} away={gone} line={`${points} pts`} status={stayed && id === "right" ? "Stayed" : undefined} />
            <Zone
              frame={frame}
              layout={LAYOUT}
              size={CARD_SIZE}
              cards={none ? [] : LAYOUT.map((_, i) => ({ key: `${id}-${i}`, front: face(i + 3), back: cardBack, state }))}
            />
            {none && choosing && <LightPool size={{ width: CARD_SIZE.width * SCALE, height: CARD_SIZE.height * SCALE }} state={state} position={[centreOf(cards).x, 0.012, centreOf(cards).z]} />}
            {choosing && (
              <Hotspot
                at={middle}
                width={area.maxX - area.minX + 2 * PADDING}
                depth={area.maxZ - area.minZ + 2 * PADDING}
                ariaLabel={`Give the turn to ${NAMES[id]}`}
                onPress={() => onPick(id)}
                onTouch={(next) => setTouches((now) => ({ ...now, [id]: next }))}
              />
            )}
          </group>
        )
      })}
    </Stage>
  )
}
