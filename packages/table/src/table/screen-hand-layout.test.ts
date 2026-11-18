import { PerspectiveCamera } from "three"
import { describe, expect, it } from "vitest"
import type { CardSize } from "../card/geometry"
import { SCREEN_HAND_SETTINGS, type ScreenHandSettings, screenHandFit, screenHandLayout, screenViewOf } from "./screen-hand-layout"

const CARD: CardSize = { width: 1.3, height: 1.9 }

/** The settings with the block of cards drawn square to the screen: no turn, no fan, no curve, and all the width of the picture to spread in, so that the numbers can be read off the poses */
const SQUARE: ScreenHandSettings = { ...SCREEN_HAND_SETTINGS, rotation: { x: 0, y: 0, z: 0 }, fan: 0, curve: 0, room: 1 }

/** The picture's edges at the distance the hand stands, for a camera with this field of view and aspect ratio */
function viewOf(fov: number, aspect: number, distance = SCREEN_HAND_SETTINGS.distance) {
  const camera = new PerspectiveCamera(fov, aspect, 0.1, 100)
  camera.updateProjectionMatrix()
  return screenViewOf({ m00: camera.projectionMatrix.elements[0]!, m11: camera.projectionMatrix.elements[5]! }, distance)
}

const VIEW = viewOf(34, 1.6)

describe("the edges of the picture", () => {
  it("are where the lens says at the distance of the hand: its half height, and that times the aspect ratio for its half width", () => {
    expect(VIEW.halfHeight).toBeCloseTo(6 * Math.tan((17 * Math.PI) / 180), 6)
    expect(VIEW.halfWidth).toBeCloseTo(VIEW.halfHeight * 1.6, 6)
    expect(VIEW.distance).toBe(6)
  })
})

describe("the hand held at the bottom left", () => {
  it("has its first card flush with the left edge of the picture, a hair past it", () => {
    const [first] = screenHandLayout(3, VIEW, CARD, SQUARE)
    const width = CARD.width * first!.scale
    expect(first!.position.x - width / 2).toBeCloseTo(-VIEW.halfWidth - width * 0.02, 6)
  })

  it("has the bottom of its cards cut by the bottom edge of the picture", () => {
    const [first] = screenHandLayout(3, VIEW, CARD, SQUARE)
    const height = CARD.height * first!.scale
    expect(first!.position.y - height / 2).toBeLessThan(-VIEW.halfHeight)
    // and no more than the settings say: the middle of the card stands `y` of its height above the edge
    expect(first!.position.y).toBeCloseTo(-VIEW.halfHeight + height * SQUARE.y, 6)
  })

  it("stands in front of the camera, at the distance asked for", () => {
    for (const pose of screenHandLayout(4, VIEW, CARD)) expect(pose.position.z).toBeLessThan(-VIEW.distance + 0.2)
    for (const pose of screenHandLayout(4, VIEW, CARD, SQUARE)) expect(Math.abs(pose.position.z + VIEW.distance)).toBeLessThan(0.1)
  })

  it("is as big as a share of the picture's height, whatever the window", () => {
    const [near] = screenHandLayout(3, viewOf(34, 1.6, 6), CARD)
    const [far] = screenHandLayout(3, viewOf(34, 1.6, 12), CARD)
    const [wide] = screenHandLayout(3, viewOf(34, 2.4, 6), CARD)
    // The height of a card, over the half height of the picture at the card's distance, is the same
    expect((CARD.height * near!.scale) / viewOf(34, 1.6, 6).halfHeight).toBeCloseTo(SCREEN_HAND_SETTINGS.size, 6)
    expect((CARD.height * far!.scale) / viewOf(34, 1.6, 12).halfHeight).toBeCloseTo(SCREEN_HAND_SETTINGS.size, 6)
    // A wider window is as high, so the cards are as big
    expect(wide!.scale).toBeCloseTo(near!.scale, 6)
  })

  it("grows to the right: the cards that are there stay where they are as others come", () => {
    const two = screenHandLayout(2, VIEW, CARD, SQUARE)
    const four = screenHandLayout(4, VIEW, CARD, SQUARE)
    expect(four[0]!.position.x).toBeCloseTo(two[0]!.position.x, 6)
    expect(four[1]!.position.x).toBeCloseTo(two[1]!.position.x, 6)
    expect(four[3]!.position.x).toBeGreaterThan(four[2]!.position.x)
  })

  it("overlaps its cards a little, the later ones over the earlier", () => {
    const hand = screenHandLayout(4, VIEW, CARD, SQUARE)
    const width = CARD.width * hand[0]!.scale
    expect(hand[1]!.position.x - hand[0]!.position.x).toBeCloseTo(width * SQUARE.step, 6)
    expect(hand[1]!.position.x - hand[0]!.position.x).toBeLessThan(width)
    expect(hand[1]!.position.z).toBeGreaterThan(hand[0]!.position.z)
  })

  it("opens as a fan and hangs at the ends: the cards turn and sink with their distance from the middle", () => {
    const hand = screenHandLayout(5, VIEW, CARD, { ...SQUARE, fan: 0.1, curve: 0.05 })
    const middle = hand[2]!
    expect(hand[0]!.position.y).toBeLessThan(middle.position.y)
    expect(hand[4]!.position.y).toBeCloseTo(hand[0]!.position.y, 6)
    expect(hand[0]!.quaternion.angleTo(hand[1]!.quaternion)).toBeGreaterThan(0.05)
    expect(hand[2]!.quaternion.angleTo(hand[2]!.quaternion)).toBe(0)
  })

  it("brings the card under the pointer forward, over its neighbours, and moves no other", () => {
    const flat = screenHandLayout(4, VIEW, CARD, SQUARE)
    const raised = screenHandLayout(4, VIEW, CARD, SQUARE, 2)
    expect(raised[2]!.position.z).toBeGreaterThan(flat[2]!.position.z + 0.05)
    for (const i of [0, 1, 3]) expect(raised[i]!.position.distanceTo(flat[i]!.position)).toBe(0)
  })

  it("has no slot for no card", () => {
    expect(screenHandLayout(0, VIEW, CARD)).toEqual([])
  })
})

describe("a hand that is wider than its room", () => {
  const TIGHT: ScreenHandSettings = { ...SQUARE, room: 0.5 }
  const room = TIGHT.room * 2 * VIEW.halfWidth

  const widthOf = (count: number) => {
    const hand = screenHandLayout(count, VIEW, CARD, TIGHT)
    const half = (CARD.width * hand[0]!.scale) / 2
    return hand[count - 1]!.position.x + half - (hand[0]!.position.x - half)
  }

  it("keeps the size and the spacing it is asked for while it fits", () => {
    expect(screenHandFit(2, VIEW, CARD, TIGHT).scale).toBeCloseTo((VIEW.halfHeight * TIGHT.size) / CARD.height, 6)
    expect(widthOf(2)).toBeLessThanOrEqual(room)
  })

  it("packs its cards closer, so as to fit the room, before it shrinks them", () => {
    const wanted = screenHandFit(1, VIEW, CARD, TIGHT)
    const packed = screenHandFit(5, VIEW, CARD, TIGHT)
    expect(packed.scale).toBeCloseTo(wanted.scale, 9)
    expect(packed.step).toBeLessThan(wanted.step)
  })

  it("shrinks its cards once packing is not enough, and never takes more than the room, whatever the number of cards", () => {
    for (const count of [5, 8, 12, 20]) expect(widthOf(count), `${count} cards`).toBeLessThanOrEqual(room + 1e-9)
    expect(screenHandFit(20, VIEW, CARD, TIGHT).scale).toBeLessThan(screenHandFit(1, VIEW, CARD, TIGHT).scale)
  })
})
