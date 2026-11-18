"use client"

import { DEFAULT_SEAT_THEME } from "@pbgo/core/lib/ui-theme"
import {
  type CameraSettings,
  centreOf,
  effectiveState,
  fan,
  frameBoxOfPoses,
  HeldHand,
  Hotspot,
  joinBoxes,
  LightPool,
  NO_TOUCH,
  plateAbove,
  plateBoxOf,
  type Pose,
  pointInFrame,
  SCREEN_HAND_SETTINGS,
  ScreenHand,
  screenHandLayout,
  Seat,
  seats,
  seatStateOf,
  type Spot,
  type TableBox,
  type Touch,
  Zone,
} from "@pbgo/table"
import { useState } from "react"
import { back, CARD_SIZE, DECK, face, mat, palette } from "./art"
import { Stage } from "./parts"
import type { SeatTurn } from "../defaults"

// Three seats of a ring for five players, drawn by the `Seat` of the package itself: the viewer's, whose name stands in the middle of the front of the table and whose hand is held big at the bottom left of the screen, and the left-most and right-most opponents', each holding a
// fan of cards that stands, with its small round shadow under it. Every opponent's hand and plate are drawn in the frame of their seat, which faces the middle of the table: the plate stands on the side of the cards that faces the middle, and turns with the seat. The crown follows
// whose turn it is and a seat that is away fades. With "choose a player" on, the cards of each opponent glow while they can be chosen, brighter under the pointer, brightest while pressed: the area they lie in is invisible, and the plate lies in it without reacting.

const CAMERA: CameraSettings = { tilt: 44, yaw: 0, distance: 20, fov: 34, targetX: 0, targetZ: 0.9 }

const RING = { radiusX: 7.4, radiusZ: 4.4 }

/** The cards an opponent holds, a fan in the frame of their seat that stands, backs to the viewer: nearly straight for a seat the viewer sees from the front, leaning toward the middle for one at the side */
const HELD = 5
const heldLayout = (n: number, yaw: number): Pose[] => {
  const tilt = -1.25 + (-1.0 + 1.25) * Math.abs(Math.sin(yaw))
  return fan(n, { gap: 0.3, y: 0.66, rise: 0.004, curve: 0.08, tilt, roll: 0.12, face: "down", scale: 0.68 })
}
/** How far beyond its seat on the ring an opponent's hand stands, and how far its small round shadow reaches */
const REACH = 1.2
const SHADOW = { radius: (n: number) => 0.6 + 0.13 * n, opacity: 0.55 }
/** The viewer's hand: Courtisans' numbers, with the room it may take stopped short of the viewer's name in the middle */
const HAND = { ...SCREEN_HAND_SETTINGS, room: 0.42 }
/** The room around a player's cards and plate that a press counts in, in world units */
const PADDING = 0.3

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

/** A hand and its plate, in the frame of a seat: the box of the cards, the box of the plate beyond it, and the area a press counts in, all in the frame */
function boxesOf(layout: readonly Pose[], frame: Spot) {
  const cards: TableBox = frameBoxOfPoses(layout, CARD_SIZE, frame, { tilt: CAMERA.tilt })!
  const plate = plateBoxOf(plateAbove(cards))
  const area = joinBoxes([cards, plate])!
  return { cards, plate, area }
}

export function SeatScene({ turn, together, away, stayed, choosing, empty, points, onPick }: SeatSceneProps) {
  const p = palette()
  const cardBack = back()
  const ring = seats(5, { ...RING, me: 0 })
  const [touches, setTouches] = useState<Partial<Record<SeatId, Touch>>>({})
  // What the table says: who the game waits for, and who has been seen lately
  const waitingFor: SeatId[] = together ? ["left", "right"] : turn === "none" ? [] : [turn]
  const present: SeatId[] = away ? ["you", "right"] : ["you", "left", "right"]
  const table = { status: "playing" as const, waitingFor, present, winners: [] }
  const stateOf = (id: SeatId) => {
    const touch = touches[id] ?? NO_TOUCH
    return choosing ? effectiveState("interactive", touch) : "base"
  }
  const hotspot = (id: SeatId, frame: Spot, area: TableBox) => {
    const middle = pointInFrame(frame, centreOf(area))
    return (
      <Hotspot
        at={{ ...middle, yaw: frame.yaw }}
        width={area.maxX - area.minX + 2 * PADDING}
        depth={area.maxZ - area.minZ + 2 * PADDING}
        ariaLabel={`Give the turn to ${NAMES[id]}`}
        onPress={() => onPick(id)}
        onTouch={(next) => setTouches((now) => ({ ...now, [id]: next }))}
      />
    )
  }
  const opponent = (id: "left" | "right", spot: Required<Spot>, color: string) => {
    const frame: Spot = { x: spot.x * REACH, z: spot.z * REACH, yaw: spot.yaw }
    const slots = heldLayout(HELD, spot.yaw)
    const { cards, area } = boxesOf(slots, frame)
    const none = empty && id === "left"
    const { active, away: gone } = seatStateOf(table, id)
    const state = stateOf(id)
    return (
      <group key={id}>
        <Seat frame={frame} above={cards} nickname={NAMES[id]} color={color} theme={DEFAULT_SEAT_THEME} active={active} away={gone} line={`${points} pts`} status={stayed && id === "right" ? "Stayed" : undefined} />
        <HeldHand count={none ? 0 : HELD} frame={frame} layout={(n) => heldLayout(n, spot.yaw)} size={CARD_SIZE} back={cardBack} shadow={SHADOW} {...(choosing ? { state } : {})} />
        {none && choosing && (
          <LightPool
            size={{ width: CARD_SIZE.width * 0.68, height: CARD_SIZE.height * 0.68 }}
            state={state}
            position={[pointInFrame(frame, centreOf(cards)).x, 0.012, pointInFrame(frame, centreOf(cards)).z]}
            yaw={frame.yaw}
          />
        )}
        {choosing && hotspot(id, frame, area)}
      </group>
    )
  }
  const { active, away: gone } = seatStateOf(table, "you")
  const hand = [8, 11, 14, 17]
  return (
    <Stage id="scene-seat" camera={CAMERA} playIntro={false} surface={mat()}>
      {opponent("left", ring[1]!, p.marks[2])}
      {opponent("right", ring[4]!, p.marks[0])}
      {/* The viewer's name stays at their seat, in the middle of the front of the table, and their hand is held at the bottom left of the screen */}
      <Seat spot={ring[0]!} viewer nickname={NAMES.you} color={p.ivory} theme={DEFAULT_SEAT_THEME} active={active} away={gone} line={`${points} pts`} />
      <ScreenHand settings={HAND}>
        {(screen) => <Zone layout={screenHandLayout(hand.length, screen, CARD_SIZE, HAND)} size={CARD_SIZE} enter={screen.local(DECK)} cards={hand.map((n, i) => ({ key: `you-${i}`, front: face(n), back: cardBack }))} />}
      </ScreenHand>
    </Stage>
  )
}
