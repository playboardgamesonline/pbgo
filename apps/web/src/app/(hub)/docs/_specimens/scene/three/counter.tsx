"use client"

import { type CameraSettings, Counter, Piece, pieceModel, Stack } from "@pbgo/table"
import { COUNTER_AT } from "../defaults"
import { palette } from "./art"
import { Stage, TableLabel } from "./parts"

// One number of the state, shown three ways. On the left a counter on its own, which counts up or down to each new value and floats what changed beside it. In the middle the same counter written on a piece (a counter that has a `y` lies on what
// is under it). On the right the same number as a stack of coins: a counter is a number, and a number can be drawn as many things as a game likes.

const CAMERA: CameraSettings = { tilt: 48, yaw: 0, distance: 11, fov: 34, targetX: 0, targetZ: 0.1 }
const TILE = 2.2

export function CounterScene({ value, change, seconds }: { value: number; change: boolean; seconds: number }) {
  const colors = palette()
  const tile = pieceModel("hex")
  return (
    <Stage id="scene-counter" camera={CAMERA} playIntro={false}>
      <Counter value={value} at={{ x: COUNTER_AT.plain, z: 0.1 }} height={1.5} change={change} seconds={seconds} />
      <TableLabel text="On its own" x={COUNTER_AT.plain} z={1.9} height={0.4} tone="muted" />
      <Piece model="hex" size={TILE} color={colors.marks[2]} at={{ x: COUNTER_AT.tile, z: 0.1 }} />
      <Counter value={value} at={{ x: COUNTER_AT.tile, z: 0.1 }} y={tile.height * TILE + 0.01} height={1.1} style={{ color: colors.ink }} change={change} seconds={seconds} />
      <TableLabel text="On a piece" x={COUNTER_AT.tile} z={1.9} height={0.4} tone="muted" />
      <Stack id="coins" count={value} model="disc" size={0.9} color={colors.marks[2]} at={{ x: COUNTER_AT.stack, z: 0.3 }} />
      <TableLabel text="As coins" x={COUNTER_AT.stack} z={1.9} height={0.4} tone="muted" />
    </Stage>
  )
}
