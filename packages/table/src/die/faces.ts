import { Vector3 } from "three"

/**
 * The side each number of a six-sided die is on, in the die's own frame, by number: `D6_NORMALS[value - 1]` is the direction the face of that number looks at. Opposite faces add up to seven (1 and 6, 2 and 5, 3 and 4), and
 * 1, 2, 3 run counterclockwise round their corner, as on a western die. With the die in its own frame, 1 looks up, 2 toward the viewer and 3 to the right.
 */
export const D6_NORMALS: readonly Readonly<Vector3>[] = [
  new Vector3(0, 1, 0),
  new Vector3(0, 0, 1),
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 0, -1),
  new Vector3(0, -1, 0),
]

/**
 * Where the pips of a number sit on its face, as [x, y] in the unit square (y down, as on a canvas). The usual layout: one in the middle, two and three on a diagonal, four in the corners, five with the middle one, six in two
 * columns. A number outside 1 to 6 is read as the nearest.
 */
export function pipPositions(value: number): [number, number][] {
  const near = 0.27
  const far = 0.73
  const mid = 0.5
  const count = Number.isFinite(value) ? Math.min(6, Math.max(1, Math.round(value))) : 1
  switch (count) {
    case 1:
      return [[mid, mid]]
    case 2:
      return [
        [near, near],
        [far, far],
      ]
    case 3:
      return [
        [near, near],
        [mid, mid],
        [far, far],
      ]
    case 4:
      return [
        [near, near],
        [far, near],
        [near, far],
        [far, far],
      ]
    case 5:
      return [
        [near, near],
        [far, near],
        [mid, mid],
        [near, far],
        [far, far],
      ]
    default:
      return [
        [near, near],
        [near, mid],
        [near, far],
        [far, near],
        [far, mid],
        [far, far],
      ]
  }
}
