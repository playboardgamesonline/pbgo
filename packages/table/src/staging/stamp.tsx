"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useFrame } from "@react-three/fiber"
import { type ReactNode, useRef } from "react"
import type { Group } from "three"
import { type StampTiming, stampAt } from "./stamp-look"

export type StampProps = StampTiming & {
  /** Whether it lands (default true): the landing plays from its start when this turns true and, while it is true, from the first frame it is drawn. While it is false what is inside is simply there */
  entering?: boolean
  children: ReactNode
}

/**
 * Something that lands on the table like a stamp thumped down: it waits `delay`, then grows from nothing to a little too big and back to its size while it comes down by `drop` (`stampAt`). It scales and moves what is inside it, about the origin of
 * its own frame, so put what lands with its middle there: a `Picture` at the origin of a group that lies where the stamp does. A visitor who asks for less motion gets what is inside as it is, at once.
 */
export function Stamp({ entering = true, delay, duration, drop, children }: StampProps) {
  const reduced = usePrefersReducedMotion()
  const group = useRef<Group>(null)
  const started = useRef<number | null>(null)
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    if (entering && !reduced) started.current ??= clock.elapsedTime
    else started.current = null
    const elapsed = started.current === null ? Infinity : clock.elapsedTime - started.current
    const { visible, scale, lift } = stampAt(elapsed, { delay, duration, drop })
    g.visible = visible
    g.scale.setScalar(scale)
    g.position.y = lift
  })
  // From the first frame it is as small as the landing starts, so that it is never seen whole before it lands
  return (
    <group ref={group} scale={entering && !reduced ? 0.001 : 1}>
      {children}
    </group>
  )
}
