"use client"

import { type CameraSettings, FloorButton } from "@pbgo/table"
import { Stage } from "./parts"

// Three buttons side by side: the action that goes on (primary, the accent of the game's theme), a quieter one (neutral, its text colour) and one that is off. No colour and no font is typed here: the theme gives them. Hover one, or press Tab to reach them from the keyboard.

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 15, fov: 34, targetX: 0, targetZ: 0.1 }

export function FloorButtonsScene({ disabled, onPress }: { disabled: boolean; onPress: (name: string) => void }) {
  return (
    <Stage id="scene-floor-buttons" camera={CAMERA} playIntro={false}>
      <FloorButton at={{ x: -3, z: 0 }} width={2.6} depth={1.7} label="Hit" onPress={() => onPress("Hit")} disabled={disabled} />
      <FloorButton at={{ x: 0, z: 0 }} width={2.6} depth={1.7} tone="neutral" label="Stay" onPress={() => onPress("Stay")} disabled={disabled} />
      <FloorButton at={{ x: 3, z: 0 }} width={2.6} depth={1.7} label="Off" disabled />
    </Stage>
  )
}
