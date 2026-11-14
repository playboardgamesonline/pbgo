"use client"

import { DEFAULT_SEAT_THEME } from "@pbgo/core/lib/ui-theme"
import { type CameraSettings, FloorButton, plateOf, Seat, SEAT_SETTINGS, seats } from "@pbgo/table"
import { palette } from "./art"
import { Stage } from "./parts"
import type { SeatTurn } from "../defaults"

// Three seats of a ring for five players, drawn by the `Seat` of the package itself: the viewer's in front, the left-most opponent's (its avatar before the name) and the right-most's (its avatar after the name). Each has a colour of its own.
// The crown follows whose turn it is, the aura lights for the players the game expects together and for the winners, a seat that is away fades. With `zones` on, each plate lies inside a floor zone: the rim of the zone lifts under the pointer and the plate does not react at all.

const CAMERA: CameraSettings = { tilt: 44, yaw: 0, distance: 20, fov: 34, targetX: 0, targetZ: 0.9 }

const RING = { radiusX: 7.4, radiusZ: 4.4 }

export type SeatSceneProps = {
  turn: SeatTurn
  /** Everybody is expected at once, as on a simultaneous step: nobody has the turn */
  expected: boolean
  winner: boolean
  /** The left seat is away */
  away: boolean
  /** The right seat has stayed: a status after the score */
  stayed: boolean
  /** Each plate lies in a zone that a click presses, to give the player the turn: the zone's rim lifts, the plate never reacts */
  zones: boolean
  points: number
  onPick: (seat: "you" | "left" | "right") => void
}

export function SeatScene({ turn, expected, winner, away, stayed, zones, points, onPick }: SeatSceneProps) {
  const p = palette()
  const ring = seats(5, { ...RING, me: 0 })
  const players = [
    { id: "you", nickname: "Alix", color: p.ivory, spot: ring[0]!, viewer: true },
    { id: "left", nickname: "Basile", color: p.marks[2], spot: ring[1]!, viewer: false },
    { id: "right", nickname: "Camille", color: p.marks[0], spot: ring[4]!, viewer: false },
  ] as const
  return (
    <Stage id="scene-seat" camera={CAMERA} playIntro={false}>
      {zones &&
        players.map(({ id, spot, viewer }) => {
          const plate = plateOf(spot, viewer)
          return (
            <FloorButton
              key={id}
              at={{ x: plate.x, z: plate.z }}
              width={SEAT_SETTINGS.auraWidth + 1.4}
              depth={SEAT_SETTINGS.auraDepth + 1}
              tone="#7fd4c4"
              tint={0.3}
              hitY={0.35}
              ariaLabel={`Give the turn to ${id}`}
              onPress={() => onPick(id)}
            />
          )
        })}
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
          winner={winner}
          line={`${points} pts`}
          status={stayed && id === "right" ? "Stayed" : undefined}
        />
      ))}
    </Stage>
  )
}
