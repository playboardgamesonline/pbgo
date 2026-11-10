"use client"

import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useEffect, useMemo, useRef, useState } from "react"
import { BufferAttribute, BufferGeometry, type MeshBasicMaterial } from "three"
import { useSettingsVersion } from "../debug/settings"
import { useDragState, useDragStore } from "./context"
import { bandMesh, type Flat, fillMesh } from "./mesh"
import { DRAG_SETTINGS } from "./settings"
import { type DropShape, outlineOf } from "./shapes"
import type { ZoneId } from "./store"

/** A zone and the shape it holds on the table: what a thing is let go on */
export type DropTarget = { id: ZoneId; shape: DropShape }

/**
 * Puts the zones on the table for as long as the component is there: the things that are dragged find them, and report the one they are let go on. It draws nothing: `DropZone` draws one, and a `Board` draws the cells it is given. Use it for zones that
 * something else draws, such as the spaces of a track. It must be called inside the `Table`. The shapes are kept as long as what they say is the same, so a game that makes them anew at each render registers them once.
 */
export function useDropZones(targets: readonly DropTarget[]): void {
  const store = useDragStore()
  const key = JSON.stringify(targets)
  useEffect(() => {
    const zones = JSON.parse(key) as DropTarget[]
    const offs = zones.map(({ id, shape }) => store.register(id, shape))
    return () => offs.forEach((off) => off())
  }, [store, key])
}

export type DropZoneProps = {
  /** Names the zone: what the `dropOn` of a thing lists, and what `onDrop` reports as the target. Unique on the table, except that two zones with one id are one zone with two shapes */
  id: ZoneId
  /** Where it lies, in table coordinates: `circleShape`, `rectShape`, `polygonShape`. A zone that is drawn is convex, and it is not inside a group that moves or turns */
  shape: DropShape
  /** The colour of its line and of its inside (default `ZONE_COLOR`) */
  color?: string
  /** When it shows (default `dragging`): only while something is held that may be let go on it, or always, quietly, as the outline of a discard pile does */
  show?: "dragging" | "always"
  /** Lit as it is when a thing that may go on it is held (default false), for the players who do not drag: the zone that a thing that was picked with a click may go on */
  ready?: boolean
  /** Pressing it does this: the click that leads to what a drop leads to, for the players who do not drag. Without it, the zone cannot be pressed */
  onClick?: (e: ThreeEvent<MouseEvent>) => void
}

/** The colour of a zone that is given none: a warm white that shows on the cloth of a table and on the plates of a board */
export const ZONE_COLOR = "#ffe9b0"
// How high above the table the inside and the line of a zone lie: over the surface and over the plates of a board, under its rings and the shadows of the pieces
const FILL_HEIGHT = 0.005
const LINE_HEIGHT = 0.006

function geometryOf({ positions, indices }: Flat): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(positions, 3))
  geometry.setIndex(new BufferAttribute(indices, 1))
  return geometry
}

/**
 * A place on the table where a dragged thing can be let go: a circle, a rectangle, a polygon. It is invisible until something is held that may go on it, then it shows its line, which pulses, and when the pointer is over it its line is full and its inside
 * is lit. It holds nothing: what lies on it is the game's, and what the drop does is the game's, told by the `onDrop` of the thing. It is a zone for the drag, not the `Zone` that lays cards out.
 */
export function DropZone({ id, shape, color = ZONE_COLOR, show = "dragging", ready = false, onClick }: DropZoneProps) {
  // The shape is kept as long as what it says is the same, and drawn again when the panel changes the width of the line
  useSettingsVersion()
  const key = JSON.stringify(shape)
  const stable = useMemo(() => JSON.parse(key) as DropShape, [key])
  useDropZones(useMemo(() => [{ id, shape: stable }], [id, stable]))

  const { dragging, legal, over } = useDragState()
  const mood: "idle" | "legal" | "over" = !dragging ? (ready ? "legal" : "idle") : over === id ? "over" : !legal || legal.includes(id) ? "legal" : "idle"
  const line = DRAG_SETTINGS.line
  const outline = useMemo(() => outlineOf(stable), [stable])
  const band = useMemo(() => geometryOf(bandMesh(outline, line, LINE_HEIGHT)), [outline, line])
  const fill = useMemo(() => geometryOf(fillMesh(outline, FILL_HEIGHT)), [outline])
  useEffect(() => () => band.dispose(), [band])
  useEffect(() => () => fill.dispose(), [fill])

  const bandMaterial = useRef<MeshBasicMaterial>(null)
  const fillMaterial = useRef<MeshBasicMaterial>(null)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered && !!onClick)
  // What a frame reads: the newest of what is drawn, not what the render that made the frame's closure had
  const latest = useRef({ mood, show })
  useEffect(() => {
    latest.current = { mood, show }
  })

  useFrame(({ clock }, dt) => {
    const S = DRAG_SETTINGS
    const now = latest.current
    const pulse = Math.sin(clock.elapsedTime * 3.2)
    const lineOpacity = now.mood === "over" ? 1 : now.mood === "legal" ? Math.min(1, Math.max(0, S.glow + S.pulse * pulse)) : now.show === "always" ? S.glow * 0.5 : 0
    const fillOpacity = now.mood === "over" ? S.fill : now.mood === "legal" ? S.fill * 0.35 : 0
    if (bandMaterial.current) easing.damp(bandMaterial.current, "opacity", lineOpacity, 0.08, dt)
    if (fillMaterial.current) easing.damp(fillMaterial.current, "opacity", fillOpacity, 0.08, dt)
  })

  return (
    <>
      <mesh
        geometry={fill}
        renderOrder={-2}
        {...(onClick ? {} : { raycast: () => null })}
        onClick={onClick}
        onPointerOver={onClick ? () => setHovered(true) : undefined}
        onPointerOut={onClick ? () => setHovered(false) : undefined}
      >
        <meshBasicMaterial ref={fillMaterial} color={color} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh geometry={band} renderOrder={-1} raycast={() => null}>
        <meshBasicMaterial ref={bandMaterial} color={color} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  )
}
