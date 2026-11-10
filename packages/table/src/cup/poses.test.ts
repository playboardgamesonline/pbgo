import { Euler, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { CUP_HEIGHT } from "./geometry"
import { CUP_POSES, cupClearance, cupMouth, cupTarget, rattle } from "./poses"

describe("cupTarget", () => {
  const size = 2
  const [radius, height] = [size / 2, CUP_HEIGHT * size]

  it("has the cup stand on its mouth over what it hides: the middle of its mouth is on the table where it stands", () => {
    expect(cupTarget("covering", size)).toEqual({ x: 0, y: 0, z: 0, rx: 0, rz: 0 })
  })

  it("has the cup stand on its base with its mouth up: the mouth is as high as the cup", () => {
    const rest = cupTarget("rest", size)
    expect(rest.rx).toBeCloseTo(Math.PI, 12)
    expect(rest.y).toBeCloseTo(height, 12)
  })

  it("tilts the cup about the far edge of its rim, which stays where it was on the table", () => {
    const peek = cupTarget("peeking", size)
    // The far edge of the rim, in the frame of the cup, turned and moved
    const far = new Vector3(0, 0, -radius).applyEuler(new Euler(peek.rx, 0, peek.rz)).add(new Vector3(peek.x, peek.y, peek.z))
    expect(far.x).toBeCloseTo(0, 12)
    expect(far.y).toBeCloseTo(0, 12)
    expect(far.z).toBeCloseTo(-radius, 12)
    // The near edge is up
    const near = new Vector3(0, 0, radius).applyEuler(new Euler(peek.rx, 0, peek.rz)).add(new Vector3(peek.x, peek.y, peek.z))
    expect(near.y).toBeGreaterThan(radius * 0.8)
  })

  it("has the cup lifted away from its owner, toward the middle of the table, and higher than it is tall, so that what was under it shows", () => {
    const lifted = cupTarget("lifted", size)
    expect(lifted.y).toBeGreaterThan(height)
    expect(lifted.z).toBeLessThan(-size)
  })

  it("holds the cup up, mouth up, to shake it", () => {
    const shaking = cupTarget("shaking", size)
    expect(shaking.rx).toBeCloseTo(Math.PI, 12)
    expect(shaking.y).toBeGreaterThan(1.5 * height)
  })

  it("tips the cup past a quarter turn from its mouth up, so that its mouth looks away from its owner and down", () => {
    const pouring = cupTarget("pouring", size)
    // The way the mouth looks: opposite the axis from the mouth to the base
    const mouth = new Vector3(0, -1, 0).applyEuler(new Euler(pouring.rx, 0, pouring.rz))
    expect(mouth.z).toBeLessThan(-0.5)
    expect(mouth.y).toBeLessThan(0)
  })

  it("scales with the size of the cup", () => {
    for (const pose of CUP_POSES) {
      const [small, big] = [cupTarget(pose, 1), cupTarget(pose, 3)]
      expect(big.x).toBeCloseTo(small.x * 3, 9)
      expect(big.y).toBeCloseTo(small.y * 3, 9)
      expect(big.z).toBeCloseTo(small.z * 3, 9)
      expect(big.rx).toBe(small.rx)
      expect(big.rz).toBe(small.rz)
    }
  })

  it("never asks for a cup below the table: the height of every pose is at least what its turn needs", () => {
    for (const pose of CUP_POSES) {
      const target = cupTarget(pose, size)
      expect(target.y + 1e-9, pose).toBeGreaterThanOrEqual(cupClearance(target.rx, target.rz, size))
    }
  })
})

describe("cupClearance", () => {
  const size = 2
  const [radius, height] = [size / 2, CUP_HEIGHT * size]

  it("asks nothing of a cup that stands on its mouth, its height of one on its base and its radius of one on its side", () => {
    expect(cupClearance(0, 0, size)).toBeCloseTo(0, 12)
    expect(cupClearance(Math.PI, 0, size)).toBeCloseTo(height, 12)
    expect(cupClearance(Math.PI / 2, 0, size)).toBeCloseTo(radius, 12)
    expect(cupClearance(-Math.PI / 2, 0, size)).toBeCloseTo(radius, 12)
  })

  it("is the height at which no point of the cup is under the table, whatever the way it is turned", () => {
    // The rim and the base are circles: the cup is as low as the lowest point of either
    const lowest = (rx: number, rz: number, y: number) => {
      const turn = new Euler(rx, 0, rz)
      let least = Number.POSITIVE_INFINITY
      for (const along of [0, height]) {
        for (let k = 0; k < 360; k++) {
          const angle = (k / 360) * Math.PI * 2
          const point = new Vector3(Math.cos(angle) * radius, along, Math.sin(angle) * radius).applyEuler(turn)
          least = Math.min(least, y + point.y)
        }
      }
      return least
    }
    for (const rx of [-2.6, -1.2, -0.4, 0, 0.5, 0.96, 1.6, 2.4, Math.PI]) {
      for (const rz of [-0.5, 0, 0.3]) {
        const clearance = cupClearance(rx, rz, size)
        // At the clearance the lowest point touches the table, and not under it
        expect(lowest(rx, rz, clearance), `${rx} ${rz}`).toBeGreaterThan(-1e-3)
        expect(lowest(rx, rz, clearance), `${rx} ${rz}`).toBeLessThan(0.02)
      }
    }
  })

  it("grows with the size of the cup", () => {
    expect(cupClearance(1, 0.2, 3)).toBeCloseTo(cupClearance(1, 0.2, 1) * 3, 9)
  })
})

describe("cupMouth", () => {
  it("is the place of the cup when it stands on its mouth", () => {
    expect(cupMouth({ x: 3, z: -2 }, "covering", 1.8)).toEqual([3, 0, -2])
  })

  it("is above the table by the height of the cup when its mouth is up on the table", () => {
    const [, y] = cupMouth({ x: 0, z: 0 }, "rest", 2)
    expect(y).toBeCloseTo(CUP_HEIGHT * 2, 12)
  })

  it("turns with the yaw of the place: what is toward the owner is toward the seat", () => {
    const front = cupMouth({ x: 0, z: 0, yaw: 0 }, "peeking", 2)
    const turned = cupMouth({ x: 0, z: 0, yaw: Math.PI }, "peeking", 2)
    expect(turned[0]).toBeCloseTo(-front[0], 12)
    expect(turned[2]).toBeCloseTo(-front[2], 12)
    expect(turned[1]).toBeCloseTo(front[1], 12)
  })

  it("moves the mouth of a cup that is lifted away from its owner, toward the middle of the table, whichever way the seat faces", () => {
    // Away from the owner is -z of the frame: a seat turned a quarter turn sends it to -x in the world, and one turned the other way to +x
    expect(cupMouth({ x: 0, z: 0, yaw: Math.PI / 2 }, "lifted", 2)[0]).toBeLessThan(-1.5)
    expect(cupMouth({ x: 0, z: 0, yaw: -Math.PI / 2 }, "lifted", 2)[0]).toBeGreaterThan(1.5)
  })

  it("is never below the table, whatever the pose", () => {
    for (const pose of CUP_POSES) expect(cupMouth({ x: 0, z: 0 }, pose, 1.8)[1]).toBeGreaterThanOrEqual(0)
  })
})

describe("rattle", () => {
  it("stays within the amplitude, sideways, up and down and tilted", () => {
    for (let t = 0; t < 2; t += 0.013) {
      const r = rattle(t, 2, 0.05, 9)
      expect(Math.abs(r.x)).toBeLessThanOrEqual(0.1 + 1e-12)
      expect(Math.abs(r.y)).toBeLessThanOrEqual(0.08 + 1e-12)
      expect(Math.abs(r.z)).toBeLessThanOrEqual(0.06 + 1e-12)
      expect(Math.abs(r.rz)).toBeLessThanOrEqual(0.11 + 1e-12)
    }
  })

  it("comes back to where it was after a rattle, as often as it is told", () => {
    const [a, b] = [rattle(0.31, 1.8, 0.05, 9), rattle(0.31 + 1 / 9, 1.8, 0.05, 9)]
    expect(b.x).toBeCloseTo(a.x, 9)
    expect(b.y).toBeCloseTo(a.y, 9)
    expect(b.z).toBeCloseTo(a.z, 9)
    expect(b.rz).toBeCloseTo(a.rz, 9)
  })

  it("does not move a cup that is told not to rattle", () => {
    expect(rattle(1.234, 2, 0, 9)).toEqual({ x: 0, y: 0, z: 0, rz: 0 })
  })

  it("is the same every time for the same moment: every player sees the same shake", () => {
    expect(rattle(0.77, 2, 0.05, 9)).toEqual(rattle(0.77, 2, 0.05, 9))
  })
})
