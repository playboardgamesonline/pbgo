"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useCursor } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react"
import { ExtrudeGeometry, type Group, type Mesh, type MeshBasicMaterial, Path, Shape } from "three"
import { shadowTexture } from "../card/textures"
import { useLettering } from "../lettering"
import { TableText, type TextStyle } from "../seat/table-text"
import { fitLabel, floorColours, liftTarget, padRadius, rimThickness, stepLift } from "./lift"
import { useStandIn } from "./stand-in"
import { type FloorTone, toneColour, useFloorTones } from "./tones"

type PadProps = {
  /** Where the pad's centre lies on the table, and the way it faces (`yaw`, radians about the vertical axis) */
  at: { x: number; z: number; yaw?: number }
  /** The pad's size on the table, in world units: `width` along its own x axis, `depth` along its own z axis */
  width: number
  depth: number
  /** What a screen reader says and what the keyboard focus lands on; defaults to `label` */
  ariaLabel?: string
  /** Pressing the pad (a click, a tap, Enter or Space on the focused pad) does this. Without it the pad is drawn and takes no press */
  onPress?: () => void
  /** The pad cannot be pressed now: it lies flat and dim, takes no pointer, and the keyboard skips it */
  disabled?: boolean
  /** How high the rim rises, in world units (default `RIM_HEIGHT`) */
  rim?: number
}

/** A button on the table: a pad that says what it does, for an action that has no object (deal, stay, keep). A choice between objects is made by pressing the objects */
export type FloorButtonProps = PadProps & {
  /** What is written flat on the pad, in the game's words and the visitor's language: the action it does ("Deal", "Stay") */
  label: string
  /** `primary` (the default) for the action that goes on, `neutral` for the quieter ones: the game's theme gives each its colour (`UI_THEME.button`, over the accent and the text colour of its settings), so a board types none */
  tone?: FloorTone
  /** The size of the lettering in world units (default 0.55); a label too long for the pad is set smaller to fit it, on one line */
  labelHeight?: number
}

/** How high above the table the invisible plane that takes the pointer lies: over the pad, under the cards */
const HIT_Y = 0.02

/** How high the rim of a pad rises when lifted, in world units: a few cards' thickness, so the raised wall reads from the camera without hiding what lies behind it */
export const RIM_HEIGHT = 0.2
/** The rim at rest: a thin outline lying on the table */
const FLAT = 0.004
// Over the mat (0.001) and the lines of the plates, under the cards
const PAD_Y = 0.008
const RIM_Y = 0.009
const TEXT_Y = 0.03
/** How far the label rises with the rim, a share of the rim's height, so that the lettering is not buried by the wall when it lifts */
const LABEL_RISE = 0.6

/** A rounded rectangle of `w` by `d` as a path, its corners arcs of radius `r`; `clockwise` winds it the other way, for the hole of an outline */
function roundedRect(path: Shape | Path, w: number, d: number, r: number, clockwise = false) {
  const x = w / 2
  const z = d / 2
  // the four corners, as the centre of each arc and where its arc starts, going round
  const corners: [number, number, number][] = [
    [x - r, -z + r, -Math.PI / 2],
    [x - r, z - r, 0],
    [-x + r, z - r, Math.PI / 2],
    [-x + r, -z + r, Math.PI],
  ]
  const order = clockwise ? [...corners].reverse() : corners
  const start = clockwise ? order[0]![2] + Math.PI / 2 : order[0]![2]
  path.moveTo(order[0]![0] + r * Math.cos(start), order[0]![1] + r * Math.sin(start))
  for (const [cx, cz, from] of order) {
    // an arc of a quarter turn, in the direction the path winds
    if (clockwise) path.absarc(cx, cz, r, from + Math.PI / 2, from, true)
    else path.absarc(cx, cz, r, from, from + Math.PI / 2, false)
  }
  path.closePath()
}

/** A rounded rectangle of `w` by `d` as a flat outline, `border` thick, with the corners cut square (a few segments are plenty at this size) */
function rimGeometry(w: number, d: number, border: number) {
  const r = padRadius(w, d)
  const outer = new Shape()
  roundedRect(outer, w, d, r)
  const hole = new Path()
  roundedRect(hole, w - 2 * border, d - 2 * border, Math.max(0, r - border), true)
  outer.holes.push(hole)
  // unit depth: the mesh is scaled along it to lift the rim
  return new ExtrudeGeometry(outer, { depth: 1, bevelEnabled: false, curveSegments: 8 })
}

function padShape(w: number, d: number, border: number) {
  const shape = new Shape()
  roundedRect(shape, w - 2 * border, d - 2 * border, Math.max(0, padRadius(w, d) - border))
  return shape
}

/**
 * A button drawn flat on the table, not floating over it: a tinted pad with a thin outline at rest, saying what it does. Under the pointer, under the keyboard focus and while it is pressed, its borders lift off the table (the rim rises, with a soft shadow under it) and the fill brightens. A
 * visitor who asks for less motion gets the lifted state at once, without the glide. The lettering is `TableText` in the table's own (`useLettering`), laid flat on the pad, so it is lit, turned and covered like the rest of the board. The pad's colour is a tone, `primary` or
 * `neutral`, which the game's theme gives (`UI_THEME.button`): a board types no colour.
 *
 * A canvas takes no keyboard, so each enabled pad also puts one real, visually hidden `<button>` in the page: it takes the Tab key, shows the lift while focused, says `ariaLabel` (or `label`) to a screen reader and presses with Enter or Space. A disabled pad has none.
 * A button is for an action that has no object: a choice between objects is made by pressing the objects, in the `interactive` state, and by a `Hotspot` over a player's cards.
 */
export function FloorButton({ at, width, depth, tone, label, labelHeight = 0.55, ariaLabel, onPress, disabled = false, rim = RIM_HEIGHT }: FloorButtonProps): ReactElement {
  const letters = useLettering()
  const tones = useFloorTones()
  const reduced = usePrefersReducedMotion()
  const pressable = !!onPress && !disabled
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const root = useRef<Group>(null)
  // The keyboard stand-in: one real button in the page, over the pad. It takes Tab, shows the lift while it has the focus, says its name and presses with Enter or Space
  const focused = useStandIn({ pressable, name: ariaLabel ?? label, onPress, anchor: root, onTable: true })
  useCursor(hovered && pressable)
  const colour = toneColour(tone, tones)
  // The quieter tone is a quiet pad: no colour of its own (`floorColours`)
  const quiet = tone === "neutral"
  const state = { hovered: pressable && hovered, focused: pressable && focused, pressed: pressable && pressed, disabled }
  const target = liftTarget(state)

  const border = rimThickness(width, depth)
  const geometry = useMemo(() => rimGeometry(width, depth, border), [width, depth, border])
  const fillGeometry = useMemo(() => padShape(width, depth, border), [width, depth, border])
  useEffect(() => () => geometry.dispose(), [geometry])
  const [shadow] = useState(shadowTexture)

  const lift = useRef(0)
  const wall = useRef<Mesh>(null)
  const raised = useRef<Group>(null)
  const top = useRef<MeshBasicMaterial>(null)
  const side = useRef<MeshBasicMaterial>(null)
  const fill = useRef<MeshBasicMaterial>(null)
  const dropShadow = useRef<MeshBasicMaterial>(null)

  // Paints the pad for a lift between 0 and 1: the rim's height, the colours, the shadow and the lettering's rise. Called every frame while the lift moves, and once at mount
  const paint = (value: number) => {
    const colours = floorColours(colour, value, disabled, quiet)
    if (wall.current) wall.current.scale.z = FLAT + (rim - FLAT) * value
    if (top.current) {
      top.current.color.set(colours.rimTop)
      top.current.opacity = colours.rimOpacity
    }
    side.current?.color.set(colours.rimSide)
    if (fill.current) {
      fill.current.color.set(colours.fill)
      fill.current.opacity = colours.fillOpacity
    }
    if (dropShadow.current) dropShadow.current.opacity = 0.7 * value
    if (raised.current) raised.current.position.y = rim * LABEL_RISE * value
  }
  useFrame((_, dt) => {
    const next = stepLift(lift.current, target, dt, reduced)
    if (next === lift.current && !disabled) return
    lift.current = next
    paint(next)
  })
  // A change of colour, size or disabled state repaints at once, whatever the lift
  useEffect(() => paint(lift.current))

  const lettering: TextStyle = { color: floorColours(colour, 0, disabled, quiet).label, weight: letters.weight, shadow: "rgba(0,0,0,0.55)|10|3" }
  return (
    <group ref={root} position={[at.x, 0, at.z]} rotation-y={at.yaw ?? 0}>
      {/* The soft shadow under the rim: it shows as the rim lifts */}
      <mesh rotation-x={-Math.PI / 2} position={[0.04, PAD_Y - 0.002, 0.1 + rim]} renderOrder={-0.8} raycast={() => null}>
        <planeGeometry args={[width * 1.12, depth * 1.2]} />
        <meshBasicMaterial ref={dropShadow} map={shadow} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* The flat pad: a tint at rest, brighter as the rim lifts */}
      <mesh rotation-x={-Math.PI / 2} position-y={PAD_Y} renderOrder={-0.5} raycast={() => null}>
        <shapeGeometry args={[fillGeometry]} />
        <meshBasicMaterial ref={fill} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* The rim: a thin outline lying on the table, a wall when it lifts */}
      <group rotation-x={-Math.PI / 2} position-y={RIM_Y}>
        <mesh ref={wall} geometry={geometry} renderOrder={3} scale-z={FLAT} raycast={() => null}>
          <meshBasicMaterial ref={top} toneMapped={false} attach="material-0" transparent depthWrite={false} />
          <meshBasicMaterial ref={side} toneMapped={false} attach="material-1" />
        </mesh>
      </group>
      <group ref={raised}>
        <TableText text={label} style={lettering} height={fitLabel(label, width - 2 * border - 0.2, labelHeight)} position={[0, TEXT_Y, 0]} font={letters.display} opacity={disabled ? 0.55 : 1} layer={6} />
      </group>
      {/* What the pointer reaches: the whole pad, and a little past it, so that the edge is easy to find */}
      {pressable && (
        <mesh
          rotation-x={-Math.PI / 2}
          position-y={HIT_Y}
          onClick={(e) => {
            e.stopPropagation()
            onPress()
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
          }}
          onPointerOut={() => {
            setHovered(false)
            setPressed(false)
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            setPressed(true)
          }}
          onPointerUp={() => setPressed(false)}
        >
          <planeGeometry args={[width, depth]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
