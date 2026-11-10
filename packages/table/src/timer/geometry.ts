import { BufferGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, LatheGeometry, Quaternion, SplineCurve, Vector2, Vector3 } from "three"
import { litGeometry as lit, shadeVertices } from "../die/shade"

/**
 * The glass of an hourglass at the unit height, as [radius, height] from its foot, up: a round bulb, a neck, a round bulb. It has no ends, since the plates of the frame close it. The sand is inside it and the glass is drawn over the sand, translucent.
 */
export const GLASS_PROFILE: readonly (readonly [number, number])[] = [
  [0.26, 0.075],
  [0.335, 0.13],
  [0.355, 0.22],
  [0.32, 0.34],
  [0.17, 0.44],
  [0.045, 0.49],
  [0.032, 0.5],
  [0.045, 0.51],
  [0.17, 0.56],
  [0.32, 0.66],
  [0.355, 0.78],
  [0.335, 0.87],
  [0.26, 0.925],
]

const SEGMENTS = 40
/** How many steps the curve through the points of the profile is cut into: enough that the bulbs are round and not cut in facets */
const CURVE_STEPS = 60
const UP = new Quaternion()

/** The glass of the hourglass, turned on a lathe, at the unit height: its profile is the curve that goes through the points of `GLASS_PROFILE` */
export function glassGeometry(): BufferGeometry {
  const curve = new SplineCurve(GLASS_PROFILE.map(([radius, height]) => new Vector2(radius, height)))
  return new LatheGeometry(curve.getPoints(CURVE_STEPS), SEGMENTS)
}

/** The way an hourglass turns over: about the axis that points at the viewer, so that it turns in the picture, end over end, and shows the whole of itself as it goes */
const DEPTH = new Vector3(0, 0, 1)

/**
 * Lights the solids of an hourglass again for the angle it is turned by, in radians about the axis that points at the viewer. The solids carry their light with them (`lit`), so a glass that turns over would carry it upside down: while it turns, each frame
 * lights them for the way they face now, as a die is lit as it rolls, and at 0 they are lit as they were made.
 */
export function relight(geometry: BufferGeometry, angle: number): void {
  const colors = geometry.getAttribute("color") as Float32BufferAttribute
  shadeVertices(geometry.getAttribute("normal").array, UP.setFromAxisAngle(DEPTH, angle), colors.array as Float32Array)
  colors.needsUpdate = true
}

/** A cone of radius 1 and height 1 standing on its base, centred, lit: the sand of the bottom bulb is this, stretched */
export const coneGeometry = (): BufferGeometry => lit(new ConeGeometry(1, 1, 32))

/** The same cone upside down, its point at the bottom and its wide face up, lit for the way it stands: the sand of the top bulb, a funnel that ends at the neck */
export const funnelGeometry = (): BufferGeometry => lit(new ConeGeometry(1, 1, 32).rotateX(Math.PI))

/** A thin cylinder of height 1 and radius `radius`, centred, lit: the stream of sand, and the posts of the frame */
export const rodGeometry = (radius: number): BufferGeometry => lit(new CylinderGeometry(radius, radius, 1, 12))

/** A disc of radius `radius` and height `thickness`, centred, lit: the plates of the frame at the two ends of the glass */
export const plateGeometry = (radius: number, thickness: number): BufferGeometry => lit(new CylinderGeometry(radius, radius, thickness, 40))

/** A flat ring of outer radius `outer`, inner radius `inner` and height `thickness`, centred, lit: the top of the frame, which is open so that the sand can be seen from above */
export const ringGeometry = (outer: number, inner: number, thickness: number): BufferGeometry =>
  lit(
    new LatheGeometry(
      [
        new Vector2(inner, -thickness / 2),
        new Vector2(outer, -thickness / 2),
        new Vector2(outer, thickness / 2),
        new Vector2(inner, thickness / 2),
        new Vector2(inner, -thickness / 2),
      ],
      40,
    ),
  )

/** Where the three posts of the frame stand, as [x, z] round the glass, and how far out and how long they are, in the unit height */
export const POSTS: readonly (readonly [number, number])[] = [0, 1, 2].map((i) => [0.385 * Math.cos((2 * Math.PI * i) / 3), 0.385 * Math.sin((2 * Math.PI * i) / 3)] as const)
export const FRAME = { plate: 0.43, hole: 0.27, thickness: 0.07, bottom: 0.035, top: 0.965, post: 0.016 }
