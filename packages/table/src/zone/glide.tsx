"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useFrame } from "@react-three/fiber"
import { type ReactNode, useRef, useState } from "react"
import type { Group } from "three"
import { glideStep } from "./glide-step"

export type GlideProps = {
  /** Where the group lies on the table (default: the table's origin). It starts there, so a table that is opened or reloaded finds the group in place; when it changes the group glides to the new place, with everything it holds */
  at?: { x: number; z: number }
  /** What the group holds, laid out as if the group lay at the origin of the table: everything is drawn in the group's frame, so it moves with it */
  children?: ReactNode
}

const ORIGIN = { x: 0, z: 0 }

/**
 * A group of the table that glides to where it is asked to lie, with everything it holds: cards, piles, buttons, the words over them. A card glides to a new slot of its own accord, but what is not a card does not, and moves at once when its place changes: a board that
 * moves a whole part of the table, the draw pile and the pad beside it making room for the discard when it gets its first card, puts that part in a `Glide` and changes `at`. It closes on its place at `GLIDE_RATE` a second (`glideStep`), lands exactly on it, and a visitor who asks for
 * less motion (`usePrefersReducedMotion`, as every block of the table) gets it there at once.
 *
 * The group is a plain `group` of three.js with no size, so it changes nothing else: the poses of its cards, the press areas of its pads and the places of its labels are all in its frame, and the pose memory hands a card that comes from another zone the pose it left in the frame of its parent, which is this group.
 */
export function Glide({ at = ORIGIN, children }: GlideProps) {
  const group = useRef<Group>(null)
  const reduced = usePrefersReducedMotion()
  // The place it starts at is the one it is first asked for. A `position` that followed `at` would put the group at the new place at once, and a glide would have nothing to cross
  const [start] = useState(at)
  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    g.position.x = glideStep(g.position.x, at.x, dt, reduced)
    g.position.z = glideStep(g.position.z, at.z, dt, reduced)
  })
  return (
    <group ref={group} position={[start.x, 0, start.z]}>
      {children}
    </group>
  )
}
