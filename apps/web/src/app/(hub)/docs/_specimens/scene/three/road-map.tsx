"use client"

import { Board, type CameraSettings, hexCells, hexPoints, Piece, RoadMap } from "@pbgo/table"
import { useMemo } from "react"
import { ISLAND, ISLAND_NUMBERS, ISLAND_TILES, type IslandPlayer } from "../defaults"
import { ISLAND_BOARD, ISLAND_CORNERS } from "../island"
import { palette, tileColors } from "./art"
import { Stage } from "./parts"

// An island of nineteen hexagons, the way Catan is built. The tiles are a `Board`. The settlements stand on the points where the hexagons meet and the roads run along their sides: both are the engine's `cornerGraph` of the same board, and `hexPoints` says
// where its points are on the table. A `RoadMap` draws the roads that are built, in their owner's colour, and what can be built now pulses; the settlements are pieces. The scene holds nothing: it shows what it is given and says what was pressed.

const CAMERA: CameraSettings = { tilt: 36, yaw: 0, distance: 12.2, fov: 34, targetX: 0, targetZ: 0.3 }

export type RoadMapSceneProps = {
  /** Who has a settlement on each point of the island, or nobody */
  settlements: readonly (IslandPlayer | null)[]
  /** Who has built each side of the island, or nobody */
  roads: readonly (IslandPlayer | null)[]
  /** The points and the sides that can be built on now */
  halo: { places: readonly number[]; roads: readonly number[] }
  onPlace: (point: number) => void
  onRoad: (side: number) => void
}

export function RoadMapScene({ settlements, roads, halo, onPlace, onRoad }: RoadMapSceneProps) {
  const colors = palette()
  const tiles = tileColors()
  const players = [colors.marks[0], colors.navy] as const
  const cells = useMemo(() => hexCells(ISLAND_BOARD.coords, { size: ISLAND.size, gap: ISLAND.gap }), [])
  const points = useMemo(() => hexPoints(ISLAND_BOARD.coords, { size: ISLAND.size }), [])
  return (
    <Stage id="scene-road-map" camera={CAMERA} playIntro={false}>
      <Board
        cells={cells}
        look={(cell) => {
          const number = ISLAND_NUMBERS[cell] ?? 0
          return { color: tiles[ISLAND_TILES[cell] ?? "desert"], label: number === 0 ? "" : String(number), ink: number === 6 || number === 8 ? colors.marks[0] : colors.ink }
        }}
      />
      <RoadMap
        places={points}
        roads={ISLAND_CORNERS.edges}
        placeLook={() => ({ hidden: true })}
        roadLook={(side) => {
          const owner = roads[side]
          return owner === null || owner === undefined ? { hidden: true } : { color: players[owner] }
        }}
        halo={halo}
        haloColor={colors.ink}
        onPlace={onPlace}
        onRoad={onRoad}
      />
      {settlements.map((owner, point) => (owner === null ? null : <Piece key={point} id={`settlement-${point}`} model="cube" size={0.46} color={players[owner]} at={points[point]!} />))}
    </Stage>
  )
}
