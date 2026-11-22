"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useCursor } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import { type Group, type Mesh, type MeshBasicMaterial, Shape, ShapeGeometry, Vector2 } from "three"
import { shadowTexture } from "../card/textures"
import { NO_TOUCH, type Touch } from "../card/states"
import { useCardBlooms } from "../card/theme"
import { useLettering } from "../lettering"
import { RESTING_HEIGHT } from "../pose"
import { paintText, useFontReady } from "../seat/table-text"
import { ARROW, arrowOffset, arrowOutline, LABEL_GAP, LABEL_HEIGHT, LABEL_ROOM, labelColour, labelPlan, labelScale, pointerTouch, touchOf } from "./label-look"
import { liftTarget, stepLift } from "./lift"

export type ActionLabelProps = {
  /** Where the arrow points: the middle of the edge of the object that is farthest from the viewer, at the height of the top of the object (`y`, the table's when not given). `pileAboveAt` gives it for a pile. The label lies in the plane of that height, on the far side of the point and a gap away from it, and stays upright for the viewer: an object that stands higher than the label would hide it from a low camera */
  at: { x: number; y?: number; z: number }
  /** What pressing the object does, in the game's words and the visitor's language: one word or two ("Draw", "Take the discard"). Not a sentence: what to do now is the `prompt` of the ticker */
  label: string
  /** Pressing the label (a click, a tap) does the same as pressing the object. Without it the label is drawn and takes no press */
  onPress?: () => void
  /** The label shows and takes no press: it lies dim and still. A board that cannot press the object gives no label at all, so this is for the object that is there and cannot do it now */
  disabled?: boolean
  /** What the visitor does to the object the label names (the pointer is over it, the keyboard focus is on it, the pointer is down on it): the label lights as the object does. A `Pile` says it by itself; an object of a `Zone` reports it with `onHover` of its card */
  touch?: Touch
  /** Told what the visitor does to the label, every time it changes, and `NO_TOUCH` when the label goes: the board states the object from it (`effectiveState`), so that the object lights as the label does */
  onTouch?: (touch: Touch) => void
  /** The size of the lettering in world units (default `LABEL_HEIGHT`); a word too long for `room` is set smaller to fit it, on one line */
  labelHeight?: number
  /** The most width the lettering takes along the table, in world units (default `LABEL_ROOM`): the room between the label and the next thing it would touch, which is another label when two objects are side by side */
  room?: number
  /** How far the object rises when it is lifted under the pointer, in world units (default 0): the label rises as far with it, so that the object never covers it. `cardRise` gives it for a card */
  rise?: number
}

/** How far over the top of the object the label lies, in world units: over the mat and the face of a card that lies there, so that nothing flickers between them */
const LABEL_RAISE = 0.01
const SHADOW = "rgba(0,0,0,0.7)|14|4"
/** How dim a label that cannot be pressed is */
const DIM = 0.5

/**
 * The word that says what pressing an object does: "Draw" over the draw pile, "Take the discard" over the discard. It lies flat on the table on the far side of the object, upright for the viewer, with a small arrow under it that points at the object and bobs toward it,
 * and it is pressed like the object: a click on the word does what a click on the object does, the object lights when the word is under the pointer and the word when the object is. It is the one text a board writes on the table: what to do now is a sentence, and the ticker says it (`prompt`).
 *
 * The lettering is the table's (`useLettering`) and its colour the object's own: the colour of the `interactive` bloom of a card (`UI_THEME.card`), lightened to read on the table, and the `hover` one as the word lifts, so a board types none. The lettering is painted white once
 * and tinted, so a change of state never paints it again. It grows into place as it appears and a little more under the pointer, and a visitor who asks for less motion gets it still and in place, with no bob.
 *
 * The keyboard reaches the object, not the label: the object keeps the one hidden button in the page (`ariaLabel` of the card), so a screen reader reads one entry for one action.
 */
export function ActionLabel({ at, label, onPress, disabled = false, touch = NO_TOUCH, onTouch, labelHeight = LABEL_HEIGHT, room = LABEL_ROOM, rise = 0 }: ActionLabelProps) {
  const letters = useLettering()
  const blooms = useCardBlooms()
  const reduced = usePrefersReducedMotion()
  const pressable = !!onPress && !disabled
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  useCursor(hovered && pressable)

  // The lettering, painted white with its shadow: the material gives it its colour
  const fontReady = useFontReady(letters.display)
  const lettering = useMemo(
    () => paintText(label, { color: "#ffffff", weight: letters.weight, shadow: SHADOW }, letters.display),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [label, letters.weight, letters.display, fontReady],
  )
  useEffect(() => () => lettering.texture.dispose(), [lettering])
  const plan = useMemo(() => labelPlan(lettering.textWidth, room, labelHeight), [lettering.textWidth, room, labelHeight])
  const planeHeight = plan.height * lettering.scale
  const outline = useMemo(() => new ShapeGeometry(new Shape(arrowOutline().map(([x, y]) => new Vector2(x, y)))), [])
  useEffect(() => () => outline.dispose(), [outline])
  const [shadow] = useState(shadowTexture)

  // What the visitor does to the label, which the board reads, and what is done to the label or to the object it names, which lifts it
  const own = pointerTouch(pressable && hovered, pressable && pressed)
  const latest = useRef(onTouch)
  useEffect(() => {
    latest.current = onTouch
  })
  const ownHovered = own.hovered
  const ownPressed = own.pressed
  useEffect(() => {
    latest.current?.(pointerTouch(ownHovered, ownPressed))
  }, [ownHovered, ownPressed])
  // A label that goes (the object cannot be pressed any more) leaves nothing touched behind it
  useEffect(() => () => latest.current?.(NO_TOUCH), [])
  const target = liftTarget({ ...touchOf(own, touch), disabled })

  const root = useRef<Group>(null)
  const arrow = useRef<Mesh>(null)
  const arrowMaterial = useRef<MeshBasicMaterial>(null)
  const letteringMaterial = useRef<MeshBasicMaterial>(null)
  const shadowMaterial = useRef<MeshBasicMaterial>(null)
  const appear = useRef(0)
  const lift = useRef(0)
  const painted = useRef("")
  useFrame(({ clock }, dt) => {
    const group = root.current
    if (!group) return
    appear.current = stepLift(appear.current, 1, dt, reduced)
    lift.current = stepLift(lift.current, target, dt, reduced)
    group.scale.setScalar(labelScale(appear.current, lift.current))
    group.position.y = lift.current * rise
    if (arrow.current) arrow.current.position.z = disabled ? 0 : arrowOffset(clock.elapsedTime, lift.current, reduced)
    const opacity = appear.current * (disabled ? DIM : 1)
    const colour = labelColour(blooms.interactive.color, blooms.hover.color, lift.current, disabled)
    if (colour !== painted.current) {
      painted.current = colour
      arrowMaterial.current?.color.set(colour)
      letteringMaterial.current?.color.set(colour)
    }
    if (arrowMaterial.current) arrowMaterial.current.opacity = opacity
    if (letteringMaterial.current) letteringMaterial.current.opacity = opacity
    if (shadowMaterial.current) shadowMaterial.current.opacity = 0.5 * opacity
  })

  return (
    <group position={[at.x, (at.y ?? RESTING_HEIGHT) + LABEL_RAISE, at.z - LABEL_GAP.tip]}>
      {/* Everything grows about the tip of the arrow, so it never leans into the object, and rises with the object when it is lifted */}
      <group ref={root} scale={labelScale(0, 0)}>
        {/* The soft shadow under the arrow, on the viewer's side as the lettering's own is */}
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.004, -ARROW.length / 2 + 0.05]} renderOrder={5} raycast={() => null}>
          <planeGeometry args={[ARROW.width * 2, ARROW.length * 2.4]} />
          <meshBasicMaterial ref={shadowMaterial} map={shadow} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh ref={arrow} geometry={outline} rotation-x={-Math.PI / 2} renderOrder={6} raycast={() => null}>
          <meshBasicMaterial ref={arrowMaterial} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, plan.letteringZ]} renderOrder={6} raycast={() => null}>
          <planeGeometry args={[planeHeight * lettering.ratio, planeHeight]} />
          <meshBasicMaterial ref={letteringMaterial} map={lettering.texture} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
        {/* What the pointer reaches: the arrow, the lettering and a margin round them, and never the object */}
        {pressable && (
          <mesh
            rotation-x={-Math.PI / 2}
            position={[plan.hit.x, 0.01, plan.hit.z]}
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
            <planeGeometry args={[plan.hit.width, plan.hit.depth]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
      </group>
    </group>
  )
}
