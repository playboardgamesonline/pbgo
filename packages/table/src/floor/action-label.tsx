"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { Billboard, useCursor } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import { type Group, type Mesh, type MeshBasicMaterial, Shape, ShapeGeometry, Vector2, Vector3 } from "three"
import { NO_TOUCH, type Touch } from "../card/states"
import { useCardBlooms } from "../card/theme"
import { useLettering } from "../lettering"
import { RESTING_HEIGHT } from "../pose"
import { paintText, useFontReady } from "../seat/table-text"
import { arrowOffset, arrowOutline, type Footprint, LABEL_GAP, LABEL_HEIGHT, LABEL_ROOM, labelColour, labelPlan, labelScale, pointerTouch, reachAlong, touchOf } from "./label-look"
import { liftTarget, stepLift } from "./lift"

export type ActionLabelProps = {
  /** The middle of the object, at the height of its top (`y`, the table's when not given): the label stands over it, centred on it as the camera sees it, with its arrow pointing down at the object. `pileAboveAt` gives it for a pile */
  at: { x: number; y?: number; z: number }
  /** The room the object takes on the table (`pileFootprint` gives it for a pile): the label is set up the screen from the middle of the object as far as the object reaches up the screen, so it stands clear of it, over its far edge, and never over its face. Without it the label hangs from `at` itself, a point */
  over?: Footprint
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
  /** The most width the lettering takes, in world units (default `LABEL_ROOM`): the room between the label and the next thing it would touch, which is another label when two objects are side by side */
  room?: number
  /** How far the object rises when it is lifted under the pointer, in world units (default 0): the label rises as far with it, so that the object never covers it. `cardRise` gives it for a card */
  rise?: number
}

const SHADOW = "rgba(0,0,0,0.7)|14|4"
/** The camera's up in the table's frame, kept between frames so that a frame allocates nothing */
const UP = new Vector3()
/** How dim a label that cannot be pressed is */
const DIM = 0.5

/**
 * The word that says what pressing an object does: "Draw" over the draw pile, "Take the discard" over the discard. It floats above the object, facing the camera (`Billboard`), with a small arrow under it that points down at the object and bobs toward it, and it is
 * pressed like the object: a click on the word does what a click on the object does, the object lights when the word is under the pointer and the word when the object is. It is the one text a board writes on the table: what to do now is a sentence, and the ticker says it (`prompt`).
 *
 * It stands centred over the object as the camera sees it, set up the screen from the middle of the object as far as the object reaches up the screen (`over`), so it is over its far edge and not over its face, whatever the camera and the object turn to; and it rises as far as
 * the object does when that lifts under the pointer, so the object never covers its arrow.
 * The lettering is the table's (`useLettering`) and its colour the object's own: the colour of the `interactive` bloom of a card (`UI_THEME.card`), lightened to read on the table, and the `hover` one as the word lifts, so a board types none. The lettering is painted white once
 * and tinted, so a change of state never paints it again. It grows into place as it appears and a little more under the pointer, and a visitor who asks for less motion gets it still and in place, with no bob.
 *
 * The keyboard reaches the object, not the label: the object keeps the one hidden button in the page (`ariaLabel` of the card), so a screen reader reads one entry for one action.
 */
export function ActionLabel({ at, over, label, onPress, disabled = false, touch = NO_TOUCH, onTouch, labelHeight = LABEL_HEIGHT, room = LABEL_ROOM, rise = 0 }: ActionLabelProps) {
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
  const hang = useRef<Group>(null)
  const arrow = useRef<Mesh>(null)
  const arrowMaterial = useRef<MeshBasicMaterial>(null)
  const letteringMaterial = useRef<MeshBasicMaterial>(null)
  const appear = useRef(0)
  const lift = useRef(0)
  const painted = useRef("")
  useFrame(({ clock, camera }, dt) => {
    const group = root.current
    const tip = hang.current
    if (!group || !tip) return
    appear.current = stepLift(appear.current, 1, dt, reduced)
    lift.current = stepLift(lift.current, target, dt, reduced)
    // The object's lift: the label rises as far as the object does
    group.position.y = lift.current * rise
    // The tip of the arrow stands up the screen from the middle of the object: as far as the object reaches up the screen (the horizontal part of the camera's up, along which the footprint on the table is measured) and a gap more. The offset is along the camera's up, so it
    // keeps the screen's own column: the label is centred over the object as the camera sees it, which a point on the object's far edge, skewed by the perspective, is not. It grows about the tip, so it never leans into the object
    UP.set(0, 1, 0).applyQuaternion(camera.quaternion)
    tip.position.y = (over ? reachAlong(over, UP.x, UP.z) : 0) + LABEL_GAP.tip
    tip.scale.setScalar(labelScale(appear.current, lift.current))
    // The arrow bobs down toward the object
    if (arrow.current) arrow.current.position.y = disabled ? 0 : -arrowOffset(clock.elapsedTime, lift.current, reduced)
    const opacity = appear.current * (disabled ? DIM : 1)
    const colour = labelColour(blooms.interactive.color, blooms.hover.color, lift.current, disabled)
    if (colour !== painted.current) {
      painted.current = colour
      arrowMaterial.current?.color.set(colour)
      letteringMaterial.current?.color.set(colour)
    }
    if (arrowMaterial.current) arrowMaterial.current.opacity = opacity
    if (letteringMaterial.current) letteringMaterial.current.opacity = opacity
  })

  return (
    <group position={[at.x, at.y ?? RESTING_HEIGHT, at.z]}>
      {/* The object's lift: the label rises with the object when it is lifted */}
      <group ref={root}>
        {/* The label faces the camera, so its own up is the screen's up */}
        <Billboard>
          {/* The tip of the arrow is the origin of this group: it is set up the screen from the middle of the object and the label hangs above it and grows about it */}
          <group ref={hang} scale={labelScale(0, 0)}>
            <mesh ref={arrow} geometry={outline} renderOrder={6} raycast={() => null}>
              <meshBasicMaterial ref={arrowMaterial} transparent opacity={0} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh position={[0, plan.letteringY, 0]} renderOrder={6} raycast={() => null}>
              <planeGeometry args={[planeHeight * lettering.ratio, planeHeight]} />
              <meshBasicMaterial ref={letteringMaterial} map={lettering.texture} transparent opacity={0} depthWrite={false} toneMapped={false} />
            </mesh>
            {/* What the pointer reaches: the arrow, the lettering and a margin round them, and never the object */}
            {pressable && (
              <mesh
                position={[plan.hit.x, plan.hit.y, 0.01]}
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
                <planeGeometry args={[plan.hit.width, plan.hit.height]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            )}
          </group>
        </Billboard>
      </group>
    </group>
  )
}
