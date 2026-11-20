import { describe, expect, it } from "vitest"
import { fan } from "../layout"
import { heldKeysFor, heldLeftPose, leftEndIsFirst, NO_KEYS } from "./held-hand-keys"

describe("which end is on the left", () => {
  it("is the first card for a seat that faces the viewer's way and the last for the seat across", () => {
    expect(leftEndIsFirst(undefined)).toBe(true)
    expect(leftEndIsFirst({ x: 0, z: 5, yaw: 0 })).toBe(true)
    expect(leftEndIsFirst({ x: 0, z: -5, yaw: Math.PI })).toBe(false)
  })

  it("is the first card of a seat turned a quarter, on one side as on the other", () => {
    expect(leftEndIsFirst({ x: -8, z: 0, yaw: Math.PI / 2 })).toBe(true)
    expect(leftEndIsFirst({ x: 8, z: 0, yaw: -Math.PI / 2 })).toBe(true)
  })
})

describe("the cards of a hand known by their count", () => {
  it("come in at the right, one name each, the oldest nearest the others", () => {
    const dealt = heldKeysFor(NO_KEYS, 3, true)
    expect(dealt.keys).toEqual([0, 1, 2])
    expect(heldKeysFor(dealt, 5, true).keys).toEqual([0, 1, 2, 3, 4])
  })

  it("leave from the left: the first card goes and the others keep their names", () => {
    const hand = heldKeysFor(NO_KEYS, 5, true)
    expect(heldKeysFor(hand, 4, true).keys).toEqual([1, 2, 3, 4])
    expect(heldKeysFor(hand, 2, true).keys).toEqual([3, 4])
  })

  it("do the same across the table, where the right of the picture is the start of the fan", () => {
    const hand = heldKeysFor(NO_KEYS, 3, false)
    expect(hand.keys).toEqual([2, 1, 0])
    // the card on the left of the picture, the last, leaves
    expect(heldKeysFor(hand, 2, false).keys).toEqual([2, 1])
    // a card drawn comes in at the right of the picture, before the first
    expect(heldKeysFor(heldKeysFor(hand, 2, false), 3, false).keys).toEqual([3, 2, 1])
  })

  it("never give a name twice: a card that comes after one has left has a name of its own", () => {
    let hand = heldKeysFor(NO_KEYS, 4, true)
    hand = heldKeysFor(hand, 3, true)
    hand = heldKeysFor(hand, 4, true)
    expect(new Set(hand.keys).size).toBe(4)
    expect(hand.keys).toEqual([1, 2, 3, 4])
  })

  it("hand back the same keys when the count did not change, so that a render does not set state again", () => {
    const hand = heldKeysFor(NO_KEYS, 3, true)
    expect(heldKeysFor(hand, 3, true)).toBe(hand)
  })
})

describe("the card a play leaves from", () => {
  const layout = (n: number) => fan(n, { gap: 0.4, y: 0.7, face: "down" })

  it("is the left end of the hand as it was, put in the frame of the seat", () => {
    const frame = { x: 0, z: -6, yaw: 0 }
    const pose = heldLeftPose(frame, layout, 5)
    expect(pose.position.x).toBeCloseTo(layout(5)[0]!.position.x, 9)
    expect(pose.position.z).toBeCloseTo(-6 + layout(5)[0]!.position.z, 9)
  })

  it("is on the right of the frame across the table, where it is the left of the picture", () => {
    const frame = { x: 0, z: -6, yaw: Math.PI }
    const pose = heldLeftPose(frame, layout, 5)
    const first = heldLeftPose({ ...frame, yaw: 0 }, layout, 5)
    expect(pose.position.x).toBeLessThan(0)
    expect(first.position.x).toBeLessThan(0)
  })
})
