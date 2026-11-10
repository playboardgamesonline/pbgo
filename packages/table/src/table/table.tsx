"use client"

import { useDebugRequested, useDebugTools } from "@pbgo/core/components/game/debug-controls"
import { TABLE_CANVAS_ID } from "@pbgo/core/lib/photo"
import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { Canvas } from "@react-three/fiber"
import { lazy, type ReactNode, Suspense, useEffect, useMemo, useRef } from "react"
import type { CameraIntro, CameraSettings } from "./camera"
import { DragContext } from "../drag/context"
import { createDragStore } from "../drag/store"
import { CameraRig } from "./camera-rig"
import { Lights, type LightsProps } from "./lights"
import { createPoseMemory } from "./memory"
import { PoseMemoryContext } from "./memory-context"
import { SharePhoto } from "./share-photo"
import { Surface, type SurfaceProps } from "./surface"

/** The debug tools of the table, a chunk of their own: fetched only while the debug panel is open, which it never is on the production deployment */
const TableDebug = lazy(() => import("../debug/table-debug"))

export type TableProps = {
  /** DOM id of the canvas's wrapper; when no `photo` is set, the share image falls back to the pixels of the canvas inside it (default `TABLE_CANVAS_ID`) */
  id?: string
  /** Where the camera looks at the table from. Read on every frame, so a game can change it live */
  camera: CameraSettings
  /** The camera's entrance (default `CAMERA_INTRO`) */
  intro?: CameraIntro
  /** Plays the entrance (default true): false holds the camera on its settings. A visitor who asks for reduced motion never sees it */
  playIntro?: boolean
  /** The table the cards lie on, which has no end: its colour, and a picture that repeats over it. Required: the canvas is never transparent, so the page behind it never shows through, and the table is never an oval or a rectangle */
  surface: SurfaceProps
  /** The lights: true for the defaults. A table of flat materials needs none */
  lights?: boolean | LightsProps
  /** Where the share photo of the game over is taken from. Without it the share image is the pixels of the canvas */
  photo?: CameraSettings
  /** How close the camera sees (default 0.1). Read once, when the canvas is created */
  near?: number
  /** How far the camera sees (default 300). Read once, when the canvas is created */
  far?: number
  /** The entrance waits (default false): the camera stands at the first frame of it until this turns false, and plays it from there. For a table drawn behind the start screen of a game, whose opening begins when the screen goes. A visitor who asks for reduced motion has no entrance to wait for */
  held?: boolean
  /** Called once, when the table is drawn with everything its children waited for: the pictures and models they suspend on (`useTexture`, `useLoader`). What a game loads without suspending it reports itself */
  onLoaded?: () => void
  /** What lies on the table: cards, seats */
  children: ReactNode
}

/** Mounts once everything beside it in the `Suspense` boundary is in, which is when the table is loaded */
function Loaded({ onLoaded }: { onLoaded?: () => void }) {
  const reported = useRef(false)
  useEffect(() => {
    if (reported.current) return
    reported.current = true
    onLoaded?.()
  }, [onLoaded])
  return null
}

/**
 * The table every game plays on: a canvas with the camera, an endless surface, the lights and the share photo, the memory that lets a card which changes place fly from where it was, and the zones that what is dragged is let go on. Cards and everything else go inside.
 * While the debug panel is open it also holds the tools of the table (`debug/table-debug.tsx`): the folders for what it owns, helpers drawn over it, an inspector and a slow motion.
 */
export function Table({ id = TABLE_CANVAS_ID, camera, intro, playIntro, surface, lights, photo, near = 0.1, far = 300, held = false, onLoaded, children }: TableProps) {
  // Made out here: React context does not cross into the canvas, so the provider sits inside it
  const memory = useMemo(() => createPoseMemory(), [])
  // The zones the things of this table are let go on, and the drag that is going on over them
  const drag = useMemo(() => createDragStore(), [])
  // The entrance zooms and turns the whole view, so reduced motion always wins over the game
  const reduced = usePrefersReducedMotion()
  // Loads the panel's tools when they are asked for (and listens to Shift+D); the panel itself is the board's `DebugSlot`. Both do nothing on the production deployment
  useDebugTools()
  const debugging = useDebugRequested()

  return (
    <Canvas id={id} gl={{ preserveDrawingBuffer: true }} dpr={[1, 2]} camera={{ fov: camera.fov, near, far }}>
      {/* Outside the Suspense: the table is there from the first frame, before any texture has loaded */}
      <Surface {...surface} />
      <PoseMemoryContext.Provider value={memory}>
        <DragContext.Provider value={drag}>
          <Suspense fallback={null}>
            <CameraRig settings={camera} intro={intro} playIntro={(playIntro ?? true) && !reduced} held={held} />
            {lights && <Lights {...(lights === true ? {} : lights)} />}
            {photo && <SharePhoto settings={photo} />}
            {children}
            {debugging && (
              <Suspense fallback={null}>
                <TableDebug camera={camera} intro={intro} photo={photo} lights={lights} surface={surface} />
              </Suspense>
            )}
            <Loaded onLoaded={onLoaded} />
          </Suspense>
        </DragContext.Provider>
      </PoseMemoryContext.Provider>
    </Canvas>
  )
}
