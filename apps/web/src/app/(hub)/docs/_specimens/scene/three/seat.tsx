"use client"

import { DEFAULT_SEAT_THEME } from "@pbgo/core/lib/ui-theme"
import { type CameraSettings, Seat, seats } from "@pbgo/table"
import { palette } from "./art"
import { Stage } from "./parts"
import type { SeatTurn } from "../defaults"

// Three seats of a ring for five players, drawn by the `Seat` of the package itself: the viewer's in front, the left-most opponent's (its avatar before the name) and the right-most's (its avatar after the name). Each has a colour of its own,
// the aura and the crown follow whose turn it is, and the winners all light up.

const CAMERA: CameraSettings = { tilt: 44, yaw: 0, distance: 20, fov: 34, targetX: 0, targetZ: 0.9 }

const RING = { radiusX: 7.4, radiusZ: 4.4 }

export function SeatScene({ turn, winner, points }: { turn: SeatTurn; winner: boolean; points: number }) {
  const p = palette()
  const ring = seats(5, { ...RING, me: 0 })
  const players = [
    { id: "you", nickname: "Alix", color: p.ivory, spot: ring[0]!, viewer: true },
    { id: "left", nickname: "Basile", color: p.marks[2], spot: ring[1]!, viewer: false },
    { id: "right", nickname: "Camille", color: p.marks[0], spot: ring[4]!, viewer: false },
  ]
  return (
    <Stage id="scene-seat" camera={CAMERA} playIntro={false}>
      {players.map(({ id, nickname, color, spot, viewer }) => (
        <Seat key={id} nickname={nickname} color={color} theme={DEFAULT_SEAT_THEME} spot={spot} viewer={viewer} active={turn === id} winner={winner} line={`${points} pts`} />
      ))}
    </Stage>
  )
}
