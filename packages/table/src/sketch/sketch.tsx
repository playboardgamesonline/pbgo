"use client"

import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import { CanvasTexture, SRGBColorSpace } from "three"
import { shadowTexture } from "../card/textures"
import { useDragStore } from "../drag/context"
import { pointOnTable } from "../drag/reach"
import { claimTouch } from "../drag/touch"
import { paintPaper, paintStrokes } from "./paint"
import { SKETCH_SETTINGS } from "./settings"
import { buildStroke, type Stroke, toGrid, toSheet } from "./sheet"

export type SketchProps = {
  /** The strokes the board holds: what the engine keeps, in the order they were drawn. The sheet shows them; it does not keep a drawing of its own */
  strokes: readonly Stroke[]
  /** Called with the strokes the player has drawn, in batches: a stroke is sent a moment after the pen is lifted, together with the ones that follow it, so that a fast drawer is not a request for each. A board posts them as an action and gives the strokes back in `strokes`. Without it the sheet only shows its strokes, which is how another player's drawing is drawn */
  onStrokes?: (strokes: Stroke[]) => void
  /** Where the middle of the sheet lies on the table, and the way it faces (`yaw`, radians about the vertical axis, counterclockwise from above: its top is away from the viewer when it faces them) */
  at: { x: number; z: number; yaw?: number }
  /** Its size in world units (default 6 by 4.5). A drawing is on a grid that is the same on every sheet, so a sheet must be of the same proportions for everybody at the table */
  width?: number
  height?: number
  /** The colour of each index of the game's palette, and the width of each index of its brushes as a part of the width of the sheet. The engine's rules count them (`colors` and `widths` of `DrawingRules`) */
  colors: readonly string[]
  widths: readonly number[]
  /** The colour and the width the next stroke is drawn in, as indexes of `colors` and `widths` (default the first of each). The board owns them: a palette on the table, a row of pens */
  pen?: { color: number; width: number }
  /** The colour of the paper */
  paper?: string
  /** Nobody can draw on the sheet now (it is not the player's turn): it only shows its strokes */
  disabled?: boolean
  /** The most points a stroke may have, which a longer one is thinned to: the engine's `strokePoints` (default 400) */
  strokePoints?: number
}

/** Pixels the canvas of the sheet has for each world unit */
const PX = 120
/** How high above the table the sheet lies: over the surface, under the cards */
const HEIGHT = 0.014
const PAPER = "#f6f1e4"

/** Tells the graphics card that the picture a canvas holds has been painted again: a texture is a resource of the card, not a value of the page */
function changed(texture: CanvasTexture) {
  texture.needsUpdate = true
}

/** A stroke the player has finished: it is shown at once, and waits to be sent, then to be given back by the board */
type Waiting = { stroke: Stroke; /** Where it will be in `strokes` once the board has it */ base: number; /** When it was sent, null while it waits to be */ sent: number | null }
/** The stroke the pen is drawing: where it has been, as places on the sheet */
type Live = { pen: { color: number; width: number }; points: [number, number][] }

/**
 * A sheet of paper on the table that a player draws on with the pointer, and that the others see. The board holds the strokes (`strokes`, the engine's `Drawing`) and the sheet draws them; the player's pen goes over it, the stroke is thinned and put on the grid
 * (`buildStroke`) when the pen is lifted, and the strokes that are finished go to the board (`onStrokes`) in batches, a moment after the last, which posts them as an action. Until the board gives them back they stay on the sheet, so that a stroke
 * does not blink out and in while the request is on its way, and one that never comes back (the engine refused it) goes after `SKETCH_SETTINGS.pending` seconds. Escape gives the stroke up. Without `onStrokes`, or when `disabled`, the sheet is only seen.
 * It is the sheet's own picture that is drawn, on a canvas laid on the table like the cards, so it is lit, turned and covered as they are.
 */
export function Sketch({ strokes, onStrokes, at, width = 6, height = 4.5, colors, widths, pen = { color: 0, width: 0 }, paper = PAPER, disabled = false, strokePoints = 400 }: SketchProps) {
  const drawable = !disabled && !!onStrokes
  const camera = useThree((state) => state.camera)
  const element = useThree((state) => state.gl.domElement)
  const store = useDragStore()
  const [hovered, setHovered] = useState(false)
  useCursor(hovered && drawable, "crosshair")
  const [shadowTex] = useState(shadowTexture)
  const yaw = at.yaw ?? 0

  const box = useMemo(() => ({ width: Math.round(width * PX), height: Math.round(height * PX) }), [width, height])
  const { canvas, texture } = useMemo(() => {
    const surface = document.createElement("canvas")
    surface.width = box.width
    surface.height = box.height
    const map = new CanvasTexture(surface)
    map.colorSpace = SRGBColorSpace
    map.anisotropy = 8
    return { canvas: surface, texture: map }
  }, [box.width, box.height])
  useEffect(() => () => texture.dispose(), [texture])

  // What the pen is drawing, what is finished and not yet given back, whether the picture is out of date, the press that is going on, and the timer that sends the strokes
  const live = useRef<Live | null>(null)
  const waiting = useRef<Waiting[]>([])
  const dirty = useRef(true)
  const session = useRef<{ end: () => void } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const firstUnsent = useRef<number | null>(null)
  // What a handler or a frame reads: the newest props, not the ones of the render that made it
  const latest = useRef({ strokes, onStrokes, at, yaw, width, height, colors, widths, pen, paper, strokePoints })
  useEffect(() => {
    latest.current = { strokes, onStrokes, at, yaw, width, height, colors, widths, pen, paper, strokePoints }
    dirty.current = true
  })
  useEffect(() => (drawable ? claimTouch(element) : undefined), [drawable, element])

  /** Sends the strokes that are finished and have not gone yet, in one batch */
  const send = () => {
    clearTimeout(timer.current)
    firstUnsent.current = null
    const batch = waiting.current.filter((entry) => entry.sent === null)
    if (batch.length === 0) return
    const now = performance.now()
    batch.forEach((entry) => {
      entry.sent = now
    })
    latest.current.onStrokes?.(batch.map((entry) => entry.stroke))
  }
  /** The strokes go a moment after the last one is finished, and never later than a while after the first of them */
  const schedule = () => {
    const now = performance.now()
    firstUnsent.current ??= now
    const due = Math.min(now + SKETCH_SETTINGS.settle * 1000, firstUnsent.current + SKETCH_SETTINGS.flush * 1000)
    clearTimeout(timer.current)
    timer.current = setTimeout(send, Math.max(0, due - now))
  }
  // A sheet that leaves the table gives up the stroke that is being drawn and sends what is finished
  useEffect(
    () => () => {
      session.current?.end()
      send()
    },
    [],
  )

  const start = (event: ThreeEvent<PointerEvent>) => {
    const native = event.nativeEvent
    if (!drawable || native.button !== 0 || session.current) return
    // Something else on the table is being dragged: this press is not a stroke
    if (!store.begin([])) return
    event.stopPropagation()
    const take = (sample: PointerEvent): [number, number] | null => {
      const now = latest.current
      const place = pointOnTable(camera, element.getBoundingClientRect(), sample.clientX, sample.clientY, HEIGHT)
      return place ? toSheet({ x: place[0], z: place[1] }, { x: now.at.x, z: now.at.z, yaw: now.yaw, width: now.width, height: now.height }) : null
    }
    const first = take(native)
    if (!first) {
      store.end()
      return
    }
    live.current = { pen: { ...latest.current.pen }, points: [first] }
    dirty.current = true

    const move = (sample: PointerEvent) => {
      if (sample.pointerId !== native.pointerId || !live.current) return
      // The samples the browser merged into this event keep a fast stroke smooth; an event that has none of its own, like the pointer lifting, is the only sample
      const merged = sample.getCoalescedEvents?.() ?? []
      for (const moved of merged.length ? merged : [sample]) {
        const place = take(moved)
        if (place) live.current.points.push(place)
      }
      dirty.current = true
    }
    const stop = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", cancel)
      window.removeEventListener("keydown", key)
      window.removeEventListener("blur", cancel)
      session.current = null
      store.end()
      dirty.current = true
    }
    function finish(sample: PointerEvent) {
      if (sample.pointerId !== native.pointerId) return
      move(sample)
      const drawn = live.current
      live.current = null
      stop()
      if (!drawn) return
      const now = latest.current
      const stroke = buildStroke(drawn.points, drawn.pen, { tolerance: SKETCH_SETTINGS.tolerance, spacing: SKETCH_SETTINGS.spacing, maxPoints: now.strokePoints })
      waiting.current.push({ stroke, base: now.strokes.length + waiting.current.length, sent: null })
      schedule()
    }
    function cancel() {
      live.current = null
      stop()
    }
    function key(pressed: KeyboardEvent) {
      if (pressed.key === "Escape") cancel()
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", finish)
    window.addEventListener("pointercancel", cancel)
    window.addEventListener("keydown", key)
    window.addEventListener("blur", cancel)
    session.current = { end: cancel }
  }

  useFrame(() => {
    const now = latest.current
    const time = performance.now()
    // What the board has given back is no longer waited for, and what it never gave back is forgotten
    const before = waiting.current.length
    waiting.current = waiting.current.filter((entry) => now.strokes.length <= entry.base && (entry.sent === null || time - entry.sent < SKETCH_SETTINGS.pending * 1000))
    if (waiting.current.length !== before) dirty.current = true
    if (!dirty.current) return
    dirty.current = false
    const g = canvas.getContext("2d")
    if (!g) return
    const inks = { colors: now.colors, widths: now.widths }
    paintPaper(g, box.width, box.height, now.paper)
    paintStrokes(g, now.strokes, inks, box.width, box.height)
    paintStrokes(g, waiting.current.map((entry) => entry.stroke), inks, box.width, box.height)
    const drawing = live.current
    if (drawing) paintStrokes(g, [{ ...drawing.pen, points: drawing.points.flatMap(toGrid) }], inks, box.width, box.height)
    changed(texture)
  })

  return (
    <group position={[at.x, HEIGHT, at.z]} rotation-y={yaw}>
      <group rotation-x={-Math.PI / 2}>
        <mesh position={[width * 0.02, -height * 0.04, -0.004]} renderOrder={1} raycast={() => null}>
          <planeGeometry args={[width * 1.1, height * 1.14]} />
          <meshBasicMaterial map={shadowTex} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh
          renderOrder={2}
          onPointerDown={drawable ? start : undefined}
          onPointerOver={drawable ? () => setHovered(true) : undefined}
          onPointerOut={drawable ? () => setHovered(false) : undefined}
          {...(drawable ? {} : { raycast: () => null })}
        >
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
