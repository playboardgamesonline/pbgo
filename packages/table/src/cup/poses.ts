import { CUP_HEIGHT } from "./geometry"

/**
 * What a cup can be doing. It stands on the table with its mouth down over what it hides (`covering`), tilts to let its owner look under it (`peeking`), is lifted away and aside to show what was under it (`lifted`), is held up and rattled with the dice
 * inside it (`shaking`), stands with its mouth up on the table (`rest`), and is tipped over to pour them out (`pouring`).
 */
export const CUP_POSES = ["covering", "peeking", "lifted", "shaking", "rest", "pouring"] as const
export type CupPose = (typeof CUP_POSES)[number]

/**
 * Where a cup goes to be in a pose, in the frame of the place it stands at (x to the right, z toward its owner, y up). It is where the middle of its mouth is, and how it is turned: `rx` about the x axis (0 has the mouth down, half a turn the mouth up,
 * and a quarter turn the cup lying on its side), `rz` about the z axis.
 */
export type CupTarget = { x: number; y: number; z: number; rx: number; rz: number }

/** How far a cup tilts to be looked under, in radians */
const PEEK = 0.66
/** How far it tips to pour: past a quarter turn from its mouth up, so that the mouth looks away from its owner and down */
const POUR = 0.96

/** The target of a pose for a cup `size` wide across its mouth. The height is the least that keeps the cup above the table, or what the pose asks for if that is more (`cupClearance`) */
export function cupTarget(pose: CupPose, size: number): CupTarget {
  const [radius, height] = [size / 2, CUP_HEIGHT * size]
  switch (pose) {
    case "covering":
      return { x: 0, y: 0, z: 0, rx: 0, rz: 0 }
    case "peeking":
      // It turns about the far edge of its rim: the near edge goes up, and the middle of the mouth with it
      return { x: 0, y: radius * Math.sin(PEEK), z: radius * (Math.cos(PEEK) - 1), rx: -PEEK, rz: 0 }
    case "lifted":
      // Away from its owner, toward the middle of the table, so that the dice show to everyone at it
      return { x: 0.3 * size, y: 1.1 * height, z: -1.15 * size, rx: -0.3, rz: -0.12 }
    case "shaking":
      return { x: 0, y: 1.7 * height, z: 0.15 * size, rx: Math.PI, rz: 0 }
    case "rest":
      return { x: 0, y: height, z: 0, rx: Math.PI, rz: 0 }
    case "pouring":
      return { x: 0, y: 1.5 * height, z: -0.55 * size, rx: POUR, rz: 0 }
  }
}

/**
 * How high the middle of the mouth has to be for a cup turned by `rx` and `rz` not to sink into the table: its rim and its base are circles, and the lowest point of the lower of them sets it. A cup standing on its mouth needs nothing, one on its base
 * needs its height, and one on its side or tilted needs what its radius sets. The cup is lifted to it while it turns, so a cup that flips never goes through the table.
 */
export function cupClearance(rx: number, rz: number, size: number): number {
  const [radius, height] = [size / 2, CUP_HEIGHT * size]
  // The way its axis, from the mouth to the base, points: up when it is 1
  const up = Math.cos(rz) * Math.cos(rx)
  const slope = Math.sqrt(Math.max(0, 1 - up * up))
  return radius * slope + Math.max(0, -height * up)
}

/** The middle of the mouth of a cup in a pose, on the table: where dice that are poured from it start, and what a game lays under a cup that is lifted. A place with a `yaw` turns the frame of the cup */
export function cupMouth(at: { x: number; z: number; yaw?: number }, pose: CupPose, size: number): [x: number, y: number, z: number] {
  const target = cupTarget(pose, size)
  const [sin, cos] = [Math.sin(at.yaw ?? 0), Math.cos(at.yaw ?? 0)]
  return [at.x + target.x * cos + target.z * sin, Math.max(target.y, cupClearance(target.rx, target.rz, size)), at.z - target.x * sin + target.z * cos]
}

/** How a cup that is shaken moves at the time `t` (seconds): a few rattles a second, a little sideways, a little up and down, a little tilted, in widths of the cup. `amplitude` is how far, in widths, and `hertz` how often */
export function rattle(t: number, size: number, amplitude: number, hertz: number): { x: number; y: number; z: number; rz: number } {
  const turn = 2 * Math.PI * hertz * t
  return {
    x: amplitude * size * Math.sin(turn),
    y: amplitude * size * 0.8 * Math.sin(2 * turn + 0.7),
    z: amplitude * size * 0.6 * Math.sin(turn + 1.3),
    rz: amplitude * 2.2 * Math.sin(turn + 0.4),
  }
}
