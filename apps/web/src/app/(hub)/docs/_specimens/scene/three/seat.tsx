"use client"

import { DEFAULT_SEAT_THEME } from "@pbgo/core/lib/ui-theme"
import { type CameraSettings, Seat, seats } from "@pbgo/table"
import { palette } from "./art"
import { Stage } from "./parts"
import type { SeatTurn } from "../defaults"

// Three seats of a ring for five players, drawn by the `Seat` of the package itself: the viewer's in front, the left-most opponent's (its avatar before the name) and the right-most's (its avatar after the name). Each has a colour of its own.
// The crown follows whose turn it is, the aura lights for the players the game expects together and for the winners, a seat that is away fades, one that is out fades and is struck, and a plate that can be picked lights up under the pointer.

const CAMERA: CameraSettings = { tilt: 44, yaw: 0, distance: 20, fov: 34, targetX: 0, targetZ: 0.9 }

const RING = { radiusX: 7.4, radiusZ: 4.4 }

export type SeatSceneProps = {
  turn: SeatTurn
  /** Everybody is expected at once, as on a simultaneous step: nobody has the turn */
  expected: boolean
  winner: boolean
  /** The left seat is away, the right seat is out */
  away: boolean
  out: boolean
  /** A plate can be picked: a click on it gives it the turn */
  pick: boolean
  points: number
  onPick: (seat: "you" | "left" | "right") => void
}

export function SeatScene({ turn, expected, winner, away, out, pick, points, onPick }: SeatSceneProps) {
  const p = palette()
  const ring = seats(5, { ...RING, me: 0 })
  const players = [
    { id: "you", nickname: "Alix", color: p.ivory, spot: ring[0]!, viewer: true },
    { id: "left", nickname: "Basile", color: p.marks[2], spot: ring[1]!, viewer: false },
    { id: "right", nickname: "Camille", color: p.marks[0], spot: ring[4]!, viewer: false },
  ] as const
  return (
    <Stage id="scene-seat" camera={CAMERA} playIntro={false}>
      {players.map(({ id, nickname, color, spot, viewer }) => (
        <Seat
          key={id}
          nickname={nickname}
          color={color}
          theme={DEFAULT_SEAT_THEME}
          spot={spot}
          viewer={viewer}
          active={!expected && turn === id}
          waiting={expected}
          away={away && id === "left"}
          out={out && id === "right"}
          winner={winner}
          line={`${points} pts`}
          status={out && id === "right" ? "Busted" : undefined}
          onSelect={pick ? () => onPick(id) : undefined}
        />
      ))}
    </Stage>
  )
}
