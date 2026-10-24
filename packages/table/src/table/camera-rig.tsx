"use client"

import { useFrame } from "@react-three/fiber"
import { useRef } from "react"
import type { PerspectiveCamera } from "three"
import { CAMERA_INTRO, type CameraIntro, type CameraSettings, aspectScale, introRest, placeCamera } from "./camera"

export type CameraRigProps = {
  /** Where the camera looks from. Read on every frame, so a game can change it live */
  settings: CameraSettings
  /** The entrance, read on every frame too (default `CAMERA_INTRO`) */
  intro?: CameraIntro
  /** Plays the entrance, from the moment this turns true (default true): false holds the camera on its settings */
  playIntro?: boolean
}

/** Puts the camera where the settings say on every frame: backed off on a narrow screen, with the entrance on top while it plays */
export function CameraRig({ settings, intro = CAMERA_INTRO, playIntro = true }: CameraRigProps) {
  const startedAt = useRef<number | null>(null)

  useFrame((state) => {
    const now = performance.now()
    if (!playIntro) startedAt.current = null
    else if (startedAt.current === null) startedAt.current = now
    placeCamera(state.camera as PerspectiveCamera, settings, {
      distanceScale: aspectScale(state.size.width / state.size.height),
      rest: introRest(intro, startedAt.current, now),
      intro,
    })
  })

  return null
}
