"use client"

import { hexBoard, squareBoard } from "@pbgo/engine-kit"
import { Board, type CameraSettings, type CellLook, hexCells, squareCells, TrackMarker } from "@pbgo/table"
import { useMemo } from "react"
import { GRID, GRID_WALLS, type GridKind } from "../defaults"
import { palette } from "./art"
import { Stage, TableLabel } from "./parts"

// Two boards. On the left sixty squares' worth of a chessboard's look, thirty-six squares with a wall of three cells; on the right a hexagon of nineteen hexagons, numbered, with a wall of its own. A pawn stands on each: pressing it rings the cells it can reach
// in the steps it has, going round the walls, and pressing a ringed cell sends it there across the cells; or the pawn is picked up and let go on one of them, and it is carried there. The cells the pawn can reach and the way it walks are what the engine's
// `reachable` and `shortestPath` say; the cells are what `squareCells` and `hexCells` make from the board's own coordinates.

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 18, fov: 34, targetX: 0, targetZ: 0.8 }
/** The table seen from nearly straight above, where the cells lie as they are laid out. */
const ABOVE: CameraSettings = { tilt: 6, yaw: 0, distance: 18, fov: 34, targetX: 0, targetZ: 0.8 }
const SQUARE_AT = { x: -4.3, z: 0.6 }
// Both boards number their cells from 0, so a cell is a zone named by its board and its number: a pawn let go on a cell of the other board is let go on a zone it has no business on
const zoneOf = (kind: GridKind, cell: number) => `${kind}:${cell}`
const cellOf = (kind: GridKind, target: string | number | null): number | null => (typeof target === "string" && target.startsWith(`${kind}:`) ? Number(target.slice(kind.length + 1)) : null)
const HEX_AT = { x: 4.6, z: 0.6 }

export function GridScene({
  squareAt,
  squareRoute,
  hexAt,
  hexRoute,
  picked,
  reach,
  above,
  onPick,
  onCell,
  onDrop,
}: {
  squareAt: number
  squareRoute: readonly number[]
  hexAt: number
  hexRoute: readonly number[]
  picked: GridKind | null
  reach: Record<GridKind, readonly number[]>
  above: boolean
  onPick: (kind: GridKind) => void
  onCell: (kind: GridKind, cell: number) => void
  onDrop: (kind: GridKind, cell: number) => void
}) {
  const colors = palette()
  const square = useMemo(() => squareCells(squareBoard({ columns: GRID.columns, rows: GRID.rows }).coords, { size: 1.05, gap: 0.05, at: SQUARE_AT }), [])
  const hex = useMemo(() => hexCells(hexBoard({ radius: GRID.radius }).coords, { size: 1.2, gap: 0.06, at: HEX_AT }), [])
  const squareCoords = useMemo(() => squareBoard({ columns: GRID.columns, rows: GRID.rows }).coords, [])
  const hexCoords = useMemo(() => hexBoard({ radius: GRID.radius }).coords, [])

  const squareLook = (cell: number): CellLook => {
    if (GRID_WALLS.square.includes(cell)) return { color: colors.muted }
    const [col, row] = squareCoords[cell]!
    return { color: (col + row) % 2 === 0 ? colors.ivory : colors.marks[2] }
  }
  const hexTones = [colors.ivory, colors.marks[2], colors.navy]
  const hexLook = (cell: number): CellLook => {
    if (GRID_WALLS.hex.includes(cell)) return { color: colors.muted }
    const [q, r] = hexCoords[cell]!
    const tone = (((q - r) % 3) + 3) % 3
    return { color: hexTones[tone], label: String(cell), ink: tone === 2 ? colors.ivory : colors.ink }
  }
  const ring = (kind: GridKind) => (picked === kind ? reach[kind] : null)
  const press = (kind: GridKind) => (picked === kind ? (cell: number) => reach[kind].includes(cell) && onCell(kind, cell) : undefined)

  return (
    <Stage id="scene-grid" camera={above ? ABOVE : CAMERA} playIntro={false}>
      <Board cells={square} look={squareLook} halo={ring("square")} drops={reach.square} dropId={(cell) => zoneOf("square", cell)} haloColor={colors.marks[0]} onCell={press("square")} />
      <TrackMarker
        id="pawn-square"
        spaces={square}
        space={squareAt}
        route={squareRoute}
        direct
        model="pawn"
        size={0.7}
        color={colors.marks[0]}
        lift={picked === "square" ? 0.35 : 0}
        draggable
        dropOn={reach.square.map((cell) => zoneOf("square", cell))}
        onDrop={({ target }) => {
          const cell = cellOf("square", target)
          if (cell !== null) onDrop("square", cell)
        }}
        onClick={(event) => {
          event.stopPropagation()
          onPick("square")
        }}
      />
      <TableLabel text="Squares" x={SQUARE_AT.x} z={4.7} height={0.45} tone="muted" />
      <Board cells={hex} look={hexLook} halo={ring("hex")} drops={reach.hex} dropId={(cell) => zoneOf("hex", cell)} haloColor={colors.marks[0]} onCell={press("hex")} />
      <TrackMarker
        id="pawn-hex"
        spaces={hex}
        space={hexAt}
        route={hexRoute}
        direct
        model="pawn"
        size={0.7}
        color={colors.marks[0]}
        lift={picked === "hex" ? 0.35 : 0}
        draggable
        dropOn={reach.hex.map((cell) => zoneOf("hex", cell))}
        onDrop={({ target }) => {
          const cell = cellOf("hex", target)
          if (cell !== null) onDrop("hex", cell)
        }}
        onClick={(event) => {
          event.stopPropagation()
          onPick("hex")
        }}
      />
      <TableLabel text="Hexagons" x={HEX_AT.x} z={4.7} height={0.45} tone="muted" />
    </Stage>
  )
}
