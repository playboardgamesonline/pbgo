import { describe, expect, it, vi } from "vitest"
import { deal, draw, drawWithReshuffle, insertAt, peek, reshuffleDiscard } from "./deck"
import { createRng, createSaveableRng, restoreRng, shuffle } from "./rng"

const range = (count: number, from = 0) => Array.from({ length: count }, (_, i) => from + i)

describe("draw", () => {
  it("takes cards from the top and leaves the rest", () => {
    expect(draw([10, 11, 12, 13, 14], 2)).toEqual({ drawn: [10, 11], pile: [12, 13, 14] })
  })

  it("draws one card by default", () => {
    expect(draw([10, 11, 12])).toEqual({ drawn: [10], pile: [11, 12] })
  })

  it("draws what is left when the pile is short, and nothing from an empty pile", () => {
    expect(draw([10, 11], 5)).toEqual({ drawn: [10, 11], pile: [] })
    expect(draw([], 3)).toEqual({ drawn: [], pile: [] })
  })

  it("draws no card for a count of 0", () => {
    expect(draw([10, 11], 0)).toEqual({ drawn: [], pile: [10, 11] })
  })

  it("does not modify its input and returns arrays of its own", () => {
    const pile = [1, 2, 3]
    const result = draw(pile, 1)
    expect(pile).toEqual([1, 2, 3])
    result.pile.push(99)
    expect(pile).toEqual([1, 2, 3])
  })

  it("refuses a count that is not a non-negative integer", () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => draw([1, 2, 3], bad)).toThrow(RangeError)
    }
  })

  it("works with any kind of card", () => {
    expect(draw(["a", "b", "c"], 2)).toEqual({ drawn: ["a", "b"], pile: ["c"] })
  })
})

describe("peek", () => {
  it("shows the top cards and takes none", () => {
    const pile = [10, 11, 12, 13]
    expect(peek(pile, 3)).toEqual([10, 11, 12])
    expect(pile).toEqual([10, 11, 12, 13])
  })

  it("shows one card by default and at most what the pile holds", () => {
    expect(peek([10, 11])).toEqual([10])
    expect(peek([10, 11], 5)).toEqual([10, 11])
    expect(peek([], 3)).toEqual([])
  })

  it("returns a copy", () => {
    const pile = [1, 2, 3]
    peek(pile, 2).push(99)
    expect(pile).toEqual([1, 2, 3])
  })

  it("refuses a count that is not a non-negative integer", () => {
    expect(() => peek([1], -1)).toThrow(RangeError)
    expect(() => peek([1], 0.5)).toThrow(RangeError)
  })
})

describe("insertAt", () => {
  const pile = [10, 11, 12]

  it("puts a card on top at 0, at the bottom at pile.length, and slides it in between", () => {
    expect(insertAt(pile, 99, 0)).toEqual([99, 10, 11, 12])
    expect(insertAt(pile, 99, 3)).toEqual([10, 11, 12, 99])
    expect(insertAt(pile, 99, 1)).toEqual([10, 99, 11, 12])
    expect(insertAt(pile, 99, 2)).toEqual([10, 11, 99, 12])
  })

  it("leaves exactly `position` cards above the card", () => {
    for (let position = 0; position <= pile.length; position++) {
      expect(insertAt(pile, 99, position).indexOf(99)).toBe(position)
    }
  })

  it("fills an empty pile", () => {
    expect(insertAt([], 99, 0)).toEqual([99])
  })

  it("does not modify its input", () => {
    insertAt(pile, 99, 1)
    expect(pile).toEqual([10, 11, 12])
  })

  it("refuses a position outside the pile", () => {
    for (const bad of [-1, 4, 1.5, Number.NaN]) {
      expect(() => insertAt(pile, 99, bad)).toThrow(RangeError)
    }
    expect(() => insertAt([], 99, 1)).toThrow(RangeError)
  })
})

describe("reshuffleDiscard", () => {
  it("shuffles the discard under what is left of the deck", () => {
    const result = reshuffleDiscard({ deck: [1, 2], discard: [10, 11, 12, 13] }, createRng(5))
    expect(result.deck).toEqual([1, 2, ...shuffle([10, 11, 12, 13], createRng(5))])
    expect(result.discard).toEqual([])
  })

  it("keeps the top cards of the discard where they are", () => {
    const result = reshuffleDiscard({ deck: [], discard: [10, 11, 12, 13] }, createRng(5), { keep: 1 })
    expect(result.discard).toEqual([10])
    expect(result.deck).toEqual(shuffle([11, 12, 13], createRng(5)))
  })

  it("keeps a discard that is not longer than `keep` and draws nothing from the stream", () => {
    const rng = vi.fn(() => 0.5)
    expect(reshuffleDiscard({ deck: [1], discard: [10, 11] }, rng, { keep: 2 })).toEqual({ deck: [1], discard: [10, 11] })
    expect(reshuffleDiscard({ deck: [1], discard: [10, 11] }, rng, { keep: 5 })).toEqual({ deck: [1], discard: [10, 11] })
    expect(reshuffleDiscard({ deck: [1], discard: [10] }, rng)).toEqual({ deck: [1, 10], discard: [] })
    expect(rng).not.toHaveBeenCalled()
  })

  it("is deterministic, and the stream decides the order", () => {
    const piles = { deck: [], discard: range(20, 100) }
    expect(reshuffleDiscard(piles, createRng(1))).toEqual(reshuffleDiscard(piles, createRng(1)))
    expect(reshuffleDiscard(piles, createRng(1)).deck).not.toEqual(reshuffleDiscard(piles, createRng(2)).deck)
  })

  it("keeps every card: a permutation of the discard, none lost, none twice", () => {
    const result = reshuffleDiscard({ deck: [1, 2, 3], discard: range(30, 100) }, createRng(8), { keep: 2 })
    expect([...result.deck, ...result.discard].sort((a, b) => a - b)).toEqual([1, 2, 3, ...range(30, 100)])
  })

  it("does not modify its input", () => {
    const piles = { deck: [1, 2], discard: [10, 11, 12] }
    reshuffleDiscard(piles, createRng(1))
    expect(piles).toEqual({ deck: [1, 2], discard: [10, 11, 12] })
  })

  it("refuses a `keep` that is not a non-negative integer", () => {
    expect(() => reshuffleDiscard({ deck: [], discard: [1] }, createRng(1), { keep: -1 })).toThrow(RangeError)
    expect(() => reshuffleDiscard({ deck: [], discard: [1] }, createRng(1), { keep: 0.5 })).toThrow(RangeError)
  })
})

describe("drawWithReshuffle", () => {
  it("draws from the deck without touching the discard or the stream when the deck is enough", () => {
    const rng = vi.fn(() => 0.5)
    const result = drawWithReshuffle({ deck: [1, 2, 3, 4], discard: [10, 11] }, 3, rng)
    expect(result).toEqual({ drawn: [1, 2, 3], piles: { deck: [4], discard: [10, 11] } })
    expect(rng).not.toHaveBeenCalled()
  })

  it("does not reshuffle a deck that holds exactly the cards asked for", () => {
    const rng = vi.fn(() => 0.5)
    const result = drawWithReshuffle({ deck: [1, 2], discard: [10, 11, 12] }, 2, rng)
    expect(result).toEqual({ drawn: [1, 2], piles: { deck: [], discard: [10, 11, 12] } })
    expect(rng).not.toHaveBeenCalled()
  })

  it("reshuffles the discard when the deck runs out in the middle of the draw, and goes on", () => {
    const result = drawWithReshuffle({ deck: [1, 2], discard: [10, 11, 12, 13] }, 4, createRng(3))
    const refilled = shuffle([10, 11, 12, 13], createRng(3))
    expect(result.drawn).toEqual([1, 2, refilled[0], refilled[1]])
    expect(result.piles).toEqual({ deck: [refilled[2], refilled[3]], discard: [] })
  })

  it("reshuffles an empty deck", () => {
    const result = drawWithReshuffle({ deck: [], discard: [10, 11, 12] }, 1, createRng(3))
    const refilled = shuffle([10, 11, 12], createRng(3))
    expect(result).toEqual({ drawn: [refilled[0]], piles: { deck: [refilled[1], refilled[2]], discard: [] } })
  })

  it("keeps the top of the discard out of the reshuffle", () => {
    const result = drawWithReshuffle({ deck: [], discard: [10, 11, 12, 13] }, 2, createRng(3), { keep: 1 })
    const refilled = shuffle([11, 12, 13], createRng(3))
    expect(result).toEqual({ drawn: [refilled[0], refilled[1]], piles: { deck: [refilled[2]], discard: [10] } })
  })

  it("draws what exists when both piles are exhausted", () => {
    const result = drawWithReshuffle({ deck: [1], discard: [10, 11] }, 5, createRng(1))
    expect(result.drawn).toHaveLength(3)
    expect([...result.drawn].sort((a, b) => a - b)).toEqual([1, 10, 11])
    expect(result.piles).toEqual({ deck: [], discard: [] })
  })

  it("draws nothing when the only card left is the one kept on the discard", () => {
    expect(drawWithReshuffle({ deck: [], discard: [10] }, 4, createRng(1), { keep: 1 })).toEqual({
      drawn: [],
      piles: { deck: [], discard: [10] },
    })
  })

  it("draws no card, and reshuffles nothing, for a count of 0", () => {
    const rng = vi.fn(() => 0.5)
    expect(drawWithReshuffle({ deck: [], discard: [10, 11] }, 0, rng)).toEqual({ drawn: [], piles: { deck: [], discard: [10, 11] } })
    expect(rng).not.toHaveBeenCalled()
  })

  it("reshuffles once per call: a card discarded after the reshuffle is not drawn again within the call", () => {
    const result = drawWithReshuffle({ deck: [], discard: [10, 11] }, 5, createRng(1))
    expect(new Set(result.drawn).size).toBe(result.drawn.length)
  })

  it("does not modify its input", () => {
    const piles = { deck: [1], discard: [10, 11, 12] }
    drawWithReshuffle(piles, 3, createRng(1))
    expect(piles).toEqual({ deck: [1], discard: [10, 11, 12] })
  })

  it("loses no card and creates none, whatever is drawn and discarded", () => {
    const rng = createRng(77)
    let piles = { deck: shuffle(range(12), rng), discard: [] as number[] }
    const hand: number[] = []
    for (let step = 0; step < 200; step++) {
      const result = drawWithReshuffle(piles, 1 + Math.floor(rng() * 4), rng, { keep: 1 })
      hand.push(...result.drawn)
      piles = result.piles
      // the player discards a few cards from the hand, on top of the discard
      while (hand.length > 3) piles = { ...piles, discard: insertAt(piles.discard, hand.shift() as number, 0) }
      expect([...piles.deck, ...piles.discard, ...hand].sort((a, b) => a - b)).toEqual(range(12))
    }
  })

  it("carries on identically from a saved stream position, through jsonb", () => {
    const piles = { deck: range(3), discard: range(20, 100) }
    const continuous = createRng(11)
    const expected = [drawWithReshuffle(piles, 5, continuous), drawWithReshuffle(piles, 7, continuous)]

    const first = createSaveableRng(11)
    drawWithReshuffle(piles, 5, first)
    const stored = JSON.parse(JSON.stringify({ rng: first.save(), piles })) as { rng: number; piles: typeof piles }
    expect(drawWithReshuffle(stored.piles, 7, restoreRng(stored.rng))).toEqual(expected[1])
  })
})

describe("deal", () => {
  it("deals the hands one seat after the other and leaves the rest of the pile", () => {
    expect(deal(range(10), 3, 2)).toEqual({ hands: [[0, 1], [2, 3], [4, 5]], pile: [6, 7, 8, 9] })
  })

  it("can use the whole pile", () => {
    expect(deal(range(6), 2, 3)).toEqual({ hands: [[0, 1, 2], [3, 4, 5]], pile: [] })
  })

  it("deals empty hands for hands of size 0, and nothing for no seat", () => {
    expect(deal(range(3), 2, 0)).toEqual({ hands: [[], []], pile: [0, 1, 2] })
    expect(deal(range(3), 0, 4)).toEqual({ hands: [], pile: [0, 1, 2] })
  })

  it("refuses to deal uneven hands", () => {
    expect(() => deal(range(5), 3, 2)).toThrow(RangeError)
    expect(() => deal([], 1, 1)).toThrow(RangeError)
  })

  it("refuses seats or a size that are not non-negative integers", () => {
    expect(() => deal(range(5), -1, 1)).toThrow(RangeError)
    expect(() => deal(range(5), 2, 1.5)).toThrow(RangeError)
  })

  it("does not modify its input", () => {
    const pile = range(6)
    deal(pile, 2, 2)
    expect(pile).toEqual(range(6))
  })
})
