"use client"

import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useEffect, useMemo, useRef, useState } from "react"
import { CanvasTexture, type Group, MeshBasicMaterial, SRGBColorSpace, Vector3 } from "three"
import { shadowTexture } from "../card/textures"
import { useSettingsVersion } from "../debug/settings"
import { litGeometry } from "../die/shade"
import { useDrag } from "../drag/use-drag"
import { pieceModel } from "../piece/models"
import { TableText, type TextStyle } from "../seat/table-text"
import { type NumberRange, rangeOf } from "../stepper/steps"
import { SLIDER_SETTINGS } from "./settings"
import { alongRail, fractionOf, marksOf, valueAt } from "./value"

export type SliderProps = NumberRange & {
  /** The number the board holds. The slider shows it and asks for the next one with `onChange`: it does not keep one of its own */
  value: number
  /** Called with the number a place gives, each time one does: while the knob is dragged, and when the rail is pressed. Without it the slider only shows its number */
  onChange?: (value: number) => void
  /** Called once with the number the player settled on: when the knob is let go, and when the rail is pressed. The place for a board that asks the server only when the player has chosen */
  onCommit?: (value: number) => void
  /** Where the middle of the rail lies on the table, and the way it runs (`yaw`, radians about the vertical axis, counterclockwise from above: the least is on the left of a rail that faces the viewer) */
  at: { x: number; z: number; yaw?: number }
  /** How far the knob goes from the least to the most, in world units (default 6) */
  length?: number
  /** The width of the knob in world units (default 1); the rail and the letters follow it */
  size?: number
  /** How the number is written on the knob and at the ends of the rail: "40", "40 coins". The game's own words (default the number) */
  format?: (value: number) => string
  /** The most marks along the rail (default 11): every number when there are few, else a handful spread evenly. None when 0 */
  marks?: number
  /** The colour of the knob, of the rail and of the part of it that is filled, and of the marks and the letters */
  color?: string
  rail?: string
  fill?: string
  ink?: string
  /** Nobody can move the knob now, and it is dimmed */
  disabled?: boolean
}

const KNOB = "#f4efe2"
const RAIL = "#d8cdb4"
const FILL = "#e8b43a"
const INK = "#26231f"
const DIMMED = "#9a9484"
/** Pixels the canvas of the rail has for each world unit */
const PX = 90
/** How high above the table the rail lies, and the knob stands on it */
const RAIL_Y = 0.012
const SHADOW_HEIGHT = 0.011
const SHADOW_PUSH = { x: 0.2, z: -0.3 }
const GLIDE = 0.07
/** How long after a drag ends a click is still the drag's: the pointer let go over the rail is not a press of it */
const DRAG_CLICK_MS = 400
/** How far, in pixels, the pointer may go between pressing and letting go for a press of the rail to count */
const CLICK_PX = 6

/** Tells the graphics card that the picture a canvas holds has been painted again: a texture is a resource of the card, not a value of the page */
function changed(texture: CanvasTexture) {
  texture.needsUpdate = true
}

/** The rail painted on a canvas: the paper, its edge and the marks. `lengthPx` is the way the knob goes, from the middle of the knob at the least to the middle of the knob at the most */
function paintRail(canvas: HTMLCanvasElement, lengthPx: number, marks: readonly number[], fractions: readonly number[], { rail, ink }: { rail: string; ink: string }) {
  const g = canvas.getContext("2d")
  if (!g) return
  const { width, height } = canvas
  g.clearRect(0, 0, width, height)
  g.beginPath()
  g.roundRect(0, 0, width, height, height / 2)
  g.fillStyle = rail
  g.fill()
  g.lineWidth = 3
  g.strokeStyle = "rgba(0, 0, 0, 0.2)"
  g.stroke()
  g.fillStyle = ink
  g.globalAlpha = 0.5
  const margin = (width - lengthPx) / 2
  marks.forEach((_, i) => g.fillRect(margin + fractions[i]! * lengthPx - 1.5, height * 0.22, 3, height * 0.56))
  g.globalAlpha = 1
}

/**
 * A number on the table that a player picks by sliding a knob along a rail: drag the knob, or press the rail to take it there. It is how a number in a wide range is chosen, a bet of up to a hundred, a quantity, a price, where counting up with
 * the arrows of a stepper would take too long. The knob wears the number, the rail has a mark for each number or a handful of them, and the part of it up to the knob is filled. The slider holds no number: it shows the `value` of the board and asks
 * for the next with `onChange`, kept to the `min`, `max` and `step` of the rules of the engine (`cleanNumber`), which is the one to decide. Giving the drag up with Escape puts the number back where it was.
 */
export function Slider({ value, onChange, onCommit, min, max, step, at, length = 6, size = 1, format, marks = 11, color = KNOB, rail = RAIL, fill = FILL, ink = INK, disabled = false }: SliderProps) {
  useSettingsVersion()
  const range = useMemo(() => rangeOf({ min, max, step }), [min, max, step])
  const yaw = at.yaw ?? 0
  const active = !disabled && !!onChange
  const thickness = size * SLIDER_SETTINGS.rail
  const model = useMemo(() => pieceModel("disc"), [])
  const knobHeight = model.height * size
  const fraction = fractionOf(value, range)
  const written = format ? format(value) : String(value)
  const ends = [format ? format(range.min) : String(range.min), format ? format(range.max) : String(range.max)]

  const knob = useRef<Group>(null)
  const shadow = useRef<Group>(null)
  const lift = useRef(0)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered && active, "grab")
  const [shadowTex] = useState(shadowTexture)

  // Where the knob stands for a number, in the world
  const placeOf = (fractionAlong: number) => ({ x: at.x + Math.cos(yaw) * (fractionAlong - 0.5) * length, z: at.z - Math.sin(yaw) * (fractionAlong - 0.5) * length })
  const latest = useRef({ value, range, onChange, onCommit, at, yaw, length, size, fraction, active, hovered, placeOf })
  const emitted = useRef<number | null>(null)
  const began = useRef(value)
  // When a drag last ended: the click that comes after it, on the rail under the pointer, is not a press of the rail
  const ended = useRef(0)
  useEffect(() => {
    latest.current = { value, range, onChange, onCommit, at, yaw, length, size, fraction, active, hovered, placeOf }
    emitted.current = null
  })

  const drag = useDrag({
    enabled: active,
    level: RAIL_Y,
    position: () => {
      const place = latest.current.placeOf(latest.current.fraction)
      return new Vector3(place.x, RAIL_Y, place.z)
    },
    // No zone is lit for a knob, and none can take it
    dropOn: [],
    onDragStart: () => {
      began.current = latest.current.value
      emitted.current = null
    },
    onDrop: () => {
      ended.current = performance.now()
      latest.current.onCommit?.(latest.current.value)
    },
    // Escape: the number goes back to where it was when the knob was taken
    onDragCancel: () => {
      ended.current = performance.now()
      latest.current.onChange?.(began.current)
    },
  })

  const geometry = useMemo(() => litGeometry(model.geometry(size)), [model, size])
  useEffect(() => () => geometry.dispose(), [geometry])
  const material = useMemo(() => new MeshBasicMaterial({ color: active ? color : DIMMED, vertexColors: true, toneMapped: false }), [color, active])
  useEffect(() => () => material.dispose(), [material])

  const lengthPx = Math.round(length * PX)
  const railBox = useMemo(() => ({ width: Math.round((length + size) * PX), height: Math.max(4, Math.round(thickness * PX)) }), [length, size, thickness])
  const markValues = useMemo(() => (marks > 0 ? marksOf(range, marks) : []), [range, marks])
  const markFractions = useMemo(() => markValues.map((mark) => fractionOf(mark, range)), [markValues, range])
  const { canvas, texture } = useMemo(() => {
    const surface = document.createElement("canvas")
    surface.width = railBox.width
    surface.height = railBox.height
    const map = new CanvasTexture(surface)
    map.colorSpace = SRGBColorSpace
    map.anisotropy = 8
    return { canvas: surface, texture: map }
  }, [railBox.width, railBox.height])
  useEffect(() => () => texture.dispose(), [texture])
  useEffect(() => {
    paintRail(canvas, lengthPx, markValues, markFractions, { rail: active ? rail : DIMMED, ink })
    changed(texture)
  }, [canvas, texture, lengthPx, markValues, markFractions, rail, ink, active])

  useFrame((_, dt) => {
    const now = latest.current
    const g = knob.current
    if (!g) return
    // The knob follows the number of the board; the number follows the knob while it is held
    const held = drag.held.current
    if (held && now.active) {
      const along = alongRail(held, now.at, now.yaw)
      const next = valueAt(along / now.length + 0.5, now.range)
      if (next !== now.value && next !== emitted.current) {
        emitted.current = next
        now.onChange?.(next)
      }
    }
    const goal = now.placeOf(now.fraction)
    const rise = held ? SLIDER_SETTINGS.held : now.hovered && now.active ? SLIDER_SETTINGS.rise : 0
    lift.current += (rise - lift.current) * Math.min(1, dt / 0.08)
    easing.damp3(g.position, [goal.x, RAIL_Y + lift.current, goal.z], GLIDE, dt)
    const s = shadow.current
    if (s) {
      s.position.set(g.position.x + SHADOW_PUSH.x * (lift.current + 0.3) * now.size, SHADOW_HEIGHT, g.position.z + SHADOW_PUSH.z * (lift.current + 0.3) * now.size)
      s.scale.setScalar(model.reach * now.size * (2.3 + 0.5 * lift.current))
    }
  })

  /** A press on the rail takes the knob there at once */
  const jump = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    // A press that travelled is a drag, or one that was given up, and not a press of the rail
    if (event.delta > CLICK_PX || performance.now() - ended.current < DRAG_CLICK_MS) return
    const next = valueAt(alongRail(event.point, at, yaw) / length + 0.5, range)
    if (next !== value) onChange?.(next)
    onCommit?.(next)
  }
  const letters: TextStyle = { color: active ? ink : DIMMED }
  const muted: TextStyle = { color: "#f4efe2", outline: "rgba(18, 24, 18, 0.55)" }

  return (
    <>
      <group position={[at.x, 0, at.z]} rotation-y={yaw}>
        <mesh rotation-x={-Math.PI / 2} position-y={RAIL_Y - 0.004} renderOrder={1} onClick={active ? jump : undefined} {...(active ? {} : { raycast: () => null })}>
          <planeGeometry args={[railBox.width / PX, railBox.height / PX]} />
          <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
        {/* The part of the rail up to the knob */}
        <group position={[-length / 2, RAIL_Y - 0.002, 0]} scale={[Math.max(fraction, 0.0001), 1, 1]}>
          <mesh rotation-x={-Math.PI / 2} position-x={length / 2} renderOrder={2} raycast={() => null}>
            <planeGeometry args={[length, thickness * 0.4]} />
            <meshBasicMaterial color={active ? fill : DIMMED} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
        <TableText text={ends[0]!} style={muted} height={size * 0.3} position={[-length / 2, 0.01, size * 0.65 + thickness / 2]} />
        <TableText text={ends[1]!} style={muted} height={size * 0.3} position={[length / 2, 0.01, size * 0.65 + thickness / 2]} />
      </group>
      <group ref={shadow}>
        <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={shadowTex} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <group
        ref={knob}
        onPointerDown={drag.bind.onPointerDown}
        onClick={(e) => {
          // A press of the knob is not a press of the rail under it
          e.stopPropagation()
          drag.bind.onClick?.(e)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <mesh geometry={geometry} material={[material, material, material]} />
        <TableText text={written} style={letters} height={size * 0.42} position={[0, knobHeight + 0.004, 0]} yaw={yaw} />
      </group>
    </>
  )
}
