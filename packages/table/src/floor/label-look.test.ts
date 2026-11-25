import { describe, expect, it } from "vitest"
import { NO_TOUCH } from "../card/states"
import { LETTERING_WEIGHT } from "../lettering"
import { LINE_PITCH, TEXT_PX } from "../seat/text-px"
import {
  ARROW,
  arrowOffset,
  arrowOutline,
  BOB,
  fitHeight,
  LABEL_GAP,
  LABEL_HEIGHT,
  LABEL_OPACITY,
  LABEL_ROOM,
  LABEL_WEIGHT,
  LABEL_MIN_PX,
  labelColour,
  labelOpacity,
  labelPlan,
  labelScale,
  lettersPixels,
  linePixels,
  pointerTouch,
  reachAlong,
  readableBoost,
  touchOf,
  unitPixels,
} from "./label-look"

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

  it("is the size asked for whenever the widest line fits the room, whatever the words: a long label wraps, it is not set smaller", () => {
    // once its words are broken a label's widest line is no wider than the room, so every label is drawn at the same size
    const fits = linePixels(LABEL_ROOM, LABEL_HEIGHT)
    for (const textWidth of [1, 0.2 * fits, 0.6 * fits, fits]) expect(fitHeight(textWidth, LABEL_ROOM, LABEL_HEIGHT)).toBeCloseTo(LABEL_HEIGHT, 10)
  })

  it("is smaller only for a word that is wider than the room by itself, which a label cannot break", () => {
    expect(fitHeight(linePixels(LABEL_ROOM, LABEL_HEIGHT) * 1.5, LABEL_ROOM, LABEL_HEIGHT)).toBeLessThan(LABEL_HEIGHT)
  })
})

describe("how many canvas pixels a line may take", () => {
  it("is the room in the pixels of the lettering at its size", () => {
    // a canvas pixel is `height / TEXT_PX` world units
    expect((linePixels(2.4, 0.3) * 0.3) / TEXT_PX).toBeCloseTo(2.4)
  })

  it("is fewer for taller letters, and never nothing", () => {
    expect(linePixels(2.4, 0.6)).toBeLessThan(linePixels(2.4, 0.3))
    for (const [room, height] of [[0, 0.3], [-1, 0.3], [2.4, 0]] as const) expect(linePixels(room, height)).toBeGreaterThan(0)
  })
})

describe("the plan of a label", () => {
  it("hangs the lettering above the arrow, past its length and a gap", () => {
    const plan = labelPlan(4 * TEXT_PX, LABEL_ROOM)
    expect(plan.letteringY).toBeGreaterThan(ARROW.length + LABEL_GAP.lettering)
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
      const top = hit.y + hit.height / 2
      const bottom = hit.y - hit.height / 2
      expect(top).toBeGreaterThan(plan.letteringY + 0.4 * plan.height)
      expect(bottom).toBeLessThan(0)
      expect(hit.width).toBeGreaterThanOrEqual(Math.max(plan.width, ARROW.width))
    }
  })

  it("never reaches the object it names: the pointer stops short of its far edge", () => {
    const { hit } = labelPlan(4 * TEXT_PX, LABEL_ROOM)
    // the origin is the tip, which is a gap past the far edge of the object
    expect(hit.y - hit.height / 2).toBeGreaterThan(-LABEL_GAP.tip)
  })

  it("is centred across the label, over the object", () => {
    expect(labelPlan(4 * TEXT_PX, LABEL_ROOM).hit.x).toBe(0)
  })

  it("grows upward with its lines, away from the object: the last line stays a gap over the arrow and the others hang above it", () => {
    const one = labelPlan(4 * TEXT_PX, LABEL_ROOM, LABEL_HEIGHT, 1)
    const two = labelPlan(4 * TEXT_PX, LABEL_ROOM, LABEL_HEIGHT, 2)
    const three = labelPlan(4 * TEXT_PX, LABEL_ROOM, LABEL_HEIGHT, 3)
    // the plane of the lettering is centred on its block, so each line added lifts the middle by half a line
    expect(two.letteringY - one.letteringY).toBeCloseTo((LINE_PITCH * LABEL_HEIGHT) / 2)
    expect(three.letteringY - two.letteringY).toBeCloseTo((LINE_PITCH * LABEL_HEIGHT) / 2)
    // the last line, half a block under the middle, stands where the only line of a label of one line does
    expect(two.letteringY - (LINE_PITCH * LABEL_HEIGHT) / 2).toBeCloseTo(one.letteringY)
    expect(three.letteringY - LINE_PITCH * LABEL_HEIGHT).toBeCloseTo(one.letteringY)
  })

  it("is a label of one line when it is given no lines, or none", () => {
    expect(labelPlan(4 * TEXT_PX, LABEL_ROOM)).toEqual(labelPlan(4 * TEXT_PX, LABEL_ROOM, LABEL_HEIGHT, 1))
    expect(labelPlan(4 * TEXT_PX, LABEL_ROOM, LABEL_HEIGHT, 0)).toEqual(labelPlan(4 * TEXT_PX, LABEL_ROOM, LABEL_HEIGHT, 1))
  })

  it("reaches all the lines with the pointer and still stops short of the object, whatever their number", () => {
    for (const lines of [1, 2, 3]) {
      const plan = labelPlan(6 * TEXT_PX, LABEL_ROOM, LABEL_HEIGHT, lines)
      const top = plan.hit.y + plan.hit.height / 2
      const bottom = plan.hit.y - plan.hit.height / 2
      // the middle of the first line is half a block over the middle of the plane, and its capitals reach 0.4 of the size above it
      expect(top).toBeGreaterThan(plan.letteringY + ((lines - 1) * LINE_PITCH * plan.height) / 2 + 0.4 * plan.height)
      expect(bottom).toBeGreaterThan(-LABEL_GAP.tip)
    }
  })

  it("is the same size for a label of two lines as for one: wrapping adds a line, never shrinks the letters", () => {
    expect(labelPlan(5 * TEXT_PX, LABEL_ROOM, LABEL_HEIGHT, 2).height).toBe(labelPlan(TEXT_PX, LABEL_ROOM, LABEL_HEIGHT, 1).height)
  })
})

describe("how far an object reaches from its middle", () => {
  const CARD = { width: 1.2, depth: 1.7 }

  it("is half its depth along the table's z and half its width along x", () => {
    expect(reachAlong(CARD, 0, 1)).toBeCloseTo(0.85)
    expect(reachAlong(CARD, 0, -1)).toBeCloseTo(0.85)
    expect(reachAlong(CARD, 1, 0)).toBeCloseTo(0.6)
  })

  it("swaps them for an object turned a quarter, and keeps them for a half turn", () => {
    expect(reachAlong({ ...CARD, yaw: Math.PI / 2 }, 0, 1)).toBeCloseTo(0.6)
    expect(reachAlong({ ...CARD, yaw: Math.PI / 2 }, 1, 0)).toBeCloseTo(0.85)
    expect(reachAlong({ ...CARD, yaw: Math.PI }, 0, 1)).toBeCloseTo(0.85)
  })

  it("is the farthest of its four corners along the direction, whatever way it is turned and whatever the direction", () => {
    for (let turn = 0; turn < 12; turn++) {
      for (let way = 0; way < 12; way++) {
        const yaw = (turn * Math.PI) / 6
        const dx = Math.sin((way * Math.PI) / 6)
        const dz = Math.cos((way * Math.PI) / 6)
        // the corners of the footprint, turned about the vertical axis by `yaw` (three.js': x goes to (cos, -sin), z to (sin, cos))
        const corners = [
          [-CARD.width / 2, -CARD.depth / 2],
          [CARD.width / 2, -CARD.depth / 2],
          [-CARD.width / 2, CARD.depth / 2],
          [CARD.width / 2, CARD.depth / 2],
        ].map(([x, z]) => [x! * Math.cos(yaw) + z! * Math.sin(yaw), -x! * Math.sin(yaw) + z! * Math.cos(yaw)] as const)
        const farthest = Math.max(...corners.map(([x, z]) => x * dx + z * dz))
        expect(reachAlong({ ...CARD, yaw }, dx, dz)).toBeCloseTo(farthest)
      }
    }
  })

  it("grows with the length of the direction, which is the horizontal part of the camera's up and not a unit vector", () => {
    expect(reachAlong({ ...CARD, yaw: 0.7 }, 0, -0.77)).toBeCloseTo(0.77 * reachAlong({ ...CARD, yaw: 0.7 }, 0, -1))
  })

  it("is nothing for no direction: the up of a camera that looks along the table has no part along the table, so the object reaches no higher up the screen than it is high", () => {
    expect(reachAlong(CARD, 0, 0)).toBe(0)
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

describe("the look of a label", () => {
  const ACCENT = "#4aa8f0"
  const HOVER = "#7fc4ff"
  const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

  it("is nearly white at rest, with only a tint of the object's colour: at most a quarter of the way from white to it", () => {
    const rest = channels(labelColour(ACCENT, HOVER, 0))
    channels(ACCENT).forEach((accent, i) => expect(255 - rest[i]!).toBeLessThanOrEqual(0.25 * (255 - accent)))
  })

  it("is lighter than the lettering of the plates, so that it stays in the background", () => {
    expect(LABEL_WEIGHT).toBeLessThan(LETTERING_WEIGHT)
  })

  it("is a little see-through at rest and opaque under the pointer", () => {
    expect(LABEL_OPACITY.rest).toBeLessThan(1)
    expect(LABEL_OPACITY.raised).toBe(1)
    expect(labelOpacity(0)).toBe(LABEL_OPACITY.rest)
    expect(labelOpacity(1)).toBe(LABEL_OPACITY.raised)
  })

  it("brightens as it lifts, and holds a lift outside 0 to 1 at its ends", () => {
    expect(labelOpacity(0.5)).toBeGreaterThan(labelOpacity(0))
    expect(labelOpacity(0.5)).toBeLessThan(labelOpacity(1))
    expect(labelOpacity(7)).toBe(labelOpacity(1))
    expect(labelOpacity(-3)).toBe(labelOpacity(0))
  })

  it("is dim once disabled, whatever the lift, and dimmer than at rest", () => {
    expect(labelOpacity(1, true)).toBe(LABEL_OPACITY.disabled)
    expect(labelOpacity(0, true)).toBe(LABEL_OPACITY.disabled)
    expect(LABEL_OPACITY.disabled).toBeLessThan(LABEL_OPACITY.rest)
  })
})

describe("how many pixels a world unit is", () => {
  it("is the window's height over what the camera shows at that depth", () => {
    // a camera of 90 degrees shows 2 units at a depth of 1 and 20 at a depth of 10
    expect(unitPixels(90, 1, 800)).toBeCloseTo(400)
    expect(unitPixels(90, 10, 800)).toBeCloseTo(40)
  })

  it("is fewer further away and in a smaller window", () => {
    expect(unitPixels(34, 14, 900)).toBeLessThan(unitPixels(34, 7, 900))
    expect(unitPixels(34, 7, 600)).toBeLessThan(unitPixels(34, 7, 900))
  })

  it("never divides by nothing", () => {
    expect(Number.isFinite(unitPixels(34, 0, 900))).toBe(true)
  })
})

describe("how readable a label stays in a small window", () => {
  it("is not made bigger when its letters are as high as they need to be already, which is the case of every window but a very small one", () => {
    expect(readableBoost(LABEL_HEIGHT, 75, 1, LABEL_ROOM)).toBe(1)
    expect(lettersPixels(LABEL_HEIGHT, 75)).toBeGreaterThan(LABEL_MIN_PX)
  })

  it("grows until its letters are as high as the least that reads", () => {
    const small = 25
    const boost = readableBoost(LABEL_HEIGHT, small, 0.8, LABEL_ROOM)
    expect(boost).toBeGreaterThan(1)
    expect(lettersPixels(LABEL_HEIGHT, small) * boost).toBeCloseTo(LABEL_MIN_PX)
  })

  it("grows more the smaller the window is", () => {
    expect(readableBoost(LABEL_HEIGHT, 20, 0.8, LABEL_ROOM)).toBeGreaterThan(readableBoost(LABEL_HEIGHT, 30, 0.8, LABEL_ROOM))
  })

  it("never makes a line wider than its room, so that two labels side by side never touch: a line as wide as the room does not grow", () => {
    expect(readableBoost(LABEL_HEIGHT, 10, LABEL_ROOM, LABEL_ROOM)).toBe(1)
    // a line half as wide as the room can double at most
    expect(readableBoost(LABEL_HEIGHT, 10, LABEL_ROOM / 2, LABEL_ROOM)).toBeCloseTo(2)
  })

  it("is 1 for a label with no size and a window with no pixels", () => {
    expect(readableBoost(0, 25, 1, LABEL_ROOM)).toBe(1)
    expect(readableBoost(LABEL_HEIGHT, 0, 1, LABEL_ROOM)).toBeGreaterThanOrEqual(1)
    expect(Number.isFinite(readableBoost(LABEL_HEIGHT, 0, 1, LABEL_ROOM))).toBe(true)
  })
})

describe("how the arrow moves", () => {
  it("bobs down toward the object and back at rest, never above its place and never past its reach", () => {
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
