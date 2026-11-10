import { describe, expect, it } from "vitest"
import { bagSize, drawFromBag } from "./bag"
import { createRng, createSaveableRng, restoreRng } from "./rng"

describe("bagSize", () => {
  it("counts the tokens of every kind", () => {
    expect(bagSize([5, 0, 3])).toBe(8)
    expect(bagSize([])).toBe(0)
  })

  it("refuses counts that are not whole numbers of tokens", () => {
    for (const bad of [[1, -1], [2.5], [Number.NaN], [Number.POSITIVE_INFINITY]]) expect(() => bagSize(bad), String(bad)).toThrow(RangeError)
  })
})

describe("drawFromBag", () => {
  it("draws the tokens it always drew (pinned: a change here would change every game already played)", () => {
    expect(drawFromBag(createRng(42), [5, 5, 5, 5], 8)).toEqual({ drawn: [2, 1, 3, 2, 0, 1, 0, 2], bag: [3, 3, 2, 4] })
    expect(drawFromBag(createRng(7), [3, 0, 4, 1], 8)).toEqual({ drawn: [0, 0, 3, 2, 2, 2, 0, 2], bag: [0, 0, 0, 0] })
  })

  it("takes the tokens it draws out of the bag, kind by kind", () => {
    const counts = [4, 3, 5]
    const { drawn, bag } = drawFromBag(createRng(1), counts, 6)
    expect(drawn).toHaveLength(6)
    const taken = [0, 0, 0]
    for (const kind of drawn) taken[kind]!++
    expect(bag).toEqual(counts.map((count, kind) => count - taken[kind]!))
    expect(bagSize(bag)).toBe(12 - 6)
  })

  it("draws a token by default, and none when asked for none", () => {
    expect(drawFromBag(createRng(3), [2, 2]).drawn).toHaveLength(1)
    expect(drawFromBag(createRng(3), [2, 2], 0)).toEqual({ drawn: [], bag: [2, 2] })
  })

  it("gives all the tokens of a bag that holds fewer than it is asked for, and the bag is empty", () => {
    const { drawn, bag } = drawFromBag(createRng(9), [2, 1], 10)
    expect(drawn).toHaveLength(3)
    expect([...drawn].sort()).toEqual([0, 0, 1])
    expect(bag).toEqual([0, 0])
  })

  it("draws nothing from an empty bag, and draws nothing from the stream", () => {
    const rng = createSaveableRng(5)
    expect(drawFromBag(rng, [0, 0, 0], 4)).toEqual({ drawn: [], bag: [0, 0, 0] })
    expect(drawFromBag(rng, [], 2)).toEqual({ drawn: [], bag: [] })
    expect(rng.save()).toBe(5)
  })

  it("never draws a kind that has no token, whatever the draw", () => {
    for (let seed = 0; seed < 50; seed++) {
      const { drawn } = drawFromBag(createRng(seed), [0, 3, 0, 2, 0], 5)
      expect(drawn.every((kind) => kind === 1 || kind === 3)).toBe(true)
    }
  })

  it("draws one number from the stream for each token it draws", () => {
    const rng = createSaveableRng(21)
    const reference = createSaveableRng(21)
    drawFromBag(rng, [3, 3, 3], 4)
    for (let i = 0; i < 4; i++) reference()
    expect(rng.save()).toBe(reference.save())
  })

  it("draws a bag out as a shuffle of its tokens: every token comes out once", () => {
    const counts = [3, 1, 4, 2]
    const { drawn, bag } = drawFromBag(createRng(77), counts, 10)
    expect([...drawn].sort()).toEqual([0, 0, 0, 1, 2, 2, 2, 2, 3, 3])
    expect(bag).toEqual([0, 0, 0, 0])
  })

  it("draws each kind as often as it is in the bag", () => {
    // One token drawn from a bag of one, two and three tokens, many times over with a stream that goes on: a sixth, a third and a half
    const rng = createRng(2024)
    const seen = [0, 0, 0]
    const draws = 60000
    for (let i = 0; i < draws; i++) seen[drawFromBag(rng, [1, 2, 3]).drawn[0]!]!++
    for (const [kind, share] of [1 / 6, 2 / 6, 3 / 6].entries()) expect(Math.abs(seen[kind]! / draws - share)).toBeLessThan(0.01)
  })

  it("leaves the counts it was given alone, and returns a bag that is not them", () => {
    const counts = Object.freeze([2, 2, 2]) as readonly number[]
    const { bag } = drawFromBag(createRng(4), counts, 3)
    expect(counts).toEqual([2, 2, 2])
    expect(bag).not.toBe(counts)
  })

  it("gives the same draws for the same seed and the same actions, through jsonb", () => {
    const play = (seed: number) => {
      let state = { rng: createSaveableRng(seed).save(), bag: [4, 4, 4], seen: [] as number[][] }
      for (let turn = 0; turn < 4; turn++) {
        const rng = restoreRng(state.rng)
        const { drawn, bag } = drawFromBag(rng, state.bag, 2)
        state = JSON.parse(JSON.stringify({ rng: rng.save(), bag, seen: [...state.seen, drawn] }))
      }
      return state.seen
    }
    expect(play(31)).toEqual(play(31))
    expect(play(31)).not.toEqual(play(32))
  })

  it("refuses counts that are not whole numbers of tokens, and a number of tokens to draw that is not whole", () => {
    for (const bad of [[1, -1], [2.5, 1], [Number.NaN]]) expect(() => drawFromBag(createRng(1), bad, 1), String(bad)).toThrow(RangeError)
    for (const count of [-1, 1.5, Number.NaN]) expect(() => drawFromBag(createRng(1), [3], count), String(count)).toThrow(RangeError)
    expect(() => drawFromBag(createRng(1), "abc" as unknown as number[], 1)).toThrow(RangeError)
  })
})
