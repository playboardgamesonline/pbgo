"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useFrame } from "@react-three/fiber"
import { useEffect, useRef, useState } from "react"
import type { Group } from "three"
import { TableText, type TextStyle } from "../seat/table-text"
import { changeText, type CountStep, countSteps } from "./count"
import { COUNTER_SETTINGS } from "./settings"

export type CounterProps = {
  /** The number the state says. The counter shows it at once when it first appears, then counts up or down to each new one */
  value: number
  /** Where the number lies on the table (its middle) and the way it faces (`yaw`, radians about the vertical axis, counterclockwise from above) */
  at: { x: number; z: number; yaw?: number }
  /** How high above the table it lies (default just over the surface): the height of what it lies on, to write a number on a piece */
  y?: number
  /** The size of the letters in world units (default 0.9) */
  height?: number
  /** How the letters are dressed: the colour, an outline, a glow (`TextStyle` of `TableText`) */
  style?: TextStyle
  /** How a number is written: "12", "12 / 20", "$12". The game's own words and symbols, in the visitor's language. Default: the number, with a true minus sign */
  format?: (value: number) => string
  /** The most seconds a change takes to count (default `COUNTER_SETTINGS.seconds`) */
  seconds?: number
  /** Shows what changed above the number, "+3" or "−2", which floats up and fades (default true). Changes that come one on the other are added up */
  change?: boolean
  /** The colour of a gain and of a loss when the change is shown */
  gain?: string
  loss?: string
  /** Called each time the number shown changes on the way, with it: a tick of sound */
  onTick?: (shown: number) => void
  /** Called when the number shown is the one the engine gave */
  onSettle?: (value: number) => void
  onClick?: () => void
  onHover?: (hovered: boolean) => void
}

const plain = (value: number) => (value < 0 ? `−${-value}` : String(value))
const LETTERS: TextStyle = { color: "#f4efe2", outline: "rgba(18, 24, 18, 0.6)" }
const OUTLINE = "rgba(18, 24, 18, 0.6)"
const GAIN = "#9be7a8"
const LOSS = "#ff9a8f"
const FLOATING_HEIGHT = 0.01

/** A change that floats beside the number: what it says and the colour of it */
type Floating = { text: string; color: string }

/**
 * A number lying on the table that counts: when the state gives it a new value it runs up or down to it, number by number, slower and slower, swelling a little with each, and what changed floats up beside it for a moment ("+3"). The
 * first value is shown at once. The counter writes with `TableText`, so it is lit, turned and covered as the rest of the table is; a visitor who asks for less motion sees each new number at once. The number is the state's: the counter only draws it.
 */
export function Counter({ value, at, y = 0.02, height = 0.9, style = LETTERS, format = plain, seconds, change = true, gain = GAIN, loss = LOSS, onTick, onSettle, onClick, onHover }: CounterProps) {
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState(value)
  const [floating, setFloating] = useState<Floating | null>(null)
  // How far the floating change has gone, from 0 when it appears to 1 when it has gone
  const [age, setAge] = useState(0)
  const swell = useRef<Group>(null)
  const run = useRef({ target: value, shown: value, steps: [] as CountStep[], next: 0, clock: 0, kick: 0, age: 1, pending: 0 })
  // What a frame reads: the newest props, not the ones of the render that made the frame's closure
  const latest = useRef({ value, reduced, seconds, change, gain, loss, onTick, onSettle })
  useEffect(() => {
    latest.current = { value, reduced, seconds, change, gain, loss, onTick, onSettle }
  })

  useFrame((_, dt) => {
    const r = run.current
    const now = latest.current
    const S = COUNTER_SETTINGS

    // A new value: count from the number that is shown to it, and show what changed
    if (!Object.is(r.target, now.value)) {
      const delta = now.value - r.target
      r.target = now.value
      r.next = 0
      r.clock = 0
      if (now.reduced) {
        r.steps = []
        r.shown = now.value
        setShown(now.value)
        now.onSettle?.(now.value)
      } else {
        r.steps = countSteps(r.shown, now.value, { seconds: now.seconds ?? S.seconds, tick: S.tick, maxSteps: S.maxSteps })
        if (now.change) {
          // A change that comes while the last one is still floating adds to it
          r.pending = r.age < 0.6 ? r.pending + delta : delta
          r.age = 0
          const text = changeText(r.pending)
          setAge(0)
          setFloating(text === "" ? null : { text, color: r.pending > 0 ? now.gain : now.loss })
        }
      }
    }

    if (r.next < r.steps.length) {
      r.clock += dt
      let moved = false
      while (r.next < r.steps.length && r.steps[r.next]!.at <= r.clock) {
        r.shown = r.steps[r.next]!.value
        r.next++
        moved = true
      }
      if (moved) {
        setShown(r.shown)
        r.kick = 1
        now.onTick?.(r.shown)
        if (r.next >= r.steps.length) now.onSettle?.(r.shown)
      }
    }

    // The number swells at each step and settles when the steps stop
    r.kick = Math.max(0, r.kick - dt / Math.max(0.05, S.popSeconds))
    swell.current?.scale.setScalar(1 + S.pop * r.kick)

    if (r.age < 1) {
      r.age = Math.min(1, r.age + dt / Math.max(0.2, S.floatSeconds))
      setAge(r.age)
      if (r.age >= 1) {
        r.pending = 0
        setFloating(null)
      }
    }
  })

  const rise = 1 - (1 - age) * (1 - age)
  return (
    <group position={[at.x, y, at.z]} rotation-y={at.yaw ?? 0}>
      <group ref={swell}>
        <TableText text={format(shown)} style={style} height={height} position={[0, 0, 0]} onClick={onClick} onHover={onHover} />
      </group>
      {floating && (
        <TableText
          text={floating.text}
          style={{ color: floating.color, outline: OUTLINE, weight: 900 }}
          height={height * 0.55}
          position={[0, FLOATING_HEIGHT, -(height * 0.85 + COUNTER_SETTINGS.floatRise * height * rise)]}
          opacity={Math.min(1, (1 - age) * 2.2)}
          layer={1}
        />
      )}
    </group>
  )
}
