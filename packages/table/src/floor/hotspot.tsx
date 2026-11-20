"use client"

import { useCursor } from "@react-three/drei"
import { useEffect, useRef, useState } from "react"
import type { Group } from "three"
import { NO_TOUCH, type Touch } from "../card/states"
import { useStandIn } from "./stand-in"

export type HotspotProps = {
  /** Where the area's centre lies on the table, and the way it faces (`yaw`, radians about the vertical axis) */
  at: { x: number; z: number; yaw?: number }
  /** The area's size on the table, in world units: `width` along its own x axis, `depth` along its own z axis */
  width: number
  depth: number
  /** What a screen reader says and what the keyboard focus lands on: the area has no label of its own */
  ariaLabel: string
  /** Pressing the area (a click, a tap, Enter or Space on the focused area) does this. Without it the area takes no press and no pointer */
  onPress?: () => void
  /** What the visitor does to the area (the pointer is over it, the keyboard focus is on it, the pointer is down on it), told every time it changes and `NO_TOUCH` when the area goes: the game states the cards under it from it (`effectiveState`) */
  onTouch?: (touch: Touch) => void
  /** How high above the table the invisible plane that takes the pointer lies (default 0.35, a card's height: it lies above the cards under it, which take the pointer themselves, so that the whole area answers, cards included) */
  hitY?: number
}

/** How high the plane that takes the pointer lies unless told otherwise: above the cards that lie on the table, which are a few hundredths thick, and a hand's cards that stand up a little */
export const HOTSPOT_HIT_Y = 0.35

/**
 * An area of the table that is chosen, with nothing drawn on it: no pad, no rim, no tint. It takes the pointer and the keyboard, and tells the game how it is touched; the game lights what lies in it (the cards of a player, with the states of `Card`, or a `LightPool` where
 * there are none) and the area itself does not show. This is how a player is chosen as the target of a move: press their cards, which glow while they can be chosen, brighter under the pointer, brightest while pressed. The plate of the player is inside the area, so a press
 * on the name counts, and it never reacts.
 *
 * A canvas takes no keyboard, so the area also puts one real, visually hidden `<button>` in the page: it takes the Tab key, says `ariaLabel` to a screen reader, and presses with Enter or Space, and the focus counts as a touch (`focused`).
 */
export function Hotspot({ at, width, depth, ariaLabel, onPress, onTouch, hitY = HOTSPOT_HIT_Y }: HotspotProps) {
  const pressable = !!onPress
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const root = useRef<Group>(null)
  const focused = useStandIn({ pressable, name: ariaLabel, onPress, anchor: root, onTable: true })
  useCursor(hovered && pressable)
  const isHovered = pressable && hovered
  const isFocused = pressable && focused
  const isPressed = pressable && pressed
  const latest = useRef(onTouch)
  useEffect(() => {
    latest.current = onTouch
  })
  // The game is told when one of the three changes, not on every render of the area
  useEffect(() => {
    latest.current?.({ hovered: isHovered, focused: isFocused, pressed: isPressed })
  }, [isHovered, isFocused, isPressed])
  // An area that goes (nobody is to be chosen any more) leaves nothing touched behind it
  useEffect(() => () => latest.current?.(NO_TOUCH), [])
  return (
    <group ref={root} position={[at.x, 0, at.z]} rotation-y={at.yaw ?? 0}>
      {pressable && (
        <mesh
          rotation-x={-Math.PI / 2}
          position-y={hitY}
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
