"use client"

import { TABLE_CANVAS_ID } from "@pbgo/core/lib/photo"
import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { Canvas } from "@react-three/fiber"
import { type ReactNode, Suspense, useMemo } from "react"
import type { CameraIntro, CameraSettings } from "./camera"
import { CameraRig } from "./camera-rig"
import { Floor, type FloorProps } from "./floor"
import { Lights, type LightsProps } from "./lights"
import { createPoseMemory } from "./memory"
import { PoseMemoryContext } from "./memory-context"
import { SharePhoto } from "./share-photo"

export type TableProps = {
  /** DOM id of the canvas's wrapper; when no `photo` is set, the share image falls back to the pixels of the canvas inside it (default `TABLE_CANVAS_ID`) */
  id?: string
  /** Where the camera looks at the table from. Read on every frame, so a game can change it live */
  camera: CameraSettings
  /** The camera's entrance (default `CAMERA_INTRO`) */
  intro?: CameraIntro
  /** Plays the entrance (default true): false holds the camera on its settings. A visitor who asks for reduced motion never sees it */
  playIntro?: boolean
  /** The room around the table. Without it the page behind the canvas shows through */
  floor?: FloorProps
  /** The lights: true for the defaults. A table of flat materials needs none */
  lights?: boolean | LightsProps
  /** Where the share photo of the game over is taken from. Without it the share image is the pixels of the canvas */
  photo?: CameraSettings
  /** How close the camera sees (default 0.1). Read once, when the canvas is created */
  near?: number
  /** How far the camera sees (default 300). Read once, when the canvas is created */
  far?: number
  /** What lies on the table: surfaces, cards, seats */
  children: ReactNode
}

/** The table every game plays on: a canvas with the camera, the room, the lights and the share photo, and the memory that lets a card which changes place fly from where it was. Cards and everything else go inside */
export function Table({ id = TABLE_CANVAS_ID, camera, intro, playIntro, floor, lights, photo, near = 0.1, far = 300, children }: TableProps) {
  // Made out here: React context does not cross into the canvas, so the provider sits inside it
  const memory = useMemo(() => createPoseMemory(), [])
  // The entrance zooms and turns the whole view, so reduced motion always wins over the game
  const reduced = usePrefersReducedMotion()

  return (
    <Canvas id={id} gl={{ preserveDrawingBuffer: true }} dpr={[1, 2]} camera={{ fov: camera.fov, near, far }}>
      <PoseMemoryContext.Provider value={memory}>
        <Suspense fallback={null}>
          <CameraRig settings={camera} intro={intro} playIntro={(playIntro ?? true) && !reduced} />
          {lights && <Lights {...(lights === true ? {} : lights)} />}
          {floor && <Floor {...floor} />}
          {photo && <SharePhoto settings={photo} />}
          {children}
        </Suspense>
      </PoseMemoryContext.Provider>
    </Canvas>
  )
}
