"use client"

import { Bag, bagMouth, BAG_SIZE, type CameraSettings, Counter, Piece } from "@pbgo/table"
import { BAG_ROW } from "../defaults"
import { palette } from "./art"
import { Stage, TableLabel } from "./parts"

// A bag of tokens in four colours. The engine keeps a count for each colour and draws from a seeded stream; the scene is given the tokens that were drawn and how many are left. A token that is drawn comes out of the mouth of the bag and flies to its place in the row,
// the bag rocks when a hand has rummaged in it and slumps as it empties, and the number left is a counter. The bag itself knows nothing of its colours.

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 13, fov: 34, targetX: 0.6, targetZ: 0.9 }
const BAG_AT = { x: -3.6, z: 0.9 }
const ROW = { x: -0.4, z: 0.9, gap: 0.95 }
const TOKEN = 0.7

export function BagScene({ drawn, left, total, pressable, onDraw }: { drawn: readonly number[]; left: number; total: number; pressable: boolean; onDraw: () => void }) {
  const colors = palette()
  const kinds = [colors.marks[0], colors.marks[1], colors.marks[2], colors.ivory]
  const fill = total === 0 ? 0 : left / total
  const mouth = bagMouth(BAG_AT, BAG_SIZE, fill)
  // The row shows the last tokens drawn, each named by the number of its draw: a token that is pushed out of the row by a later one is gone, and the others glide along
  const first = Math.max(0, drawn.length - BAG_ROW)
  return (
    <Stage id="scene-bag" camera={CAMERA} playIntro={false}>
      <Bag
        at={BAG_AT}
        fill={fill}
        shake={drawn.length}
        halo={pressable ? colors.text : null}
        onClick={
          pressable
            ? (event) => {
                event.stopPropagation()
                onDraw()
              }
            : undefined
        }
      />
      {drawn.slice(first).map((kind, i) => (
        <Piece key={first + i} id={`token-${first + i}`} model="disc" size={TOKEN} color={kinds[kind]} at={{ x: ROW.x + i * ROW.gap, z: ROW.z }} from={mouth} />
      ))}
      <Counter value={left} at={{ x: BAG_AT.x, z: 3.4 }} height={0.9} />
      <TableLabel text="In the bag" x={BAG_AT.x} z={4.5} height={0.4} tone="muted" />
      <TableLabel text="Drawn" x={ROW.x + 3.3} z={2.3} height={0.4} tone="muted" />
    </Stage>
  )
}
