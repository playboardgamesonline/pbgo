"use client"

import { setPhotoCapture } from "@pbgo/core/lib/photo"
import { useThree } from "@react-three/fiber"
import { useEffect } from "react"
import { type Object3D, PerspectiveCamera, Vector2 } from "three"
import { type CameraSettings, placeCamera } from "./camera"

export type SharePhotoProps = {
  /** Where the photo is taken from. Read when the photo is taken, so a game can change it live */
  settings: CameraSettings
}

/** Registers the table's photo for the share card of the game over: the table seen by its own camera, at the size asked for. Anything with `userData.hiddenInPhoto` set is left out of it */
export function SharePhoto({ settings }: SharePhotoProps) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    return setPhotoCapture((width, height) => {
      // The photo sees as near and as far as the live camera does
      const { near, far } = camera as PerspectiveCamera
      const photo = new PerspectiveCamera(settings.fov, width / height, near, far)
      placeCamera(photo, settings)
      photo.updateMatrixWorld()

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
        gl.render(scene, photo)
        output.getContext("2d")!.drawImage(gl.domElement, 0, 0, width, height)
      } finally {
        masks.forEach((o) => (o.visible = true))
        gl.setPixelRatio(dpr)
        gl.setSize(size.x, size.y, false)
        gl.render(scene, camera)
      }
      return output
    })
  }, [gl, scene, camera, settings])

  return null
}
