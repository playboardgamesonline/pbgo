"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ThreeEvent } from "@react-three/fiber"
import { Counter } from "../counter/counter"
import { makeFlatPiece } from "../piece/models"
import { regularOutline, roundedOutline } from "../piece/outline"
import { Piece } from "../piece/piece"
import type { TextStyle } from "../seat/table-text"
import { canStep, type NumberRange, rangeOf, repeatAfter, stepped } from "./steps"
import { STEPPER_SETTINGS } from "./settings"

export type StepperProps = NumberRange & {
  /** The number the board holds. The stepper shows it and asks for the next one with `onChange`: it does not keep one of its own */
  value: number
  /** Called with the number a press gives, each time one does: once for a press, then again and again while the arrow is held. Without it the stepper only shows its number */
  onChange?: (value: number) => void
  /** Where the number lies on the table (its middle) and the way it faces (`yaw`, radians about the vertical axis, counterclockwise from above); the arrows stand to its left and right */
  at: { x: number; z: number; yaw?: number }
  /** The height of the digits in world units (default 1); the arrows follow it */
  size?: number
  /** How the number is written: "3", "3 dice", "$12". The game's own words, in the visitor's language. Default: the number */
  format?: (value: number) => string
  /** The colour of the arrows */
  color?: string
  /** How the digits are dressed (`TextStyle` of `TableText`) */
  style?: TextStyle
  /** Shows what changed above the number, "+1", which floats up and fades (default false: a stepper changes by one at a time) */
  change?: boolean
  /** Nobody can press the arrows now, and they are dimmed */
  disabled?: boolean
}

/** The arrow: a triangle with its point to the right and rounded corners, a flat piece like a token, which a game can dress with `color` */
const ARROW = makeFlatPiece({ name: "arrow", outline: roundedOutline(regularOutline(3), 0.12), height: 0.18 })
const ARROW_COLOR = "#e8b43a"
const DIMMED = "#6f6a5c"
/** How far from the middle of the number the arrows stand, in heights of the digits: room for the widest number the range allows, and a margin */
const REACH = { margin: 0.95, perDigit: 0.38 }
/** The width of an arrow, in heights of the digits */
const ARROW_SIZE = 0.9

const digitsOf = (text: string) => text.length
const noop = () => undefined

/**
 * A number on the table that a player changes with two arrows, one on each side: the left one takes a step down, the right one a step up, and held down they repeat, faster and faster, which is how a number far away is reached. It is how a bet or a count
 * is written without a window, in the look of the game: the arrows are flat pieces that take the game's `color`, the digits are a `Counter`, which counts to each new number. The stepper holds no number: it shows the `value` of the board and asks
 * for the next with `onChange`, kept to the `min`, `max` and `step` of the rules of the engine (`cleanNumber`), which is the one to decide. An arrow at the end of the range is dimmed and does nothing.
 */
export function Stepper({ value, onChange, min, max, step, at, size = 1, format, color = ARROW_COLOR, style, change = false, disabled = false }: StepperProps) {
  const range = useMemo(() => rangeOf({ min, max, step }), [min, max, step])
  const yaw = at.yaw ?? 0
  // The most digits the number can have, which says how far the arrows must stand
  const widest = Math.max(digitsOf(format ? format(range.min) : String(range.min)), digitsOf(format ? format(range.max) : String(range.max)))
  const gap = size * (REACH.margin + REACH.perDigit * widest)
  const along = (distance: number) => ({ x: at.x + Math.cos(yaw) * distance, z: at.z - Math.sin(yaw) * distance })

  // The number the next press starts from: the one the board holds, or the one the last press asked for while the board has not answered
  const latest = useRef({ value, range, onChange, disabled })
  const held = useRef<{ timer: ReturnType<typeof setTimeout> | null; end: () => void } | null>(null)
  const [pressed, setPressed] = useState<1 | -1 | null>(null)
  const [over, setOver] = useState<1 | -1 | null>(null)
  useEffect(() => {
    latest.current = { value, range, onChange, disabled }
  })

  /** One press of the arrow of `direction`: asks the board for the next number, and says whether there is one */
  const press = (direction: 1 | -1) => {
    const now = latest.current
    if (now.disabled || !now.onChange) return false
    const next = stepped(now.value, direction, now.range)
    if (next === now.value) return false
    // The press after this one starts from here even if the board has not answered yet
    now.value = next
    now.onChange(next)
    return true
  }
  const release = () => {
    held.current?.end()
    held.current = null
    setPressed(null)
  }
  useEffect(() => release, [])

  const start = (direction: 1 | -1) => (event: ThreeEvent<PointerEvent>) => {
    if (event.nativeEvent.button !== 0 || held.current) return
    event.stopPropagation()
    if (!press(direction)) return
    setPressed(direction)
    let index = 0
    const again = () => {
      if (!press(direction)) return release()
      index++
      if (held.current) held.current.timer = setTimeout(again, repeatAfter(index, STEPPER_SETTINGS) * 1000)
    }
    const end = () => {
      if (held.current?.timer) clearTimeout(held.current.timer)
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
    }
    held.current = { timer: setTimeout(again, repeatAfter(0, STEPPER_SETTINGS) * 1000), end }
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", release)
  }

  const arrow = (direction: 1 | -1) => {
    const live = !disabled && !!onChange && canStep(value, direction, range)
    const lift = pressed === direction ? -STEPPER_SETTINGS.sink : live && over === direction ? STEPPER_SETTINGS.rise : 0
    return (
      <group onPointerDown={live ? start(direction) : undefined}>
        <Piece
          model={ARROW}
          at={{ ...along(direction * gap), yaw: yaw + (direction === 1 ? 0 : Math.PI) }}
          size={size * ARROW_SIZE}
          color={live ? color : DIMMED}
          lift={lift}
          onHover={(hovered) => setOver((current) => (hovered ? direction : current === direction ? null : current))}
          onClick={live ? noop : undefined}
        />
      </group>
    )
  }

  return (
    <>
      <Counter value={value} at={at} height={size * 0.9} format={format} change={change} style={style} seconds={0.2} />
      {arrow(-1)}
      {arrow(1)}
    </>
  )
}
