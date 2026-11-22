import { describe, expect, it } from "vitest"
import { NO_TOUCH } from "../card/states"
import { TEXT_PX } from "../seat/text-px"
import { ARROW, arrowOffset, arrowOutline, BOB, fitHeight, LABEL_GAP, LABEL_HEIGHT, LABEL_ROOM, labelColour, labelPlan, labelScale, pointerTouch, touchOf } from "./label-look"

describe("how large the lettering is", () => {
  it("is the size asked for when the word fits the room", () => {
    // a word as wide as two letter heights
    expect(fitHeight(2 * TEXT_PX, 3, 0.55)).toBe(0.55)
  })

  it("is smaller when the word is long, so that it takes the room and no more", () => {
    const height = fitHeight(20 * TEXT_PX, 3, 0.55)
    expect(height).toBeLessThan(0.55)
    expect((20 * TEXT_PX * height) / TEXT_PX).toBeCloseTo(3)
  })

  it("is never nothing, whatever the room or the word", () => {
    expect(fitHeight(0, 3, 0.55)).toBe(0.55)
    expect(fitHeight(100 * TEXT_PX, 0, 0.55)).toBeGreaterThan(0)
  })
})

describe("the plan of a label", () => {
  it("hangs the lettering away from the object, past the arrow and a gap", () => {
    const plan = labelPlan(4 * TEXT_PX, LABEL_ROOM)
    expect(plan.letteringZ).toBeLessThan(-(ARROW.length + LABEL_GAP.lettering))
  })

  it("takes the room at most, whatever the word", () => {
    for (const letters of [1, 4, 16, 40]) expect(labelPlan(letters * 0.6 * TEXT_PX, LABEL_ROOM).width).toBeLessThanOrEqual(LABEL_ROOM + 1e-9)
  })

  it("draws the lettering at the size asked for when it fits", () => {
    expect(labelPlan(2 * TEXT_PX, LABEL_ROOM).height).toBe(LABEL_HEIGHT)
    expect(labelPlan(2 * TEXT_PX, LABEL_ROOM, 0.4).height).toBe(0.4)
  })

  it("reaches the whole label with the pointer: the arrow, the lettering and a margin round them", () => {
    for (const letters of [1, 6, 30]) {
      const plan = labelPlan(letters * 0.6 * TEXT_PX, LABEL_ROOM)
      const { hit } = plan
      const near = hit.z + hit.depth / 2
      const far = hit.z - hit.depth / 2
      expect(far).toBeLessThan(plan.letteringZ - (0.4 * plan.height))
      expect(near).toBeGreaterThan(0)
      expect(hit.width).toBeGreaterThanOrEqual(Math.max(plan.width, ARROW.width))
    }
  })

  it("never reaches the object it names: the pointer stops short of its edge", () => {
    const { hit } = labelPlan(4 * TEXT_PX, LABEL_ROOM)
    // the origin is the tip, which is a gap away from the object's edge
    expect(hit.z + hit.depth / 2).toBeLessThan(LABEL_GAP.tip)
  })

  it("is centred across the table, on the object", () => {
    expect(labelPlan(4 * TEXT_PX, LABEL_ROOM).hit.x).toBe(0)
  })
})

describe("what the pointer does to a label", () => {
  it("is NO_TOUCH itself while it does nothing, so that nothing is told of a change that is none", () => {
    expect(pointerTouch(false, false)).toBe(NO_TOUCH)
  })

  it("is hovered, then pressed, with no keyboard focus: the label has no key of its own", () => {
    expect(pointerTouch(true, false)).toEqual({ hovered: true, focused: false, pressed: false })
    expect(pointerTouch(true, true)).toEqual({ hovered: true, focused: false, pressed: true })
  })
})

describe("what is done to a label", () => {
  it("is what its own pointer does, or what is done to the object it names", () => {
    expect(touchOf(NO_TOUCH, NO_TOUCH)).toEqual(NO_TOUCH)
    expect(touchOf({ hovered: true, focused: false, pressed: false }, NO_TOUCH)).toEqual({ hovered: true, focused: false, pressed: false })
    expect(touchOf(NO_TOUCH, { hovered: true, focused: false, pressed: true })).toEqual({ hovered: true, focused: false, pressed: true })
    expect(touchOf({ hovered: false, focused: true, pressed: false }, { hovered: true, focused: false, pressed: false })).toEqual({ hovered: true, focused: true, pressed: false })
  })
})

describe("the colour of a label", () => {
  const ACCENT = "#4aa8f0"
  const HOVER = "#7fc4ff"

  it("is the colour of the object's bloom, lightened, at rest", () => {
    const at = labelColour(ACCENT, HOVER, 0)
    expect(at).not.toBe(ACCENT)
    // lightened: every channel is at least the accent's
    for (const i of [1, 3, 5]) expect(parseInt(at.slice(i, i + 2), 16)).toBeGreaterThanOrEqual(parseInt(ACCENT.slice(i, i + 2), 16))
  })

  it("is lighter when lifted than at rest, and in between half way", () => {
    const light = (hex: string) => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0)
    expect(light(labelColour(ACCENT, HOVER, 1))).toBeGreaterThan(light(labelColour(ACCENT, HOVER, 0)))
    expect(light(labelColour(ACCENT, HOVER, 0.5))).toBeGreaterThan(light(labelColour(ACCENT, HOVER, 0)))
    expect(light(labelColour(ACCENT, HOVER, 0.5))).toBeLessThan(light(labelColour(ACCENT, HOVER, 1)))
  })

  it("holds a lift outside 0 to 1 at its ends", () => {
    expect(labelColour(ACCENT, HOVER, 7)).toBe(labelColour(ACCENT, HOVER, 1))
    expect(labelColour(ACCENT, HOVER, -3)).toBe(labelColour(ACCENT, HOVER, 0))
  })

  it("is a dim grey once disabled, whatever the lift", () => {
    expect(labelColour(ACCENT, HOVER, 1, true)).toBe(labelColour(ACCENT, HOVER, 0, true))
    expect(labelColour(ACCENT, HOVER, 0, true)).not.toBe(labelColour(ACCENT, HOVER, 0))
  })

  it("is always #rrggbb", () => {
    for (const lift of [0, 0.4, 1]) expect(labelColour(ACCENT, HOVER, lift)).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe("how the arrow moves", () => {
  it("bobs toward the object and back at rest, never away from its place and never past its reach", () => {
    for (let t = 0; t < 8; t += 0.05) {
      const offset = arrowOffset(t, 0, false)
      expect(offset).toBeGreaterThanOrEqual(0)
      expect(offset).toBeLessThanOrEqual(BOB.reach + 1e-9)
    }
  })

  it("covers the whole of its reach over a bob", () => {
    const offsets = Array.from({ length: 400 }, (_, i) => arrowOffset(i * 0.02, 0, false))
    expect(Math.max(...offsets)).toBeCloseTo(BOB.reach, 2)
    expect(Math.min(...offsets)).toBeCloseTo(0, 2)
  })

  it("settles at its reach once lifted, whenever it is looked at", () => {
    for (const t of [0, 0.7, 3.1]) expect(arrowOffset(t, 1, false)).toBeCloseTo(BOB.reach)
  })

  it("never bobs with reduced motion: in its place at rest, at its reach when lifted", () => {
    for (const t of [0, 0.7, 3.1]) {
      expect(arrowOffset(t, 0, true)).toBe(0)
      expect(arrowOffset(t, 1, true)).toBe(BOB.reach)
    }
  })

  it("stays clear of the object: the bob is shorter than the gap between the tip and the object", () => {
    expect(BOB.reach).toBeLessThan(LABEL_GAP.tip)
  })
})

describe("how large the label is", () => {
  it("grows into place as it appears, and is its own size when it has", () => {
    expect(labelScale(0, 0)).toBeLessThan(labelScale(0.5, 0))
    expect(labelScale(0.5, 0)).toBeLessThan(labelScale(1, 0))
    expect(labelScale(1, 0)).toBe(1)
  })

  it("grows a little as it lifts", () => {
    expect(labelScale(1, 1)).toBeGreaterThan(1)
    expect(labelScale(1, 1)).toBeLessThan(1.2)
  })

  it("is never nothing, even when it has not begun to appear", () => {
    expect(labelScale(-1, 0)).toBeGreaterThan(0.5)
  })
})

describe("the outline of the arrow", () => {
  const points = arrowOutline()

  it("lies within the arrow's width and length, the tip at the origin", () => {
    for (const [x, y] of points) {
      expect(Math.abs(x)).toBeLessThanOrEqual(ARROW.width / 2 + 1e-9)
      expect(y).toBeGreaterThanOrEqual(-1e-9)
      expect(y).toBeLessThanOrEqual(ARROW.length + 1e-9)
    }
  })

  it("is the same on both sides of the middle", () => {
    for (const [x, y] of points) expect(points.some(([ox, oy]) => Math.abs(ox + x) < 1e-9 && Math.abs(oy - y) < 1e-9)).toBe(true)
  })

  it("has its corners rounded: the tip is cut short and the base is not reached at its ends", () => {
    expect(Math.min(...points.map(([, y]) => y))).toBeGreaterThan(0)
    expect(Math.max(...points.map(([x]) => x))).toBeLessThan(ARROW.width / 2)
  })

  it("is the plain triangle with no rounding", () => {
    expect(arrowOutline(0.4, 0.3, 0)).toEqual([
      [0, 0],
      [0.2, 0.3],
      [-0.2, 0.3],
    ])
  })

  it("rounds a corner by no more than half an edge, however large the radius", () => {
    for (const [x, y] of arrowOutline(0.4, 0.3, 5)) {
      expect(Math.abs(x)).toBeLessThanOrEqual(0.2 + 1e-9)
      expect(y).toBeGreaterThanOrEqual(-1e-9)
      expect(y).toBeLessThanOrEqual(0.3 + 1e-9)
    }
  })
})
