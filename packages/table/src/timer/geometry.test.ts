import { describe, expect, it } from "vitest"
import { coneGeometry, FRAME, funnelGeometry, glassGeometry, plateGeometry, relight, ringGeometry } from "./geometry"

const colorsOf = (geometry: ReturnType<typeof plateGeometry>) => Array.from(geometry.getAttribute("color").array)

/** The brightest and the darkest grey a solid is lit with, and the vertices that carry them */
function extremes(geometry: ReturnType<typeof plateGeometry>) {
  const grey = Array.from({ length: geometry.getAttribute("color").count }, (_, i) => geometry.getAttribute("color").getX(i))
  return { brightest: Math.max(...grey), darkest: Math.min(...grey), grey }
}

describe("the glass", () => {
  it("is as high as the frame holds it, from its foot to its rim, and no wider than the plates", () => {
    const glass = glassGeometry()
    glass.computeBoundingBox()
    const box = glass.boundingBox!
    expect(box.min.y).toBeCloseTo(0.075, 2)
    expect(box.max.y).toBeCloseTo(0.925, 2)
    expect(box.max.x).toBeLessThan(FRAME.plate)
    expect(box.min.x).toBeGreaterThan(-FRAME.plate)
  })

  it("has a neck narrower than its bulbs, in the middle", () => {
    const glass = glassGeometry()
    const position = glass.getAttribute("position")
    const radiusAt = (height: number) => {
      let widest = 0
      for (let i = 0; i < position.count; i++) if (Math.abs(position.getY(i) - height) < 0.01) widest = Math.max(widest, Math.hypot(position.getX(i), position.getZ(i)))
      return widest
    }
    expect(radiusAt(0.5)).toBeLessThan(0.06)
    expect(radiusAt(0.25)).toBeGreaterThan(0.3)
    expect(radiusAt(0.75)).toBeGreaterThan(0.3)
  })
})

describe("the ring that tops the frame", () => {
  it("is open: nothing of it lies inside its hole", () => {
    const ring = ringGeometry(FRAME.plate, FRAME.hole, FRAME.thickness)
    const position = ring.getAttribute("position")
    let nearest = Infinity
    for (let i = 0; i < position.count; i++) nearest = Math.min(nearest, Math.hypot(position.getX(i), position.getZ(i)))
    expect(nearest).toBeCloseTo(FRAME.hole, 3)
  })

  it("leaves the mouth of the glass uncovered: its hole is as wide as the glass is at its rim", () => {
    const glass = glassGeometry()
    glass.computeBoundingBox()
    const position = glass.getAttribute("position")
    let rim = 0
    for (let i = 0; i < position.count; i++) if (position.getY(i) > glass.boundingBox!.max.y - 0.001) rim = Math.max(rim, Math.hypot(position.getX(i), position.getZ(i)))
    expect(rim).toBeGreaterThan(0.2)
    expect(FRAME.hole).toBeGreaterThanOrEqual(rim)
  })
})

describe("the sand", () => {
  it("has its point at the bottom for the top bulb and at the top for the bottom one", () => {
    const widthAt = (geometry: ReturnType<typeof coneGeometry>, height: number) => {
      const position = geometry.getAttribute("position")
      let widest = 0
      for (let i = 0; i < position.count; i++) if (Math.abs(position.getY(i) - height) < 0.01) widest = Math.max(widest, Math.hypot(position.getX(i), position.getZ(i)))
      return widest
    }
    expect(widthAt(coneGeometry(), 0.5)).toBeLessThan(0.05)
    expect(widthAt(coneGeometry(), -0.5)).toBeCloseTo(1, 2)
    expect(widthAt(funnelGeometry(), -0.5)).toBeLessThan(0.05)
    expect(widthAt(funnelGeometry(), 0.5)).toBeCloseTo(1, 2)
  })
})

describe("the light the solids carry", () => {
  it("is brighter on what faces up than on what faces down", () => {
    const plate = plateGeometry(FRAME.plate, FRAME.thickness)
    const normal = plate.getAttribute("normal")
    const color = plate.getAttribute("color")
    let up = 0
    let down = 0
    for (let i = 0; i < normal.count; i++) {
      if (normal.getY(i) > 0.99) up = Math.max(up, color.getX(i))
      if (normal.getY(i) < -0.99) down = Math.max(down, color.getX(i))
    }
    expect(up).toBeGreaterThan(down)
  })

  it("is lit again for the way a glass turned over faces: the top of a plate that is upside down is the dark one", () => {
    const plate = plateGeometry(FRAME.plate, FRAME.thickness)
    const standing = extremes(plate)
    relight(plate, Math.PI)
    const turned = extremes(plate)
    const normal = plate.getAttribute("normal")
    // The cap that faced up is dark now, and the one that faced down is bright
    for (let i = 0; i < normal.count; i++) {
      if (normal.getY(i) > 0.99) expect(turned.grey[i]).toBeCloseTo(standing.darkest, 1)
      if (normal.getY(i) < -0.99) expect(turned.grey[i]).toBeGreaterThan(standing.darkest + 0.2)
    }
  })

  it("goes back to what it was made with when the glass stands again", () => {
    const plate = plateGeometry(FRAME.plate, FRAME.thickness)
    const made = colorsOf(plate)
    relight(plate, Math.PI / 2)
    expect(colorsOf(plate)).not.toEqual(made)
    relight(plate, 0)
    colorsOf(plate).forEach((value, i) => expect(value).toBeCloseTo(made[i]!, 6))
  })

  it("is the same for a turn of a half turn and for its mirror, since the frame is the same upside down", () => {
    // A solid made symmetrical about its middle looks the same upside down: the plate, lit for a half turn, has the brightness of its own underside
    const a = plateGeometry(FRAME.plate, FRAME.thickness)
    const b = plateGeometry(FRAME.plate, FRAME.thickness)
    relight(a, Math.PI)
    relight(b, -Math.PI)
    colorsOf(a).forEach((value, i) => expect(value).toBeCloseTo(colorsOf(b)[i]!, 5))
  })
})
