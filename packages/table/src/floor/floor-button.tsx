"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useCursor } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import { ExtrudeGeometry, type Group, type Mesh, type MeshBasicMaterial, Path, Shape, Vector3 } from "three"
import { shadowTexture } from "../card/textures"
import { TABLE_FONT, TableText, type TextStyle } from "../seat/table-text"
import { fitLabel, floorColours, isHex, liftTarget, padRadius, rimThickness, stepLift } from "./lift"

export type FloorButtonProps = {
  /** Where the pad's centre lies on the table, and the way it faces (`yaw`, radians about the vertical axis) */
  at: { x: number; z: number; yaw?: number }
  /** The pad's size on the table, in world units: `width` along its own x axis, `depth` along its own z axis */
  width: number
  depth: number
  /** The colour of the pad, `#rrggbb`: the tint at rest, the outline and the rim. Read from the game's settings, never typed in a board */
  tone: string
  /** What is drawn flat on the pad, in the game's words. Leave it out for a zone that has no label (the sector in front of a seat) */
  label?: string
  /** The size of the lettering in world units (default 0.55); a label too long for the pad is set smaller to fit it, on one line */
  labelHeight?: number
  /** The CSS font of the lettering, `TABLE_FONT` by default */
  font?: string
  /** What a screen reader says and what the keyboard focus lands on; defaults to `label`. A zone with no label must give one */
  ariaLabel?: string
  /** Pressing the pad (a click, a tap, Enter or Space on the focused pad) does this. Without it the pad is drawn and takes no press */
  onPress?: () => void
  /** The pad cannot be pressed now: it lies flat and dim, takes no pointer, and the keyboard skips it */
  disabled?: boolean
  /** How high the rim rises, in world units (default `RIM_HEIGHT`) */
  rim?: number
  /** How strongly the pad is tinted, as a share of the usual (default 1): a big zone that lies under cards takes 0.5 so that it tints the table without hiding it */
  tint?: number
}

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

/** What makes the keyboard stand-in invisible and still focusable: one pixel, clipped, over the pad's place */
const SR_ONLY: Partial<CSSStyleDeclaration> = { position: "absolute", width: "1px", height: "1px", margin: "-1px", padding: "0", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: "0", pointerEvents: "none" }
const centre = new Vector3()

/** The stand-ins are placed in their parent's own frame: make it one (it is the canvas's wrapper, which has no other positioning) */
function positioned(parent: HTMLElement) {
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative"
}

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
 * A button drawn flat on the table, not floating over it: a tinted pad with a thin outline at rest. Under the pointer, under the keyboard focus and while it is pressed, its borders lift off the table (the rim rises, with a soft shadow under it) and the fill brightens. A
 * visitor who asks for less motion gets the lifted state at once, without the glide. The lettering is `TableText`, laid flat on the pad, so it is lit, turned and covered like the rest of the board.
 *
 * A canvas takes no keyboard, so each enabled pad also puts one real, visually hidden `<button>` in the page: it takes the Tab key, shows the lift while focused, says `ariaLabel` to a screen reader and presses with Enter or Space. A disabled pad has none.
 * The same block is the big zones that a board presses to choose a seat or a cell: give them no `label` and an `ariaLabel`.
 */
export function FloorButton({ at, width, depth, tone, label, labelHeight = 0.55, font = TABLE_FONT, ariaLabel, onPress, disabled = false, rim = RIM_HEIGHT, tint = 1 }: FloorButtonProps) {
  const reduced = usePrefersReducedMotion()
  const pressable = !!onPress && !disabled
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [pressed, setPressed] = useState(false)
  useCursor(hovered && pressable)
  const colour = isHex(tone) ? tone : "#808080"
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
  const root = useRef<Group>(null)
  const top = useRef<MeshBasicMaterial>(null)
  const side = useRef<MeshBasicMaterial>(null)
  const fill = useRef<MeshBasicMaterial>(null)
  const dropShadow = useRef<MeshBasicMaterial>(null)

  // Paints the pad for a lift between 0 and 1: the rim's height, the colours, the shadow and the lettering's rise. Called every frame while the lift moves, and once at mount
  const paint = (value: number) => {
    const colours = floorColours(colour, value, disabled)
    if (wall.current) wall.current.scale.z = FLAT + (rim - FLAT) * value
    top.current?.color.set(colours.rimTop)
    side.current?.color.set(colours.rimSide)
    if (fill.current) {
      fill.current.color.set(colours.fill)
      fill.current.opacity = colours.fillOpacity * tint
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

  const name = ariaLabel ?? label
  const standIn = useRef<HTMLButtonElement | null>(null)
  const latest = useRef({ onPress })
  useEffect(() => {
    latest.current = { onPress }
  })
  const { gl } = useThree()
  // The keyboard stand-in: one real button in the page, made by hand (a DOM node cannot be a child of the canvas's scene), visually hidden. It takes Tab, shows the lift while it has the focus, says its name and presses with Enter or Space
  useEffect(() => {
    const parent = gl.domElement.parentElement
    if (!pressable || name === undefined || !parent) return
    positioned(parent)
    const el = document.createElement("button")
    el.type = "button"
    el.setAttribute("aria-label", name)
    Object.assign(el.style, SR_ONLY)
    el.addEventListener("focus", () => setFocused(el.matches(":focus-visible")))
    el.addEventListener("blur", () => setFocused(false))
    el.addEventListener("click", () => latest.current.onPress?.())
    parent.appendChild(el)
    standIn.current = el
    return () => {
      el.remove()
      standIn.current = null
    }
  }, [gl, pressable, name])
  // It stays over the pad, so that a screen reader's pointer and the browser's scrolling to the focus land where the pad is
  useFrame(({ camera, size }) => {
    const el = standIn.current
    if (!el || !root.current) return
    root.current.getWorldPosition(centre).setY(0).project(camera)
    const left = `${Math.round(((centre.x + 1) / 2) * size.width)}px`
    const top = `${Math.round(((1 - centre.y) / 2) * size.height)}px`
    if (el.style.left !== left) el.style.left = left
    if (el.style.top !== top) el.style.top = top
  })
  const lettering: TextStyle = { color: floorColours(colour, 0, disabled).label, weight: 800, shadow: "rgba(0,0,0,0.55)|10|3" }
  return (
    <group ref={root} position={[at.x, 0, at.z]} rotation-y={at.yaw ?? 0}>
      {/* The soft shadow under the rim: it shows as the rim lifts */}
      <mesh rotation-x={-Math.PI / 2} position={[0.04, PAD_Y - 0.002, 0.1 + rim]} renderOrder={1} raycast={() => null}>
        <planeGeometry args={[width * 1.12, depth * 1.2]} />
        <meshBasicMaterial ref={dropShadow} map={shadow} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* The flat pad: a tint at rest, brighter as the rim lifts */}
      <mesh rotation-x={-Math.PI / 2} position-y={PAD_Y} renderOrder={2} raycast={() => null}>
        <shapeGeometry args={[fillGeometry]} />
        <meshBasicMaterial ref={fill} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* The rim: a thin outline lying on the table, a wall when it lifts */}
      <group rotation-x={-Math.PI / 2} position-y={RIM_Y}>
        <mesh ref={wall} geometry={geometry} renderOrder={3} scale-z={FLAT} raycast={() => null}>
          <meshBasicMaterial ref={top} toneMapped={false} attach="material-0" />
          <meshBasicMaterial ref={side} toneMapped={false} attach="material-1" />
        </mesh>
      </group>
      {label !== undefined && (
        <group ref={raised}>
          <TableText text={label} style={lettering} height={fitLabel(label, width - 2 * border - 0.2, labelHeight)} position={[0, TEXT_Y, 0]} font={font} opacity={disabled ? 0.55 : 1} layer={6} />
        </group>
      )}
      {/* What the pointer reaches: the whole pad, and a little past it, so that the edge is easy to find */}
      {pressable && (
        <mesh
          rotation-x={-Math.PI / 2}
          position-y={0.02}
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
