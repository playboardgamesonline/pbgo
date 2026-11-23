import type { Color } from "three"
import type { Field } from "../debug/settings"

// The pure half of the lights drawn on the table, the aura round a zone and the band of light that lies on a lane: how they look unless a game says another, how big the planes they are drawn on are, and how strong a band is aimed to be at a moment.
// No React: `aura.tsx` and `light-band.tsx` draw them and `zone-light.test.ts` holds this.

/** How an aura looks unless a game says another: how bright its rim is (`edge`), how far its soft halo goes out (`halo`), how many stars twinkle on it (`stars`), how closely they lie (`density`), how big they are (`size`), how fast everything moves (`speed`), and an `intensity` over it all */
export const AURA_LOOK = { intensity: 1, edge: 1, halo: 1, stars: 0.5, density: 2.2, size: 1, speed: 0.4 }
export type AuraLook = typeof AURA_LOOK

/** The knobs a debug panel offers for the look of an aura (`useSettings`) */
export const AURA_FIELDS = {
  intensity: ["aura intensity", 0, 2, 0.05],
  edge: ["aura edge", 0, 2, 0.05],
  halo: ["aura halo", 0, 2, 0.05],
  stars: ["aura stars", 0, 3, 0.05],
  density: ["aura star density", 0.5, 6, 0.1],
  size: ["aura star size", 0.3, 3, 0.05],
  speed: ["aura speed", 0, 3, 0.05],
} satisfies Record<keyof AuraLook, Field>

/** How an aura stands: how far its glow reaches past the zone on every side, and how far inside the zone's edge the rim lies, and how round its corners are, in world units */
export const AURA_SHAPE = { reach: 0.8, inset: 0.05, radius: 0.35 } as const

/** Where an aura lies, how fast it settles on the strength it is given (the time constant, in seconds) and below what strength it is not drawn at all */
export const AURA = { height: 0.014, settle: 0.18, hidden: 0.01 } as const

/** The plane an aura is drawn on: the zone, bigger by the reach of the glow on every side */
export function auraPlane({ width, depth }: { width: number; depth: number }, reach: number = AURA_SHAPE.reach): { width: number; depth: number } {
  return { width: width + 2 * reach, depth: depth + 2 * reach }
}

/** How a band of light looks and moves unless a game says another: how high above the table it lies (a hair, under the cards, as an aura does), how fast it settles on its strength (seconds), how fast it fades toward its far end (the power of what is left of its length), how strong it is, how much it swells and dims (a share of its strength) and how fast (radians a second) */
export const BAND = { height: 0.014, settle: 0.15, fade: 1.6, strength: 0.85, pulse: 0.15, speed: 1.6, hidden: 0.01 } as const

/** How strong a band is aimed to be `time` seconds in: its strength, swelling and dimming by `pulse` of it at `speed` radians a second; still when a visitor asks for less motion */
export function bandTarget(strength: number, time: number, { pulse = BAND.pulse, speed = BAND.speed }: { pulse?: number; speed?: number } = {}, reduced = false): number {
  return strength * (1 + (reduced ? 0 : Math.sin(time * speed) * pulse))
}

// A colour is parsed only when it differs from the last one set on the object
const tints = new WeakMap<Color, string>()

/** Sets a colour to a value given as text, but only when it has changed: parsing it on every frame is work for nothing */
export function tint(color: Color, value: string) {
  if (tints.get(color) === value) return
  tints.set(color, value)
  color.set(value)
}
