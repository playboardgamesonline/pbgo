"use client"

import { useThree } from "@react-three/fiber"
import { button, useControls } from "leva"
import { useEffect } from "react"
import { type Object3D, PerspectiveCamera, Vector2 } from "three"
import { useSettings } from "./settings"
import { debugTab } from "@pbgo/core/components/game/debug-tabs"

export const PHOTO_SETTINGS = {
  tilt: 34,
  yaw: 0,
  distance: 50,
  fov: 28,
  targetX: 0,
  targetZ: -0.8,
}

const RAD = Math.PI / 180
let capture: ((width: number, height: number) => HTMLCanvasElement) | null = null

export function captureGamePhoto(width: number, height: number) {
  return capture?.(width, height) ?? null
}

export function GamePhoto() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useSettings(
    "Share Photo",
    PHOTO_SETTINGS,
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

  useEffect(() => {
    capture = (width, height) => {
      const r = PHOTO_SETTINGS
      const cam = new PerspectiveCamera(r.fov, width / height, 0.1, 300)
      const incl = r.tilt * RAD
      const yaw = r.yaw * RAD
      cam.position.set(
        r.targetX + r.distance * Math.sin(incl) * Math.sin(yaw),
        Math.max(0.5, r.distance * Math.cos(incl)),
        r.targetZ + r.distance * Math.sin(incl) * Math.cos(yaw),
      )
      cam.lookAt(r.targetX, 0, r.targetZ)
      cam.updateMatrixWorld()

      const masks: Object3D[] = []
      scene.traverse((o) => {
        if (o.userData.hiddenInPhoto && o.visible) masks.push(o)
      })
      masks.forEach((o) => (o.visible = false))

      const size = gl.getSize(new Vector2())
      const dpr = gl.getPixelRatio()
      const output = document.createElement("canvas")
      output.width = width
      output.height = height
      try {
        gl.setPixelRatio(1)
        gl.setSize(width, height, false)
        gl.render(scene, cam)
        output.getContext("2d")!.drawImage(gl.domElement, 0, 0, width, height)
      } finally {
        masks.forEach((o) => (o.visible = true))
        gl.setPixelRatio(dpr)
        gl.setSize(size.x, size.y, false)
        gl.render(scene, camera)
      }
      return output
    }
    return () => {
      capture = null
    }
  }, [gl, scene, camera])

  return null
}
