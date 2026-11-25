// The pure half of an action label, the word that says what pressing an object does ("Draw" over the draw pile): where the arrow and the lettering stand above the object, how large each is, and the colour of each stage. No three.js and no React:
// `action-label.tsx` draws it and `label-look.test.ts` holds it.

import { NO_TOUCH, type Touch } from "../card/states"
import { LINE_PITCH, TEXT_PX } from "../seat/text-px"
import { mix } from "./lift"

/** The size of the lettering, a `height` of `TableText`, unless a board says another: the same for every label whatever its word and its language, which wraps onto a second line instead of being set smaller */
export const LABEL_HEIGHT = 0.3

/** The most width a line of the lettering takes, in world units: a label whose words are wider wraps onto another line, at the same size. About two cards across */
export const LABEL_ROOM = 2.4

/** The weight of the lettering: lighter than the lettering of the plates, so that a label reads as a hint beside the object it names and not as a title over it */
export const LABEL_WEIGHT = 500

/** The shadow under the lettering, `colour|blur|offset`: soft, just enough to keep the white letters apart from a light table */
export const LABEL_SHADOW = "rgba(0,0,0,0.5)|10|3"

/** How opaque the label is: a little see-through at rest, so that it stays in the background of the table, fully so under the pointer and while the object is touched, and dim once it cannot be pressed */
export const LABEL_OPACITY = { rest: 0.8, raised: 1, disabled: 0.4 } as const

/** The least size of the letters on the screen, in pixels: in a small window the whole table is small, and a label that is a hint at a laptop's size would be too small to read, so it grows until its letters are this high and no more */
export const LABEL_MIN_PX = 12

/** The arrow, a rounded triangle that points down at the object: its width, its length and the radius of its corners, in world units */
export const ARROW = { width: 0.3, length: 0.2, round: 0.05 } as const

/** Between the tip of the arrow and the far edge of the object as the camera sees it, and between the base of the arrow and the lettering, in world units */
export const LABEL_GAP = { tip: 0.1, lettering: 0.06 } as const

/** The room an object takes on the table, which the label stands clear of: its width (along its own x), its depth (along its own z), in world units, and how far it is turned about the vertical axis (`yaw`, in radians, the turn of a `Spot`) */
export type Footprint = { width: number; depth: number; yaw?: number }

/**
 * How far a footprint reaches from its middle along a direction of the table, `(dx, dz)`: the largest of the distances to its four corners measured along that direction. The direction need not be a unit one, and the answer grows with its length.
 * The label reads it along the camera's up, whose horizontal part is what an object lying on the table can reach up the screen: that is how far the label stands from the middle of the object to clear its far edge.
 */
export function reachAlong({ width, depth, yaw = 0 }: Footprint, dx: number, dz: number): number {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  // A turn of `yaw` about the vertical axis takes the footprint's own x to (cos, -sin) and its own z to (sin, cos), on the table's (x, z)
  return (Math.abs(dx * c - dz * s) * width + Math.abs(dx * s + dz * c) * depth) / 2
}

/** How far the arrow bobs down toward the object, in world units, and how fast, in radians a second. It never goes past the gap that is left between its tip and the object */
export const BOB = { reach: 0.06, speed: 3.4 } as const

/** The visible half height of the lettering, a share of its size: from the middle of its plane to the foot of its letters, descenders included */
const LETTER_HALF = 0.4

/** How far the pointer reaches past the lettering and the arrow, in world units, and how far below the tip, toward the object: less than the gap, so it never covers the object */
const HIT_PAD = 0.14
const HIT_BELOW_TIP = 0.06

/** How much smaller than its size the label is as it appears, and how much bigger it grows as it lifts */
const APPEAR_FROM = 0.8
const GROW = 0.07

/** How much of white is mixed into the colour of the state, at rest and when lifted: the lettering is nearly white, with a tint of the object's bloom, so that it reads on the table and stays apart from the object's own light */
const WHITE = { rest: 0.85, raised: 0.95 }

const clamp = (n: number) => Math.min(1, Math.max(0, n))

/**
 * The size of the lettering that fits `room`: the one asked for, which is every label's, or smaller only when a line is wider than the room by itself, a single word that cannot be broken (a very long word in another language): the lines are broken, a word is not cut, and a label
 * whose words are all short enough is the same size as every other. `textWidth` is how wide its widest line is painted, in canvas pixels (`paintText` of `TableText`)
 */
export function fitHeight(textWidth: number, room: number, preferred: number): number {
  return Math.min(preferred, (Math.max(0.1, room) * TEXT_PX) / Math.max(1, textWidth))
}

/** How many canvas pixels a line of the lettering may take for it to be no wider than `room` world units at `height`: what the label breaks its words to (`paintText`'s `room`) */
export const linePixels = (room: number, height: number): number => (Math.max(0.1, room) * TEXT_PX) / Math.max(0.01, height)

/** Where the parts of a label stand in its own frame: the tip of the arrow is the origin, x runs across and y up, so the label hangs above the tip and the arrow points down at the object under it */
export type LabelPlan = {
  /** The size of the lettering that is drawn: the one asked for, or smaller for a word that would not fit */
  height: number
  /** The width the lettering takes at that size: its widest line */
  width: number
  /** How high the middle of the lettering's plane stands above the tip: the last line is a gap over the arrow and the others hang above it, so a label of several lines grows upward, away from the object */
  letteringY: number
  /** What the pointer reaches: a box round the arrow and the lettering, a little below the tip and no more */
  hit: { x: number; y: number; width: number; height: number }
}

/** The plan of a label whose widest line is `textWidth` canvas pixels wide, in `lines` lines, set to fit `room` and no bigger than `preferred` */
export function labelPlan(textWidth: number, room: number, preferred: number = LABEL_HEIGHT, lines = 1): LabelPlan {
  const height = fitHeight(textWidth, room, preferred)
  const width = (textWidth * height) / TEXT_PX
  // from the middle of the last line to the middle of the first
  const block = Math.max(0, lines - 1) * LINE_PITCH * height
  const letteringY = ARROW.length + LABEL_GAP.lettering + LETTER_HALF * height + block / 2
  const top = letteringY + block / 2 + LETTER_HALF * height + HIT_PAD
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

/** How many pixels of the screen a world unit is at a depth, seen by a perspective camera of `fov` degrees (vertical) through a window `viewportHeight` pixels high: what the camera shows at that depth is `2 * depth * tan(fov / 2)` units high */
export function unitPixels(fov: number, depth: number, viewportHeight: number): number {
  return viewportHeight / (2 * Math.max(1e-6, depth) * Math.tan((fov * Math.PI) / 360))
}

/** How tall the letters of a label of this `height` are on the screen, in pixels, when a world unit is `pixelsPerUnit` pixels: the font is painted `EM` of the lettering's size high, a canvas pixel being `height / TEXT_PX` units */
const EM = 140 / TEXT_PX
export const lettersPixels = (height: number, pixelsPerUnit: number): number => EM * height * pixelsPerUnit

/**
 * How much bigger than its size the label is drawn so that its letters are `LABEL_MIN_PX` high on the screen at least: 1 whenever they are as high already, which is every window but a very small one. It never makes the label wider than its room (`room`, world
 * units, against `width`, how wide its widest line is at its size), so that two labels side by side never touch however small the window: the room is the one thing that holds, and the letters are only as legible as it leaves them.
 */
export function readableBoost(height: number, pixelsPerUnit: number, width: number, room: number): number {
  const letters = lettersPixels(height, pixelsPerUnit)
  const wanted = letters > 0 ? LABEL_MIN_PX / letters : 1
  const most = Math.max(1, room / Math.max(1e-6, width))
  return Math.min(Math.max(1, wanted), most)
}

/** How opaque the label and its arrow are, 0 to 1: `LABEL_OPACITY.rest` at rest, up to `LABEL_OPACITY.raised` as the label lifts (`lift`, 0 to 1), and `LABEL_OPACITY.disabled` once disabled */
export function labelOpacity(lift: number, disabled = false): number {
  if (disabled) return LABEL_OPACITY.disabled
  return LABEL_OPACITY.rest + (LABEL_OPACITY.raised - LABEL_OPACITY.rest) * clamp(lift)
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
