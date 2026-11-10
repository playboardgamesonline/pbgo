"use client"

import { createContext, type ReactNode, useContext, useMemo } from "react"
import type { Quaternion, Vector3 } from "three"
import type { DieModel } from "./model"
import { type Arena, loadPhysics, type Recording, simulate, type Tuning } from "./physics"
import { DIE_SETTINGS } from "./settings"

/** The part of the table dice are thrown onto: a rectangle, with an invisible wall round it that keeps them in */
export type DiceArea = Arena

/** What a tray knows of a die: who it is, its shape and size, and where it lies if it lies still */
export type DieHandle = {
  id: string
  model: DieModel
  size: number
  resting: () => { position: Vector3; quaternion: Quaternion } | null
}

type Throw = { handle: DieHandle; key: string; from?: Vector3; done: (recording: Recording | null) => void }

const tuning = (): Tuning => ({ gravity: DIE_SETTINGS.gravity, restitution: DIE_SETTINGS.restitution, friction: DIE_SETTINGS.friction, throwSpeed: DIE_SETTINGS.throwSpeed, spin: DIE_SETTINGS.spin })

/**
 * The world dice are thrown in. The dice that are asked to roll in the same moment are thrown together, so they meet; the ones that lie still in the tray are in the way, as they are on a table. Each throw comes back as a
 * recording, and nothing is drawn until it is made: the roll is already known when the die leaves the hand. It is a plain object, not a component, so a die outside any tray makes one for itself.
 */
export class Tray {
  area: DiceArea
  private handles = new Map<string, DieHandle>()
  private waiting = new Map<string, Throw>()
  private scheduled = false

  constructor(area: DiceArea) {
    this.area = area
  }

  /** Lets the tray know a die is there. Returns what takes it out again */
  register(handle: DieHandle): () => void {
    this.handles.set(handle.id, handle)
    return () => {
      if (this.handles.get(handle.id) === handle) this.handles.delete(handle.id)
      this.waiting.delete(handle.id)
    }
  }

  /** Asks for a throw. All the throws asked for in the same moment are made together, in one world */
  throw(request: Throw): void {
    this.waiting.set(request.handle.id, request)
    if (this.scheduled) return
    this.scheduled = true
    queueMicrotask(() => void this.flush())
  }

  private async flush(): Promise<void> {
    this.scheduled = false
    const batch = [...this.waiting.values()]
    this.waiting.clear()
    if (batch.length === 0) return
    try {
      const R = await loadPhysics()
      const thrown = batch.map(({ handle, key, from }) => ({ id: handle.id, model: handle.model, size: handle.size, key, ...(from ? { from } : {}) }))
      const resting = [...this.handles.values()].flatMap((handle) => {
        if (batch.some((request) => request.handle.id === handle.id)) return []
        const pose = handle.resting()
        return pose ? [{ model: handle.model, size: handle.size, position: pose.position, quaternion: pose.quaternion }] : []
      })
      const recordings = simulate(R, this.area, thrown, resting, tuning())
      batch.forEach((request, i) => request.done(recordings[i] ?? null))
    } catch (error) {
      // The physics is not there (the chunk did not load, or WebAssembly is blocked): the dice lie on their numbers at once
      console.error("The dice could not be thrown", error)
      batch.forEach((request) => request.done(null))
    }
  }
}

const TrayContext = createContext<Tray | null>(null)

/** The tray the dice around this component are in, or null outside any */
export const useTray = () => useContext(TrayContext)

/**
 * The part of the table where dice are thrown. Dice inside it that roll together meet and knock one another, the ones that lie still are in their way, and a wall keeps all of them in the `area`. A die outside a tray is thrown
 * alone, in an area around its place.
 */
export function DiceTray({ area, children }: { area: DiceArea; children: ReactNode }) {
  // A tray is made for its area: the dice that are in it are in the new one if the area changes
  const { x, z, width, depth } = area
  const tray = useMemo(() => new Tray({ x, z, width, depth }), [x, z, width, depth])
  return <TrayContext.Provider value={tray}>{children}</TrayContext.Provider>
}
