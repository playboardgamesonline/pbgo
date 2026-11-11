"use client"

import { Board, type CameraSettings, Piece, squareCells, tileYaw } from "@pbgo/table"
import { useMemo, useState } from "react"
import type { Coord, LaidTile } from "@pbgo/engine-kit"
import { cssColor } from "../color"
import type { TileName } from "../landscape"
import { palette } from "./art"
import { Stage, TableLabel } from "./parts"
import { doneColor, tileFace } from "./tile-art"

// The table of tiles of the landscape specimen and of the playground. The tiles that are laid are pieces of the model `square` that wear a picture on their top, turned by `tileYaw` from the turns the engine counts; the cells where the tile in hand may go
// are a `Board` made from the free cells next to the tiles, ringed where it fits as it is turned; the tile in hand lies beside the table, and a faint copy of it shows where the pointer is on a cell that fits. The scene holds nothing: it shows what it is given
// and says what was pressed.

const CELL = 1.5
const GAP = 0.05
const HAND_SIZE = 2
/** Where the middle cell of the specimen's table lies: the cells keep their places when more are added, since they are anchored on it (`anchor` of `squareCells`) */
const ORIGIN = { x: -1.6, z: 0.2 }
const HAND = { x: 5.6, z: -0.4 }
const CAMERA: CameraSettings = { tilt: 28, yaw: 0, distance: 14.5, fov: 34, targetX: -0.1, targetZ: 0.2 }

export type TilesTableProps = {
  /** The tiles that are laid, as the engine keeps them */
  laid: readonly LaidTile<TileName>[]
  /** The tile in hand and how many times it has been turned, which only ever goes up so that the tile always turns the way it was pressed. `null` when the box is empty */
  hand: { tile: TileName; spin: number } | null
  /** The free cells next to a tile, and which of them, by their place in the list, the tile in hand fits as it is turned */
  spots: readonly Coord[]
  fits: readonly number[]
  /** The tiles, by their place in `laid`, that belong to a road or a city that is closed */
  done: readonly number[]
  /** Whether turning the tile shows it differently */
  turnable: boolean
  onSpot: (spot: number) => void
  onTurn: () => void
  /** Where the middle cell of the table lies on the table of the game, and where the tile in hand does */
  origin: { x: number; z: number }
  handAt: { x: number; z: number }
}

/** The tiles, the cells and the tile in hand, to put inside a `Table` */
export function TilesTable({ laid, hand, spots, fits, done, turnable, onSpot, onTurn, origin, handAt }: TilesTableProps) {
  const colors = palette()
  const [hover, setHover] = useState<number | null>(null)
  const spotCells = useMemo(() => squareCells(spots, { size: CELL, gap: GAP, at: origin, anchor: [0, 0] }), [spots, origin])
  const laidCells = useMemo(() => squareCells(laid.map((one) => one.at), { size: CELL, at: origin, anchor: [0, 0] }), [laid, origin])
  const free = cssColor("color-mix(in oklab, var(--success) 30%, var(--card))")
  const ghost = hand && hover !== null && fits.includes(hover) ? spotCells[hover] : undefined
  const marked = new Set(done)
  const size = CELL - GAP
  return (
    <>
      <Board cells={spotCells} look={() => ({ color: free })} halo={fits} onCell={(spot) => hand && fits.includes(spot) && onSpot(spot)} onHover={setHover} />
      {laid.map((one, index) => (
        <Piece key={index} id={`tile-${index}`} model="square" size={size} color={colors.ivory} faces={{ top: tileFace(one.tile) }} at={{ x: laidCells[index]!.x, z: laidCells[index]!.z, yaw: tileYaw(one.turns) }}>
          {marked.has(index) && (
            <mesh position-z={0.003}>
              <ringGeometry args={[size * 0.13, size * 0.19, 40]} />
              <meshBasicMaterial color={doneColor()} toneMapped={false} />
            </mesh>
          )}
        </Piece>
      ))}
      {hand && ghost && <Piece model="square" size={size} opacity={0.55} shadow={false} faces={{ top: tileFace(hand.tile) }} at={{ x: ghost.x, z: ghost.z, yaw: tileYaw(hand.spin) }} />}
      {hand && (
        <>
          <Piece key={`hand-${laid.length}`} id={`tile-${laid.length}`} model="square" size={HAND_SIZE} color={colors.ivory} faces={{ top: tileFace(hand.tile) }} at={{ x: handAt.x, z: handAt.z, yaw: tileYaw(hand.spin) }} onClick={turnable ? onTurn : undefined} />
          <TableLabel text="Next tile" x={handAt.x} z={handAt.z - HAND_SIZE / 2 - 0.7} height={0.45} tone="muted" />
          <TableLabel text={turnable ? "Press it to turn it" : "It looks the same turned"} x={handAt.x} z={handAt.z + HAND_SIZE / 2 + 0.7} height={0.4} tone="muted" />
        </>
      )}
      {!hand && <TableLabel text="The box is empty" x={handAt.x} z={handAt.z} height={0.5} tone="muted" />}
    </>
  )
}

/** The specimen's scene: the table of tiles on a table of its own */
export function TilesScene(props: Omit<TilesTableProps, "origin" | "handAt">) {
  return (
    <Stage id="scene-tiles" camera={CAMERA} playIntro={false}>
      <TilesTable {...props} origin={ORIGIN} handAt={HAND} />
    </Stage>
  )
}
