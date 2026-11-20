"use client"

import { DEFAULT_SEAT_THEME } from "@pbgo/core/lib/ui-theme"
import { boxAbove, type CameraSettings, frameBoxOfPoses, heldFan, HeldHand, heldShadow, inFrame, joinBoxes, onAxis, onTable, Pile, type Pose, RESTING_HEIGHT, row, SCREEN_HAND_SETTINGS, ScreenHand, screenHandLayout, Seat, seats, type Spot, type TableBox, Zone, type ZoneCard } from "@pbgo/table"
import { useState } from "react"
import { back, CARD_SIZE, DECK, face, mat, palette } from "./art"
import { Stage } from "./parts"

// A whole small card table on the shared tools, the way the template builds one (`template/src/components/board/`, whose numbers these are) and as Courtisans lays its own: the viewer's hand held at the bottom left of the screen (`ScreenHand`, a `Zone` in the frame of the
// camera), and every player a line along the axis of their seat, turned as their name is and in this order from the middle of the table: the name, the info line just under it, the play area (a card lying face up) and the hand, which is for each other player a small fan of backs that
// stands with a small round shadow under it (`HeldHand`). A draw `Pile` and the middle of the table, which is a `Zone` too, all on a dark mat lit at its middle. The scene holds no rule: it is given what is where, and sends the card that was pressed.

const CAMERA: CameraSettings = { tilt: 42, yaw: 0, distance: 21, fov: 34, targetX: 0, targetZ: 1.2 }

/** The ring of seats. */
const RING = { radiusX: 7.4, radiusZ: 4.4 }

/** How far beyond its seat on the ring the line of a player stands, along x and along z. */
const REACH = { x: 1.2, z: 1.32 }

/** The cards each other player holds. */
const OPPONENT_CARDS = 5

/** The players' names, the viewer's first. */
const NAMES = ["Alix", "Basile", "Camille", "Dylan", "Eva"]

type Seated = Required<Spot>

/** The viewer's hand: Courtisans' numbers, with the room it may take stopped short of the viewer's name in the middle. */
const HAND = { ...SCREEN_HAND_SETTINGS, room: 0.42 }

/** The frame of a seat: just beyond it on the ring, turned like it, so that its top is toward the middle of the table. The name, the play area and the hand stand in it, on its axis. */
function seatFrame(seat: Seated): Spot {
  return { x: seat.x * REACH.x, z: seat.z * REACH.z, yaw: seat.yaw }
}

/** What the viewer's hand takes of their line: nothing, since it is held on the screen; its place is the foot of the line, where the seat is. */
const VIEWER_HAND: TableBox = { minX: -1, maxX: 1, minZ: 0, maxZ: 0 }

/** The small round shadow under a hand. */
const SHADOW = heldShadow()

/** A card of the play area is smaller than the cards of the hand, and stands a little clear of it. */
const PLAY = { scale: 0.7, room: 0.25 }

/** The cards played to the middle, side by side. */
function middleLayout(n: number): Pose[] {
  return row(n, { gap: 1.45, y: RESTING_HEIGHT, rise: 0.012, z: 0.3 })
}

const DRAW_PILE: Spot = { x: 5.2, z: 2.6 }

/** The line of a seat in its frame: the room of the hand, the play area above it (toward the middle) and the box the plate stands above, all on the axis. */
function lineOf(seat: Seated, viewer: boolean) {
  const frame = seatFrame(seat)
  const hand = viewer ? VIEWER_HAND : onAxis(frameBoxOfPoses(heldFan(OPPONENT_CARDS, seat.yaw, CARD_SIZE), CARD_SIZE, frame, { tilt: CAMERA.tilt })!)
  const play = boxAbove(hand, { width: CARD_SIZE.width * PLAY.scale, depth: CARD_SIZE.height * PLAY.scale }, PLAY.room, 0)
  return { frame, play, line: onAxis(joinBoxes([hand, play])!) }
}

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

  // Every player is one line: the name, the info line, the play area and the hand
  const lines = ring.map((seat, i) => ({ seat, i, ...lineOf(seat, i === 0) }))
  const playLayout = lines.map(({ frame, play }) => inFrame(frame, onTable(0, (play.minZ + play.maxZ) / 2, { scale: PLAY.scale })))
  const playCards: ZoneCard[] = lines.map(({ i }) => ({ key: `play-${i}`, front: face(3 + i * 4), back: cardBack }))

  return (
    <Stage id="scene-board" camera={CAMERA} surface={mat()}>
      {lines.map(({ seat, i, frame, line }) => (
        <group key={i}>
          {/* The name stands above the play area, which stands above the hand, on the axis of the seat and turned with it: the same line at every seat, the viewer's included */}
          <Seat frame={frame} above={line} nickname={NAMES[i] ?? `Player ${i + 1}`} color={colors[i] ?? p.ivory} theme={DEFAULT_SEAT_THEME} line="0 pts" />
          {i > 0 && <HeldHand count={OPPONENT_CARDS} frame={frame} layout={(n) => heldFan(n, seat.yaw, CARD_SIZE)} size={CARD_SIZE} back={cardBack} enter={DECK} shadow={SHADOW} />}
        </group>
      ))}
      <Zone layout={playLayout} size={CARD_SIZE} cards={playCards} />
      <Pile frame={DRAW_PILE} count={14} size={CARD_SIZE} back={cardBack} lean="draw" leanAmplitude={0.06} />
      {/* The viewer's hand is held at the bottom left of the screen, whatever the window; its place on their line is the foot of it */}
      <ScreenHand settings={HAND}>
        {(screen) => <Zone layout={screenHandLayout(hand.length, screen, CARD_SIZE, HAND, raised)} size={CARD_SIZE} enter={screen.local(DECK)} cards={handCards} />}
      </ScreenHand>
      <Zone layout={middleLayout(played.length)} size={CARD_SIZE} cards={middleCards} />
    </Stage>
  )
}
