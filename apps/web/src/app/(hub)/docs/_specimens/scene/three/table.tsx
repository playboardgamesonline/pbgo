"use client"

import type { CameraSettings } from "@pbgo/table"
import { useFrame } from "@react-three/fiber"
import { useState } from "react"
import { RestingCards, Stage } from "./parts"

// `Table` with what the page lists: its endless surface and a few cards lying on it. The camera's entrance plays when the table mounts. To play it again `playIntro` goes to false and back to true, and the rig has to see a
// frame with it off in between (it starts the entrance on the first frame that finds it on): so the scene does not wait a while, which a slow page would make too short, it waits for a frame.

const CAMERA: CameraSettings = { tilt: 42, yaw: 0, distance: 15, fov: 34, targetX: 0, targetZ: 0.4 }

/** Calls `then` on each frame while `when` holds. It is under the table, so the camera rig has run on that frame before it does. */
function OnFrame({ when, then }: { when: boolean; then: () => void }) {
  useFrame(() => {
    if (when) then()
  })
  return null
}

export function TableScene({ replays }: { replays: number }) {
  // How many replays have been played: while it is behind the count asked for, the entrance is held off for a frame
  const [played, setPlayed] = useState(replays)
  const waiting = played !== replays
  return (
    <Stage id="scene-table" camera={CAMERA} playIntro={!waiting}>
      <OnFrame when={waiting} then={() => setPlayed(replays)} />
      <RestingCards />
    </Stage>
  )
}
