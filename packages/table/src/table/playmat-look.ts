import { BLENDS, type Blend } from "./mat"

// The pure half of a playmat, a bounded mat with an edge that can roll out on the table: the clock of the roll-out, where the roll of cloth stands as it goes, and how a cloth is blended over the playmat's picture. No three.js and no React: `playmat.tsx` draws it
// and `playmat-look.test.ts` holds it.

/** What a playmat is made of, unless a game says another: the thickness of its rim and the rounding of its corners, the clock of the roll-out and the cloth laid over its picture. The numbers are in world units unless they say another */
export const PLAYMAT = {
  /** How thick the rim is: the playmat lies this high above the table */
  thickness: 0.018,
  /** The rounding of its corners, a share of its shorter side */
  rounding: 0.024,
  /** Seconds it waits before it begins to roll out */
  delay: 0.15,
  /** Seconds it takes to roll out */
  duration: 2.4,
  /** How many world units one repeat of the cloth covers: the same as a table's mat (`SURFACE_TILE`) */
  tile: 2,
  /** How strongly the cloth is laid over the picture, 0 to 1 */
  strength: 0.8,
  /** How the cloth is laid over the picture */
  blend: "soft-light" as Blend,
} as const

const clamp = (n: number) => Math.min(1, Math.max(0, n))

/** The way a playmat is: still rolled up and waiting, rolling out, or laid flat */
export type Unroll = "rolled" | "unrolling" | "flat"

/** How long a roll-out waits and takes, in seconds */
export type UnrollTiming = { delay?: number; duration?: number }

/** How far the playmat has rolled out, 0 to 1, `elapsed` seconds after it began: it waits `delay`, then goes fast at first and settles slowly, as a roll of cloth that is thrown out and let go (a cubic ease-out) */
export function unrollProgress(elapsed: number, { delay = PLAYMAT.delay, duration = PLAYMAT.duration }: UnrollTiming = {}): number {
  const t = clamp((elapsed - delay) / Math.max(1e-6, duration))
  return 1 - (1 - t) ** 3
}

/**
 * The clock of a playmat, one step: what it is asked to be (`mode`), when its roll-out began (`started`, a time of the clock, or null while it has not) and the time now. Gives how far it has rolled out and when it began.
 * `rolled` holds it at nothing and resets the clock, `flat` holds it at everything and resets it too, and `unrolling` starts the clock the first time it is asked, so that a playmat that is asked to roll out begins from the moment it is, whatever the time of the page.
 */
export function unrollClock(mode: Unroll, started: number | null, now: number, timing: UnrollTiming = {}): { progress: number; started: number | null } {
  if (mode === "rolled") return { progress: 0, started: null }
  if (mode === "flat") return { progress: 1, started: null }
  const begun = started ?? now
  return { progress: unrollProgress(now - begun, timing), started: begun }
}

/** How big the roll of cloth is, as a share of the playmat's depth: at the start, when all of the cloth is rolled up, and at the end, a last turn on the point of lying flat */
const ROLL = { rolled: 0.109, flat: 0.02 }

/** How high above the rim the roll lies, so that it does not touch the table */
const ROLL_CLEARANCE = 0.002

/** The roll of cloth at the front of the part that has rolled out: a cylinder along the depth of the playmat */
export type Roller = {
  /** It is seen until the playmat is flat */
  visible: boolean
  /** Where it lies along the width of the playmat, from its left edge at nothing to its right edge when flat */
  x: number
  /** How high its axis stands: it lies on the table */
  y: number
  /** Its radius: it shrinks as the cloth is let out */
  radius: number
}

/** Where the roll stands, and how big it is, when the playmat has rolled out by `progress` (0 to 1) */
export function rollerAt(progress: number, { width, depth, thickness = PLAYMAT.thickness }: { width: number; depth: number; thickness?: number }): Roller {
  const p = clamp(progress)
  const radius = depth * (ROLL.flat + (ROLL.rolled - ROLL.flat) * (1 - p))
  return { visible: p < 0.999, x: -width / 2 + p * width, y: radius + thickness + ROLL_CLEARANCE, radius }
}

/** How a blend lays the cloth `b` over what is below it `a`, one channel, 0 to 1: the same formula twice, in GLSL for the shader and in a function for the tests and for a reader */
type Formula = { glsl: string; apply: (a: number, b: number) => number }

const FORMULAS: Record<Blend, Formula> = {
  normal: { glsl: "b", apply: (_a, b) => b },
  multiply: { glsl: "a * b", apply: (a, b) => a * b },
  screen: { glsl: "1.0 - (1.0 - a) * (1.0 - b)", apply: (a, b) => 1 - (1 - a) * (1 - b) },
  overlay: { glsl: "mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, a))", apply: (a, b) => (a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b)) },
  // The soft light of Pegtop, which is smooth where the one of the W3C has a corner: the playmat of Courtisans has always been laid so
  "soft-light": { glsl: "(1.0 - 2.0 * b) * a * a + 2.0 * b * a", apply: (a, b) => (1 - 2 * b) * a * a + 2 * b * a },
  "hard-light": { glsl: "mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, b))", apply: (a, b) => (b < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b)) },
  lighten: { glsl: "max(a, b)", apply: (a, b) => Math.max(a, b) },
  darken: { glsl: "min(a, b)", apply: (a, b) => Math.min(a, b) },
}

/** How a blend lays one channel of the cloth `cloth` over one channel of what is below `below`, both 0 to 1 */
export function blendChannel(blend: Blend, below: number, cloth: number): number {
  return FORMULAS[blend].apply(below, cloth)
}

/** The place of each blend in the shader's `uMode`: its place in `BLENDS` */
export const BLEND_INDEX: Record<Blend, number> = Object.fromEntries(BLENDS.map((blend, i) => [blend, i])) as Record<Blend, number>

/** The function of the shader that lays the cloth `b` over what is below `a`, on the three channels at once, for the blend that `mode` is the place of (`BLEND_INDEX`) */
export const BLEND_GLSL = `vec3 blendCloth(vec3 a, vec3 b, float mode) {\n${BLENDS.map((blend, i) => `  if (mode < ${i}.5) return ${FORMULAS[blend].glsl};`).join("\n")}\n  return b;\n}`
