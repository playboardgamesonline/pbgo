"use client"

import { DEFAULT_SEAT_THEME } from "@pbgo/core/lib/ui-theme"
import { type CameraSettings, CornerHand, fan, frameBoxOfPoses, HandShadow, joinBoxes, Pile, type Pose, RESTING_HEIGHT, row, scalePoses, Seat, seats, type Spot, type TableBox, Zone, type ZoneCard } from "@pbgo/table"
import { BOARD_HAND } from "../defaults"
import { back, CARD_SIZE, DECK, face, palette } from "./art"
import { Stage } from "./parts"

// A whole small board on the shared tools, the way the template builds one (`template/src/components/board/`, whose numbers these are): the viewer's hand in the bottom left of the screen (`CornerHand`, a `Zone` over `fan`), the cards each other player holds up in
// a fan in the frame of their seat from `seats` (which faces the middle of the table) with a round shadow under it, each player's plate on the side of their cards that faces the middle, a draw `Pile` and the middle of the table, which is a `Zone` too. The scene
// holds no rule: it is given what is where, and sends the card that was clicked.

const CAMERA: CameraSettings = { tilt: 40, yaw: 0, distance: 21, fov: 34, targetX: 0, targetZ: 1.6 }

/** The ring of seats. */
const RING = { radiusX: 7.4, radiusZ: 4.4 }

/** The cards each other player holds. */
const OPPONENT_CARDS = 5

/** The players' names, the viewer's first. */
const NAMES = ["Alix", "Basile", "Camille", "Dylan", "Eva"]

type Seated = Required<Spot>

/** The slots of the viewer's hand of `n` cards, a fan in the frame of the hand. The table lifts the card under the pointer: the layout does not. */
function handLayout(n: number): Pose[] {
  return fan(n, { gap: 1.05, y: 1.1, rise: 0.004, curve: 0.06, tilt: 0.62, roll: 0.05, scale: 1.2 })
}

/** What the hand is drawn at before it is made to fit the corner of the screen: the width of a hand of the most cards, its depth, and how high the top edge of a card stands. */
const HAND_ROOM = { most: (BOARD_HAND.length - 1) * 1.05 + CARD_SIZE.width * 1.2, depth: 3.2, height: 1.1 + (CARD_SIZE.height / 2) * Math.sin(0.62) * 1.2 }

/** The box of the viewer's cards in their frame, at the scale that fits: a hand of every size, so the plate does not move as cards are played. */
function handBox(scale: number): TableBox {
  const frame: Spot = { x: 0, z: 0, yaw: 0 }
  return joinBoxes(Array.from({ length: BOARD_HAND.length }, (_, i) => frameBoxOfPoses(scalePoses(handLayout(i + 1), scale), CARD_SIZE, frame, { tilt: CAMERA.tilt })))!
}

/** The frame of the cards an opponent holds: just beyond their seat, turned like it, so its top is toward the middle of the table. */
function heldFrame(seat: Seated): Spot {
  return { x: seat.x * 1.2, z: seat.z * 1.2, yaw: seat.yaw }
}

/** Their backs, held up in a fan that leans toward the middle of the table. */
function heldLayout(n: number): Pose[] {
  return fan(n, { gap: 0.34, y: 0.8, rise: 0.004, curve: 0.08, tilt: -0.55, roll: 0.11, face: "down", scale: 0.68 })
}

/** How far the round shadow under a held hand reaches. */
const HELD_SHADOW = { radius: 1.7, opacity: 0.4 }

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

  const handCards: ZoneCard[] = hand.map((id) => ({
    key: id,
    id,
    front: face(id),
    back: cardBack,
    // The cards can be chosen: the table lights the one under the pointer or the keyboard focus and lifts it
    state: "interactive",
    ariaLabel: `Play card ${id}`,
    onPress: () => onPlay(id),
  }))
  const middleCards: ZoneCard[] = played.map((id) => ({ key: id, id, front: face(id), back: cardBack }))

  return (
    <Stage id="scene-board" camera={CAMERA}>
      {ring.slice(1).map((seat, i) => {
        const frame = heldFrame(seat)
        const cards = frameBoxOfPoses(heldLayout(OPPONENT_CARDS), CARD_SIZE, frame, { tilt: CAMERA.tilt })!
        return (
          <group key={i}>
            <HandShadow at={frame} radius={HELD_SHADOW.radius} opacity={HELD_SHADOW.opacity} />
            {/* The name stands on the side of the cards that faces the middle of the table, turned with the seat */}
            <Seat frame={frame} above={cards} nickname={NAMES[i + 1] ?? `Player ${i + 2}`} color={colors[i + 1] ?? p.ivory} theme={DEFAULT_SEAT_THEME} line="0 pts" />
            <Zone
              frame={frame}
              layout={heldLayout(OPPONENT_CARDS)}
              size={CARD_SIZE}
              enter={DECK}
              cards={Array.from({ length: OPPONENT_CARDS }, (_, k) => ({ key: `back-${k}`, front: cardBack, back: cardBack }))}
            />
          </group>
        )
      })}
      <Pile frame={DRAW_PILE} count={14} size={CARD_SIZE} back={cardBack} lean="draw" leanAmplitude={0.06} />
      {/* The viewer's hand, in the bottom left of the screen whatever the window, with their name above it */}
      <CornerHand most={HAND_ROOM.most} depth={HAND_ROOM.depth} height={HAND_ROOM.height}>
        {(corner) => {
          const frame: Spot = { x: corner.x, z: corner.z, yaw: 0 }
          return (
            <>
              <Seat frame={frame} above={handBox(corner.scale)} nickname={NAMES[0]!} color={colors[0]!} theme={DEFAULT_SEAT_THEME} line="0 pts" />
              <Zone frame={frame} layout={scalePoses(handLayout(hand.length), corner.scale)} size={CARD_SIZE} enter={DECK} cards={handCards} />
            </>
          )
        }}
      </CornerHand>
      <Zone layout={middleLayout(played.length)} size={CARD_SIZE} cards={middleCards} />
    </Stage>
  )
}
