// The pure half of a floor button: how far its rim has lifted, and the colours it wears at each stage. No three.js and no React: `floor-button.tsx` reads them, and `lift.test.ts` holds them.

/** What a floor button is doing to its rim, from what the pointer, the keyboard and the game say */
export type FloorState = { hovered: boolean; focused: boolean; pressed: boolean; disabled: boolean }

/** How far the rim has lifted at rest, under the pointer or the focus, and while pressed, from 0 (flat on the table, a thin outline) to 1 (fully raised) */
export const LIFT_LEVELS = { rest: 0, raised: 1, pressed: 0.4 } as const

/** The lift a button aims for: raised under the pointer or the keyboard focus, pressed a little down while it is held, flat at rest, and flat for good once disabled */
export function liftTarget({ hovered, focused, pressed, disabled }: FloorState): number {
  if (disabled) return LIFT_LEVELS.rest
  if (pressed) return LIFT_LEVELS.pressed
  return hovered || focused ? LIFT_LEVELS.raised : LIFT_LEVELS.rest
}

/** How fast the lift settles, per second: the rim covers about 95 % of the way in a sixth of a second */
export const LIFT_RATE = 18

/** The lift after `dt` seconds of heading for `target`. With reduced motion it is the target at once: the rim is lifted or flat, never on its way. */
export function stepLift(current: number, target: number, dt: number, reduced: boolean): number {
  if (reduced) return target
  const next = current + (target - current) * (1 - Math.exp(-LIFT_RATE * Math.max(0, dt)))
  return Math.abs(target - next) < 0.002 ? target : next
}

const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
const part = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")

/** A `#rrggbb` colour mixed with another, `t` of the way (0: the first, 1: the second). Anything else than `#rrggbb` is returned unchanged by `mix`'s caller through `isHex`. */
export function mix(a: string, b: string, t: number): string {
  return `#${[0, 1, 2].map((i) => part(channel(a, i) + (channel(b, i) - channel(a, i)) * t)).join("")}`
}

export const isHex = (colour: string) => /^#[0-9a-f]{6}$/i.test(colour)

/** The colours a floor button wears for a lift between 0 and 1 and a disabled flag, from its tone (`#rrggbb`) */
export type FloorColours = {
  /** The flat pad, and how opaque it is: a tint at rest that fills in as the rim lifts */
  fill: string
  fillOpacity: number
  /** The top of the rim (the thin outline at rest) and its wall, darker, which shows as the rim rises */
  rimTop: string
  rimSide: string
  /** The lettering */
  label: string
}

/** The pad is tinted by the tone at rest and brightens as the rim lifts; a disabled one is dim and flat. The colours move toward white by lift, never past it. */
export function floorColours(tone: string, lift: number, disabled = false): FloorColours {
  const l = Math.min(1, Math.max(0, lift))
  const dim = disabled ? 0.45 : 1
  return {
    fill: mix(tone, "#ffffff", 0.1 + 0.2 * l),
    fillOpacity: (0.3 + 0.32 * l) * dim,
    rimTop: mix(tone, "#ffffff", disabled ? 0.1 : 0.3 + 0.3 * l),
    rimSide: mix(tone, "#000000", 0.35),
    label: mix(tone, "#ffffff", disabled ? 0.5 : 0.82),
  }
}

/** The size of the letters of a label that must fit `width` on one line: the one asked for, or smaller when the text is long (a word in another language). A letter of the table's bold rounded font is about 0.62 of its height wide. */
export function fitLabel(text: string, width: number, preferred: number): number {
  const length = Math.max(1, Array.from(text).length)
  return Math.min(preferred, Math.max(0.1, width) / (length * 0.62))
}

/** The thickness of the rim's outline, in world units, for a pad of `width` by `depth`: thin, never more than a tenth of the short side */
export const rimThickness = (width: number, depth: number) => Math.min(0.09, Math.min(width, depth) / 10)

/** The corner radius of a pad, in world units: a share of the short side, so a large zone and a small button are round alike */
export const padRadius = (width: number, depth: number) => Math.min(0.35, Math.min(width, depth) * 0.18)
