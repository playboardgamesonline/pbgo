"use client"

import { debugTab } from "@pbgo/core/components/game/debug-tabs"
import { captureGamePhoto } from "@pbgo/core/lib/photo"
import type { CameraSettings } from "@pbgo/table"
import { button, useControls } from "leva"
import { useSettings } from "./settings"

/** Where the camera looks at the table from. The Camera folder of the debug panel edits this object, the table reads it on every frame */
export const CAMERA: CameraSettings = { tilt: 42, yaw: 0, distance: 21, fov: 34, targetX: 0, targetZ: 1.2 }

/** Where the share photo of the game over is taken from. The Share Photo folder edits this object, the photo reads it when it is taken */
export const PHOTO: CameraSettings = { tilt: 34, yaw: 0, distance: 50, fov: 28, targetX: 0, targetZ: -0.8 }

/** The knobs of the debug panel for the camera and for the share photo */
export function useCameraSettings() {
  // The table's camera looks at the middle of the table, so the folder leaves out its yaw and its x
  useSettings<Pick<CameraSettings, "tilt" | "distance" | "fov" | "targetZ">>(
    "Camera",
    CAMERA,
    {
      tilt: ["tilt °", 0, 85, 0.5],
      distance: ["distance", 8, 60, 0.1],
      fov: ["fov °", 10, 90, 0.5],
      targetZ: ["target z", -6, 6, 0.05],
    },
    { order: 0, closed: false },
  )
  useSettings(
    "Share Photo",
    PHOTO,
    {
      tilt: ["tilt °", 0, 85, 0.5],
      yaw: ["yaw °", -180, 180, 1],
      distance: ["distance", 8, 90, 0.1],
      fov: ["fov °", 10, 100, 0.5],
      targetX: ["target x", -10, 10, 0.05],
      targetZ: ["target z", -10, 10, 0.05],
    },
    { order: 14 },
  )
  useControls(
    "Share Photo",
    {
      "Download test photo": button(() => {
        const c = captureGamePhoto(1600, 1200)
        if (!c) return
        const a = document.createElement("a")
        a.href = c.toDataURL("image/png")
        a.download = "photo-partie.png"
        a.click()
      }),
    },
    { collapsed: true, order: 14 },
    debugTab("SCENE"),
  )
}
