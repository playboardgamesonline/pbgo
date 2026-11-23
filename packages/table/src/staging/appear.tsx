"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useFrame } from "@react-three/fiber"
import { type ReactNode, useRef } from "react"
import type { Group, Material, Mesh, Object3D } from "three"
import { type AppearTiming, appearAt } from "./appear-look"

export type AppearProps = AppearTiming & {
  /** Whether it comes in (default true): the entrance plays from its start when this turns true and, while it is true, from the first frame it is drawn. While it is false what is inside is simply there */
  entering?: boolean
  /** How far above its place it starts, in world units (default 0: it fades in where it is). It comes down as it comes in */
  drop?: number
  children: ReactNode
}

/** What a material was before an entrance changed it, kept on the material */
type Remembered = { transparent: boolean; opacity: number }

/** Every material of what is under `root`, once */
function materialsOf(root: Object3D): Material[] {
  const found = new Set<Material>()
  root.traverse((object) => {
    const material = (object as Mesh).material as Material | Material[] | undefined
    if (!material) return
    for (const one of Array.isArray(material) ? material : [material]) found.add(one)
  })
  return [...found]
}

/** Lays an opacity, 0 to 1, over what a material was: its own opacity times it, and transparent while it is not all there */
function fade(root: Object3D, alpha: number) {
  for (const material of materialsOf(root)) {
    const was = (material.userData.appear ??= { transparent: material.transparent, opacity: material.opacity }) as Remembered
    material.transparent = alpha < 1 || was.transparent
    material.opacity = was.opacity * alpha
  }
}

/** Forgets what the materials were, so that the next entrance reads them as they are by then */
function forget(root: Object3D) {
  for (const material of materialsOf(root)) delete material.userData.appear
}

/**
 * Something that comes onto the table: it waits `delay`, then comes in over `duration`, fading in and coming down by `drop`, fast at first and settling (a cubic ease-out). The numbers that come up one by one at the end of a game, the sign that lands on a pile, a title
 * that is lit last, are entrances.
 *
 * It fades the materials under it that have an opacity, which is all of the table's flat ones (lettering, glyphs, planes); a material a game shares with something that is not entering is faded with it. A visitor who asks for less motion gets what is inside as it is, at once.
 */
export function Appear({ entering = true, drop = 0, delay, duration, children }: AppearProps) {
  const reduced = usePrefersReducedMotion()
  const group = useRef<Group>(null)
  const started = useRef<number | null>(null)
  const settled = useRef(true)
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    if (entering && !reduced) {
      if (started.current === null) {
        started.current = clock.elapsedTime
        forget(g)
        settled.current = false
      }
    } else {
      started.current = null
    }
    const elapsed = started.current === null ? Infinity : clock.elapsedTime - started.current
    const { visible, progress } = appearAt(elapsed, { delay, duration })
    g.visible = visible
    g.position.y = drop * (1 - progress)
    // Once it is all there it is left alone, so that what a game does to its materials after that is its own
    if (progress >= 1 && settled.current) return
    fade(g, progress)
    if (progress >= 1) settled.current = true
  })
  return <group ref={group}>{children}</group>
}
