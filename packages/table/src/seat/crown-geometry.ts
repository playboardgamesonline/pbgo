import { BufferGeometry, Color, Float32BufferAttribute } from "three"

/**
 * The shape of the turn crown: a soft, rounded crown, a thick band whose top rises into points, with no hard edge anywhere. Every number is a fraction of the crown's height, which is one unit, its foot at y = 0.
 */
export const CROWN_SHAPE = {
  /** How many points rise from the band */
  points: 5,
  /** The radius of the middle of the wall at the foot, and how much wider it is at the top of the points (a crown flares a little) */
  radius: 0.5,
  flare: 0.08,
  /** The wall's thickness: its top and its foot are half-rounds of this diameter */
  thickness: 0.1,
  /** The height of the band at the bottom of a valley between two points, and at the tip of a point */
  valley: 0.46,
  peak: 1,
  /** How round the tip of a point and the bottom of a valley are, as a share of the distance between them along the band */
  tipRound: 0.07,
  valleyRound: 0.16,
  /** The colour at the top of the points and at the foot: a warm gold that goes to orange downward */
  top: "#ffe17a",
  foot: "#f2a95a",
}
export type CrownShape = typeof CROWN_SHAPE

/** A soft absolute value: |x| with its corner at 0 rounded over about `e` */
const softAbs = (x: number, e: number) => Math.sqrt(x * x + e * e) - e

/** The profile of the points along the band, from 0 at the bottom of a valley to 1 at a tip; `d` is the distance to the nearest tip as a share of the distance from a tip to a valley, 0 to 1 */
function rise(d: number, S: CrownShape) {
  const fromValley = softAbs(1 - d, S.valleyRound)
  return Math.max(0, 1 - softAbs(1 - fromValley, S.tipRound))
}

/** How high the top of the band stands at the angle `angle` around it */
export function crownHeightAt(angle: number, S: CrownShape = CROWN_SHAPE) {
  const span = (Math.PI * 2) / S.points
  const u = (((angle / span) % 1) + 1) % 1
  const d = Math.abs(u - 0.5) * 2
  const low = rise(1, S)
  const high = rise(0, S)
  return S.valley + ((S.peak - S.valley) * (rise(d, S) - low)) / (high - low)
}

/** The cross-section of the wall at one angle, a closed loop in (radial offset from the middle of the wall, height): a half-round under the foot, the outside up, a half-round over the top, the inside down */
function section(height: number, S: CrownShape, arc: number, side: number): [number, number][] {
  const r = S.thickness / 2
  const loop: [number, number][] = []
  for (let i = 0; i < arc; i++) {
    const a = Math.PI + (Math.PI * i) / arc
    loop.push([r * Math.cos(a), r + r * Math.sin(a)])
  }
  for (let i = 0; i < side; i++) loop.push([r, r + ((height - 2 * r) * i) / side])
  for (let i = 0; i < arc; i++) {
    const a = (Math.PI * i) / arc
    loop.push([r * Math.cos(a), height - r + r * Math.sin(a)])
  }
  for (let i = 0; i < side; i++) loop.push([-r, height - r - ((height - 2 * r) * i) / side])
  return loop
}

/**
 * The crown as one closed, smooth mesh: the cross-section of the wall swept around the band, its height following the points, with smooth normals and a colour on each vertex from `top` to `foot`. `around` is how many steps the sweep takes for each point.
 */
export function crownGeometry(S: CrownShape = CROWN_SHAPE, around = 48, arc = 10, side = 10): BufferGeometry {
  const steps = S.points * around
  const top = new Color(S.top)
  const foot = new Color(S.foot)
  const colour = new Color()
  const positions: number[] = []
  const colours: number[] = []
  let ring = 0
  for (let s = 0; s < steps; s++) {
    const angle = (s / steps) * Math.PI * 2
    const loop = section(crownHeightAt(angle, S), S, arc, side)
    ring = loop.length
    for (const [dr, y] of loop) {
      const r = S.radius * (1 + S.flare * y) + dr
      positions.push(Math.sin(angle) * r, y, Math.cos(angle) * r)
      colour.copy(foot).lerp(top, Math.min(1, Math.max(0, y / S.peak)))
      colours.push(colour.r, colour.g, colour.b)
    }
  }
  const index: number[] = []
  for (let s = 0; s < steps; s++) {
    const next = (s + 1) % steps
    for (let k = 0; k < ring; k++) {
      const k2 = (k + 1) % ring
      const a = s * ring + k
      const b = next * ring + k
      const c = next * ring + k2
      const d = s * ring + k2
      index.push(a, b, d, b, c, d)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3))
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}
