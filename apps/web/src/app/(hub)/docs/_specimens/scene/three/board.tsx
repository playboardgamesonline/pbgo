"use client"

import { DEFAULT_SEAT_THEME } from "@pbgo/core/lib/ui-theme"
import { type CameraSettings, frameBoxOfPoses, heldFan, HeldHand, heldShadow, heldYaw, inFrame, outOfFrame, Pile, type Pose, RESTING_HEIGHT, row, SCREEN_HAND_SETTINGS, ScreenHand, screenHandLayout, Seat, seats, type Spot, Zone, type ZoneCard } from "@pbgo/table"
import { useState } from "react"
import { back, CARD_SIZE, DECK, face, mat, palette } from "./art"
import { Stage } from "./parts"

// A whole small card table on the shared tools, the way the template builds one (`template/src/components/board/`, whose numbers these are) and as Courtisans lays its own: the viewer's hand held at the bottom left of the screen (`ScreenHand`, a `Zone` in the frame of the
// camera), the cards each other player holds as a small fan of backs that stands, turned toward the viewer, with a small round shadow under it (`HeldHand`) and their name on the side of the cards that faces the middle, the viewer's name in the middle of the front of the table, a draw `Pile` and the middle of the
// table, which is a `Zone` too, all on a dark mat lit at its middle. The scene holds no rule: it is given what is where, and sends the card that was pressed.

const CAMERA: CameraSettings = { tilt: 42, yaw: 0, distance: 21, fov: 34, targetX: 0, targetZ: 1.2 }

/** The ring of seats. */
const RING = { radiusX: 7.4, radiusZ: 4.4 }

/** The cards each other player holds. */
const OPPONENT_CARDS = 5

/** The players' names, the viewer's first. */
const NAMES = ["Alix", "Basile", "Camille", "Dylan", "Eva"]

type Seated = Required<Spot>

/** The viewer's hand: Courtisans' numbers, with the room it may take stopped short of the viewer's name in the middle. */
const HAND = { ...SCREEN_HAND_SETTINGS, room: 0.42 }

/** The frame of an opponent at their seat: just beyond it, turned like it, so its top is toward the middle of the table. Their name stands in it, facing the middle. */
function seatFrame(seat: Seated): Spot {
  return { x: seat.x * 1.2, z: seat.z * 1.2, yaw: seat.yaw }
}

/** The frame of the cards an opponent holds: at their seat, turned toward the viewer, so that their backs show and the cards can be counted. */
function handFrame(seat: Seated): Spot {
  return { ...seatFrame(seat), yaw: heldYaw(seat.yaw) }
}

/** The small round shadow under a hand. */
const SHADOW = heldShadow()

/** The cards played to the middle, side by side. */
function middleLayout(n: number): Pose[] {
  return row(n, { gap: 1.45, y: RESTING_HEIGHT, rise: 0.012, z: 0.3 })
}

const DRAW_PILE: Spot = { x: 5.2, z: 2.6 }

export function BoardScene({ players, hand, played, onPlay }: { players: number; hand: readonly number[]; played: readonly number[]; onPlay: (id: number) => void }) {
  const p = palette()
  const cardBack = back()
  const ring = seats(players, { ...RING, me: 0 })
  const colors = [p.ivory, p.marks[2], p.marks[0], p.marks[1], p.marks[3] ?? p.marks[2]]
  const [hovered, setHovered] = useState<number | null>(null)
  const raised = hovered === null ? -1 : hand.indexOf(hovered)

  const handCards: ZoneCard[] = hand.map((id) => ({
    key: id,
    id,
    front: face(id),
    back: cardBack,
    // The cards can be chosen: the table lights the one under the pointer or the keyboard focus, lifts it and gives it its shine
    state: "interactive",
    ariaLabel: `Play card ${id}`,
    onPress: () => onPlay(id),
    onHover: (over) => setHovered((now) => (over ? id : now === id ? null : now)),
  }))
  const middleCards: ZoneCard[] = played.map((id) => ({ key: id, id, front: face(id), back: cardBack }))

  return (
    <Stage id="scene-board" camera={CAMERA} surface={mat()}>
      {ring.slice(1).map((seat, i) => {
        const plate = seatFrame(seat)
        const hand = handFrame(seat)
        const yaw = heldYaw(seat.yaw)
        // The cards, in the frame of the seat: the hand is turned toward the viewer and the name is not
        const cards = frameBoxOfPoses(heldFan(OPPONENT_CARDS, yaw, CARD_SIZE).map((pose) => outOfFrame(plate, inFrame(hand, pose))), CARD_SIZE, plate, { tilt: CAMERA.tilt })!
        return (
          <group key={i}>
            {/* The name stands on the side of the cards that faces the middle of the table, turned with the seat */}
            <Seat frame={plate} above={cards} nickname={NAMES[i + 1] ?? `Player ${i + 2}`} color={colors[i + 1] ?? p.ivory} theme={DEFAULT_SEAT_THEME} line="0 pts" />
            <HeldHand count={OPPONENT_CARDS} frame={hand} layout={(n) => heldFan(n, yaw, CARD_SIZE)} size={CARD_SIZE} back={cardBack} enter={DECK} shadow={SHADOW} />
          </group>
        )
      })}
      <Pile frame={DRAW_PILE} count={14} size={CARD_SIZE} back={cardBack} lean="draw" leanAmplitude={0.06} />
      {/* The viewer's name stays at their seat, in the middle of the front of the table; their hand is at the bottom left of the screen, whatever the window */}
      <Seat spot={ring[0]!} viewer nickname={NAMES[0]!} color={colors[0]!} theme={DEFAULT_SEAT_THEME} line="0 pts" />
      <ScreenHand settings={HAND}>
        {(screen) => <Zone layout={screenHandLayout(hand.length, screen, CARD_SIZE, HAND, raised)} size={CARD_SIZE} enter={screen.local(DECK)} cards={handCards} />}
      </ScreenHand>
      <Zone layout={middleLayout(played.length)} size={CARD_SIZE} cards={middleCards} />
    </Stage>
  )
}
