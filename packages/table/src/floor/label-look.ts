// The pure half of an action label, the word that says what pressing an object does ("Draw" over the draw pile): where the arrow and the lettering stand above the object, how large each is, and the colour of each stage. No three.js and no React:
// `action-label.tsx` draws it and `label-look.test.ts` holds it.

import { NO_TOUCH, type Touch } from "../card/states"
import { TEXT_PX } from "../seat/text-px"
import { mix } from "./lift"

/** The size of the lettering, a `height` of `TableText`, unless a board says another */
export const LABEL_HEIGHT = 0.55

/** The most width the lettering takes, in world units: a word that is longer is set smaller, on one line. About two cards and a half across */
export const LABEL_ROOM = 3

/** The arrow, a rounded triangle that points down at the object: its width, its length and the radius of its corners, in world units */
export const ARROW = { width: 0.44, length: 0.3, round: 0.07 } as const

/** Between the tip of the arrow and the top of the object, and between the base of the arrow and the lettering, in world units */
export const LABEL_GAP = { tip: 0.16, lettering: 0.08 } as const

/** How far the arrow bobs down toward the object, in world units, and how fast, in radians a second. It never goes past the gap that is left between its tip and the object */
export const BOB = { reach: 0.08, speed: 3.4 } as const

/** The visible half height of the lettering, a share of its size: from the middle of its plane to the foot of its letters, descenders included */
const LETTER_HALF = 0.4

/** How far the pointer reaches past the lettering and the arrow, in world units, and how far below the tip, toward the object: less than the gap, so it never covers the object */
const HIT_PAD = 0.14
const HIT_BELOW_TIP = 0.06

/** How much smaller than its size the label is as it appears, and how much bigger it grows as it lifts */
const APPEAR_FROM = 0.8
const GROW = 0.07

/** How much of white is mixed into the colour of the state, at rest and when lifted: the lettering is lighter than the bloom of the object, so that it reads on the table */
const WHITE = { rest: 0.3, raised: 0.55 }

const clamp = (n: number) => Math.min(1, Math.max(0, n))

/** The size of the lettering that fits `room`: the one asked for, or smaller when the word is long (a word in another language). `textWidth` is how wide the word is painted, in canvas pixels (`paintText` of `TableText`) */
export function fitHeight(textWidth: number, room: number, preferred: number): number {
  return Math.min(preferred, (Math.max(0.1, room) * TEXT_PX) / Math.max(1, textWidth))
}

/** Where the parts of a label stand in its own frame: the tip of the arrow is the origin, x runs across and y up, so the label hangs above the tip and the arrow points down at the object under it */
export type LabelPlan = {
  /** The size of the lettering that is drawn: the one asked for, or smaller for a word that would not fit */
  height: number
  /** The width the lettering takes at that size */
  width: number
  /** How high the middle of the lettering's plane stands above the tip */
  letteringY: number
  /** What the pointer reaches: a box round the arrow and the lettering, a little below the tip and no more */
  hit: { x: number; y: number; width: number; height: number }
}

/** The plan of a label of a word `textWidth` canvas pixels wide, set to fit `room` and no bigger than `preferred` */
export function labelPlan(textWidth: number, room: number, preferred: number = LABEL_HEIGHT): LabelPlan {
  const height = fitHeight(textWidth, room, preferred)
  const width = (textWidth * height) / TEXT_PX
  const letteringY = ARROW.length + LABEL_GAP.lettering + LETTER_HALF * height
  const top = letteringY + LETTER_HALF * height + HIT_PAD
  const bottom = -HIT_BELOW_TIP
  return { height, width, letteringY, hit: { x: 0, y: (top + bottom) / 2, width: Math.max(width, ARROW.width) + 2 * HIT_PAD, height: top - bottom } }
}

/** What the pointer does to the label: `NO_TOUCH` itself while it does nothing, so that what keeps it is not told of a change that is none */
export function pointerTouch(hovered: boolean, pressed: boolean): Touch {
  return hovered || pressed ? { hovered, focused: false, pressed } : NO_TOUCH
}

/** What is done to the label: its own pointer, and what is done to the object it names. The label lights as the object does, and the object as the label does */
export function touchOf(own: Touch, partner: Touch): Touch {
  return { hovered: own.hovered || partner.hovered, focused: own.focused || partner.focused, pressed: own.pressed || partner.pressed }
}

/** The colour the lettering and the arrow are tinted with, `#rrggbb`: the `interactive` bloom colour of the object, lightened, at rest; the `hover` one, lightened more, as the label lifts (`lift`, 0 to 1); a dim grey once disabled */
export function labelColour(interactive: string, hover: string, lift: number, disabled = false): string {
  if (disabled) return mix(interactive, "#808080", 0.7)
  return mix(mix(interactive, "#ffffff", WHITE.rest), mix(hover, "#ffffff", WHITE.raised), clamp(lift))
}

/** How far down toward the object the arrow stands, in world units. At rest it bobs between its place and `BOB.reach` below it, and as the label lifts it settles at `BOB.reach`, as if it leaned on the object. With reduced motion it does not bob: it is in its place, and at `BOB.reach` when lifted */
export function arrowOffset(time: number, lift: number, reduced: boolean): number {
  const t = clamp(lift)
  if (reduced) return t * BOB.reach
  const bob = (0.5 + 0.5 * Math.sin(time * BOB.speed)) * BOB.reach
  return bob + (BOB.reach - bob) * t
}

/** How large the whole label is, about the tip of its arrow (the point it hangs from): it grows into place as it appears (`appear`, 0 to 1) and a little more as it lifts (`lift`, 0 to 1) */
export function labelScale(appear: number, lift: number): number {
  return (APPEAR_FROM + (1 - APPEAR_FROM) * clamp(appear)) * (1 + GROW * clamp(lift))
}

export type Point = readonly [x: number, y: number]

/**
 * The outline of the arrow, a triangle whose three corners are rounded, as a polygon in the arrow's own frame: the tip at the origin, the base `length` above it along y (so the arrow points down), and `width` along x. Each corner is a curve that starts `round` along one
 * edge, bends through the corner and ends `round` along the other (never more than half an edge), `steps` segments to each. A `round` of 0 is the plain triangle.
 */
export function arrowOutline(width: number = ARROW.width, length: number = ARROW.length, round: number = ARROW.round, steps = 5): Point[] {
  const corners: Point[] = [
    [0, 0],
    [width / 2, length],
    [-width / 2, length],
  ]
  const along = (from: Point, to: Point, by: number): Point => {
    const d = Math.hypot(to[0] - from[0], to[1] - from[1])
    return [from[0] + ((to[0] - from[0]) * by) / d, from[1] + ((to[1] - from[1]) * by) / d]
  }
  const out: Point[] = []
  corners.forEach((corner, i) => {
    const before = corners[(i + corners.length - 1) % corners.length]!
    const after = corners[(i + 1) % corners.length]!
    const cut = Math.min(round, Math.hypot(corner[0] - before[0], corner[1] - before[1]) / 2, Math.hypot(after[0] - corner[0], after[1] - corner[1]) / 2)
    if (cut <= 0) {
      out.push(corner)
      return
    }
    const start = along(corner, before, cut)
    const end = along(corner, after, cut)
    for (let step = 0; step <= steps; step++) {
      const t = step / steps
      // a quadratic curve from `start` to `end` with the corner for its control point
      out.push([(1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * corner[0] + t * t * end[0], (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * corner[1] + t * t * end[1]])
    }
  })
  return out
}
