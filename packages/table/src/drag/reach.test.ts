import { PerspectiveCamera, Quaternion, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { dragGoal, pointOnTable, withinReach } from "./reach"

const BOX = { left: 0, top: 0, width: 100, height: 100 }

/** A camera `distance` away along +z and up, looking at the middle of the table, as the table's camera does */
function camera(position: [number, number, number], target: [number, number, number]): PerspectiveCamera {
  const view = new PerspectiveCamera(35, 1, 0.1, 300)
  view.position.set(...position)
  view.lookAt(...target)
  view.updateProjectionMatrix()
  view.updateMatrixWorld()
  return view
}

describe("where the pointer is on the table", () => {
  const view = camera([0, 10, 10], [0, 0, 0])

  it("meets the table where the camera looks, at the middle of the canvas", () => {
    const [x, z] = pointOnTable(view, BOX, 50, 50, 0)!
    expect(x).toBeCloseTo(0, 6)
    expect(z).toBeCloseTo(0, 6)
  })

  it("meets a plane above the table nearer to the camera", () => {
    const [x, z] = pointOnTable(view, BOX, 50, 50, 1)!
    expect(x).toBeCloseTo(0, 6)
    // The ray goes down by one for each step away: at one above the table it is one step nearer
    expect(z).toBeCloseTo(1, 6)
  })

  it("puts the right of the canvas at +x and the bottom of it toward the viewer", () => {
    const right = pointOnTable(view, BOX, 90, 50, 0)!
    const left = pointOnTable(view, BOX, 10, 50, 0)!
    const bottom = pointOnTable(view, BOX, 50, 90, 0)!
    const top = pointOnTable(view, BOX, 50, 10, 0)!
    expect(right[0]).toBeGreaterThan(0)
    expect(left[0]).toBeLessThan(0)
    expect(left[0]).toBeCloseTo(-right[0], 6)
    expect(bottom[1]).toBeGreaterThan(top[1])
  })

  it("reads the pointer from the box of the canvas on the page, not from the page", () => {
    const moved = { left: 300, top: 200, width: 100, height: 100 }
    const [x, z] = pointOnTable(view, moved, 350, 250, 0)!
    expect(x).toBeCloseTo(0, 6)
    expect(z).toBeCloseTo(0, 6)
    const scaled = { left: 0, top: 0, width: 400, height: 400 }
    const [sx, sz] = pointOnTable(view, scaled, 360, 200, 0)!
    const [ex, ez] = pointOnTable(view, BOX, 90, 50, 0)!
    expect(sx).toBeCloseTo(ex, 6)
    expect(sz).toBeCloseTo(ez, 6)
  })

  it("finds nothing above the horizon, or in a canvas with no size", () => {
    const level = camera([0, 2, 10], [0, 2, 0])
    expect(pointOnTable(level, BOX, 50, 5, 0)).toBeNull()
    expect(pointOnTable(level, BOX, 50, 95, 0)).not.toBeNull()
    expect(pointOnTable(view, { left: 0, top: 0, width: 0, height: 100 }, 0, 0, 0)).toBeNull()
  })
})

describe("how far a drag may go", () => {
  it("leaves a point that is near", () => {
    const point = [3, 4] as const
    expect(withinReach(point, 10)).toBe(point)
  })

  it("brings a point that is far to the circle, the way it was from the middle", () => {
    const [x, z] = withinReach([30, 40], 10)
    expect(x).toBeCloseTo(6, 10)
    expect(z).toBeCloseTo(8, 10)
  })
})

describe("the pose of a dragged thing", () => {
  it("lifts it above its place, under the pointer, as it was turned and a little bigger", () => {
    const home = { position: new Vector3(1, 0.03, 2), quaternion: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.4), scale: 1 }
    const out = { position: new Vector3(), quaternion: new Quaternion(), scale: 1 }
    expect(dragGoal(out, home, 5, -3, 0.5, 1.1)).toBe(out)
    expect(out.position.toArray()).toEqual([5, 0.53, -3])
    expect(out.quaternion.equals(home.quaternion)).toBe(true)
    expect(out.quaternion).not.toBe(home.quaternion)
    expect(out.scale).toBeCloseTo(1.1, 10)
    // Its place is left alone
    expect(home.position.toArray()).toEqual([1, 0.03, 2])
  })
})
