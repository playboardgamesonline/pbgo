"use client"

import { type CameraSettings, Sketch, type Stroke } from "@pbgo/table"
import { SKETCH_BRUSHES, SKETCH_RULES, SKETCH_SHEETS } from "../defaults"
import { inks as inkOf, palette } from "./art"
import { Stage, TableLabel } from "./parts"

// A sheet of paper to draw on, and a second one that shows what the others read. Both are given the same strokes, the ones the board holds: the sheet that is drawn on sends what the pointer drew a moment after the pen is lifted, in a batch, and the
// board gives the strokes back once the engine has cleaned and kept them. The second sheet has no `onStrokes`, so it can only be looked at: it is how the sheet of another player reads, and it shows the strokes as the engine kept them.

const CAMERA: CameraSettings = { tilt: 32, yaw: 0, distance: 14, fov: 34, targetX: 0.5, targetZ: 0.5 }
/** The width of each brush, as a part of the width of a sheet. */
const WIDTHS = SKETCH_BRUSHES.map((brush) => brush.width)

export type SketchSceneProps = {
  /** What the board holds: the strokes of the drawing, as the engine keeps them */
  strokes: readonly Stroke[]
  /** The colour (an index of the palette) and the brush the next stroke takes */
  pen: { color: number; width: number }
  /** Whether it is the viewer's turn to draw: the sheet is only seen when it is not */
  mine: boolean
  /** The strokes the viewer finished, in a batch: what a board would send as an action */
  onStrokes: (strokes: Stroke[]) => void
}

export function SketchScene({ strokes, pen, mine, onStrokes }: SketchSceneProps) {
  const colors = palette()
  const inks = inkOf()
  const { mine: yours, others } = SKETCH_SHEETS
  return (
    <Stage id="scene-sketch" camera={CAMERA} playIntro={false}>
      <Sketch
        strokes={strokes}
        onStrokes={onStrokes}
        disabled={!mine}
        at={{ x: yours.x, z: yours.z }}
        width={yours.width}
        height={yours.height}
        colors={inks}
        widths={WIDTHS}
        pen={pen}
        paper={colors.ivory}
        strokePoints={SKETCH_RULES.strokePoints}
      />
      <TableLabel text="Your sheet" x={yours.x} z={yours.z + yours.height / 2 + 0.6} height={0.42} tone="muted" />
      <Sketch strokes={strokes} at={{ x: others.x, z: others.z }} width={others.width} height={others.height} colors={inks} widths={WIDTHS} paper={colors.ivory} />
      <TableLabel text="What the others read" x={others.x} z={others.z + others.height / 2 + 0.6} height={0.42} tone="muted" />
    </Stage>
  )
}
