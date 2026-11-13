"use client"

import { type CameraSettings, FloorButton } from "@pbgo/table"
import { Stage, TableLabel } from "./parts"

// Two buttons side by side as in Flip 7 (a blue-green one and a grey one with a hint of it), a third that can be disabled, and a big zone with no label: the same block at two sizes. Hover one, or press Tab to reach them from the keyboard.

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 15, fov: 34, targetX: 0, targetZ: 0.1 }
const TEAL = "#19a89a"
const GREY = "#7d9899"
const AMBER = "#c8923a"

export function FloorButtonsScene({ disabled, onPress }: { disabled: boolean; onPress: (name: string) => void }) {
  return (
    <Stage id="scene-floor-buttons" camera={CAMERA} playIntro={false}>
      <FloorButton at={{ x: -3.9, z: -1.3 }} width={2.6} depth={1.7} tone={TEAL} label="Hit" onPress={() => onPress("Hit")} disabled={disabled} />
      <FloorButton at={{ x: -0.9, z: -1.3 }} width={2.6} depth={1.7} tone={GREY} label="Stay" onPress={() => onPress("Stay")} disabled={disabled} />
      <FloorButton at={{ x: 2.1, z: -1.3 }} width={2.6} depth={1.7} tone={AMBER} label="Off" disabled />
      <FloorButton at={{ x: 0, z: 2.1 }} width={9.4} depth={2.6} tone={TEAL} tint={0.45} ariaLabel="The zone of a seat" onPress={() => onPress("The zone")} disabled={disabled} />
      <TableLabel text="A zone with no label" x={0} z={3.8} height={0.4} tone="muted" />
    </Stage>
  )
}
