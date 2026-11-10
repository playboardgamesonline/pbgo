"use client"

import { type CameraSettings, TextField } from "@pbgo/table"
import { Stage, TableLabel } from "./parts"

// Two fields of text on a table. The left one is the player's: pressing it opens the window of the platform where they write, and the text they confirm comes back and is posted, which is how the right one, a field with no `onChange` that
// only shows a text, gets what the others read. Both are given the same words (`label`, `placeholder`) that a game gives from its Sanity.

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 10, fov: 34, targetX: 0, targetZ: 0.2 }

export function TextFieldScene({ text, sent, max, lines, onWrite }: { text: string; sent: string | null; max: number; lines: number; onWrite: (value: string) => void }) {
  return (
    <Stage id="scene-text-field" camera={CAMERA} playIntro={false}>
      <TextField value={text} onChange={onWrite} label="Your clue" hint="One word that the others will guess from." placeholder="Press to write a clue" rules={{ max, lines }} at={{ x: -2.1, z: 0.6, yaw: 0.04 }} width={3.4} />
      <TableLabel text="Your field" x={-2.1} z={lines === 1 ? 1.6 : 2.2} height={0.5} tone="muted" />
      <TextField value={sent ?? ""} label="The clue that was sent" placeholder="Nothing sent yet" lines={lines} at={{ x: 2.1, z: -0.2, yaw: -0.05 }} width={3.4} />
      <TableLabel text="What the others read" x={2.1} z={lines === 1 ? 0.8 : 1.4} height={0.5} tone="muted" />
    </Stage>
  )
}
