"use client"

import { type CameraSettings, lineSpaces, loopSpaces, type SpaceLook, spacesIn, Track, TrackMarker } from "@pbgo/table"
import { useMemo } from "react"
import { TRACK_LINE, TRACK_LOOP, TRACK_REACH } from "../defaults"
import { palette } from "./art"
import { Stage, TableLabel } from "./parts"

// Two tracks. The first runs round and round: twenty spaces on an oval, two pawns that walk along it space by space (they share a space when they meet), and the spaces the red pawn can reach, which can be pressed. The second has an end: eleven spaces in a
// line, along the edge of the table, and a cube that climbs it one point at a time and walks back all the way when the score is reset.

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 17, fov: 34, targetX: 0, targetZ: 0.8 }
/** The table seen from nearly straight above, where the spaces lie as they are laid out. */
const ABOVE: CameraSettings = { tilt: 6, yaw: 0, distance: 17, fov: 34, targetX: 0, targetZ: 0.8 }

/** The markers of the loop: who, in which colour, and where. Their order is the order they came to a space they share */
type Pawn = { id: string; space: number }

export function TrackScene({ red, blue, points, reach, above, onRed }: { red: number; blue: number; points: number; reach: boolean; above: boolean; onRed: (space: number) => void }) {
  const colors = palette()
  const loop = useMemo(() => loopSpaces(TRACK_LOOP, { radiusX: 4.8, radiusZ: 2.3 }), [])
  const line = useMemo(() => spacesIn({ x: 0, z: 5.2 }, lineSpaces(TRACK_LINE, { gap: 1.1 })), [])
  const loopLook = (index: number): SpaceLook => {
    if (index === 0) return { label: "Start", color: colors.ink, ink: colors.ivory }
    return index % 5 === 0 ? { label: String(index), color: colors.marks[2], ink: colors.ink } : { label: String(index) }
  }
  const lineLook = (index: number): SpaceLook => (index === TRACK_LINE - 1 ? { label: String(index), color: colors.marks[2], ink: colors.ink } : { label: String(index) })
  // The spaces ahead of the red pawn, which it can walk to
  const ahead = useMemo(() => Array.from({ length: TRACK_REACH }, (_, k) => (red + 1 + k) % TRACK_LOOP), [red])
  const pawns: Pawn[] = [
    { id: "red", space: red },
    { id: "blue", space: blue },
  ]
  const share = (pawn: Pawn) => {
    const together = pawns.filter((other) => other.space === pawn.space)
    return { slot: together.indexOf(pawn), of: together.length }
  }
  const paint: Record<string, string> = { red: colors.marks[0], blue: colors.navy }
  return (
    <Stage id="scene-track" camera={above ? ABOVE : CAMERA} playIntro={false}>
      <Track spaces={loop} look={loopLook} halo={reach ? ahead : null} haloColor={colors.text} onSpace={reach ? (space) => ahead.includes(space) && onRed(space) : undefined} />
      {pawns.map((pawn) => (
        <TrackMarker key={pawn.id} id={`pawn-${pawn.id}`} spaces={loop} space={pawn.space} loop model="pawn" size={0.56} color={paint[pawn.id]} {...share(pawn)} />
      ))}
      <TableLabel text="A track that goes round" x={0} z={0.2} height={0.5} tone="muted" />
      <Track spaces={line} look={lineLook} />
      <TrackMarker id="points" spaces={line} space={points} model="cube" size={0.6} color={colors.marks[2]} />
      <TableLabel text="A track that ends" x={0} z={6.6} height={0.45} tone="muted" />
    </Stage>
  )
}
