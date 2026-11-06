"use client"

import type { CameraSettings } from "@pbgo/table"
import { useEffect, useState } from "react"
import type { CameraView } from "../defaults"
import { RestingCards, Stage } from "./parts"

// The same table with its camera in the visitor's hands. The table is given ONE settings object and the sliders change its fields: nothing re-renders the table, the rig reads the object on the next frame, which is how a game's debug panel moves its camera.

/** The point of the table in the middle of the picture, which the sliders leave alone. */
const TARGET = { targetX: 0, targetZ: 0.4 }

export function CameraScene({ tilt, yaw, distance, fov }: CameraView) {
  const [camera] = useState<CameraSettings>(() => ({ tilt, yaw, distance, fov, ...TARGET }))
  useEffect(() => {
    Object.assign(camera, { tilt, yaw, distance, fov })
  }, [camera, tilt, yaw, distance, fov])
  return (
    <Stage id="scene-camera" camera={camera} playIntro={false}>
      <RestingCards />
    </Stage>
  )
}
