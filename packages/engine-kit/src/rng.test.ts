import { afterEach, describe, expect, it, vi } from "vitest"
import { createRng, createSaveableRng, randomSeed, restoreRng, shuffle, sideSeed } from "./rng"

function draws(rng: () => number, count: number): number[] {
  return Array.from({ length: count }, () => rng())
}

describe("createRng", () => {
  it("draws the numbers it always drew (pinned: a change here would change every game already played)", () => {
    expect(draws(createRng(42), 4)).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693])
  })

  it("only uses the low 32 bits of the seed", () => {
    expect(draws(createRng(2 ** 40 + 7), 2)).toEqual([0.011704753153026104, 0.06195825757458806])
    expect(draws(createRng(2 ** 40 + 7), 2)).toEqual(draws(createRng(7), 2))
  })

  it("stays in [0, 1)", () => {
    const rng = createRng(1)
    for (let i = 0; i < 1000; i++) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe("saveable stream", () => {
  it("draws the same numbers as createRng for the same seed", () => {
    expect(draws(createSaveableRng(42), 6)).toEqual(draws(createRng(42), 6))
  })

  it("starts at the low 32 bits of the seed and moves with every draw", () => {
    expect(createSaveableRng(7).save()).toBe(7)
    expect(createSaveableRng(2 ** 40 + 7).save()).toBe(7)
    const rng = createSaveableRng(42)
    draws(rng, 3)
    expect(rng.save()).toBe(1199730185)
  })

  it("carries on from a saved position as the original would have", () => {
    const original = createSaveableRng(2024)
    draws(original, 5)
    const restored = restoreRng(original.save())
    expect(draws(restored, 10)).toEqual(draws(original, 10))
  })

  it("restores from a position that went through jsonb", () => {
    const original = createSaveableRng(99)
    draws(original, 3)
    const stored = JSON.parse(JSON.stringify({ rng: original.save() })) as { rng: number }
    expect(draws(restoreRng(stored.rng), 4)).toEqual(draws(original, 4))
  })

  it("keeps a restored stream saveable, step after step", () => {
    const reference = createRng(5)
    const expected = draws(reference, 9)
    let position = createSaveableRng(5).save()
    const seen: number[] = []
    for (let step = 0; step < 3; step++) {
      const rng = restoreRng(position)
      seen.push(...draws(rng, 3))
      position = rng.save()
    }
    expect(seen).toEqual(expected)
  })

  it("refuses a position that is not an unsigned 32-bit integer (it would silently restart the stream)", () => {
    for (const bad of [undefined, null, Number.NaN, -1, 1.5, 2 ** 32, Number.POSITIVE_INFINITY, "7"]) {
      expect(() => restoreRng(bad as unknown as number)).toThrow(RangeError)
    }
    expect(() => restoreRng(0)).not.toThrow()
    expect(() => restoreRng(2 ** 32 - 1)).not.toThrow()
  })
})

describe("shuffle", () => {
  it("shuffles the same way for the same seed (pinned)", () => {
    expect(shuffle([0, 1, 2, 3, 4, 5, 6, 7], createRng(2024))).toEqual([7, 0, 1, 2, 5, 3, 4, 6])
  })

  it("returns a permutation and leaves its input alone", () => {
    const cards = [1, 2, 3, 4, 5, 6]
    const shuffled = shuffle(cards, createRng(3))
    expect(cards).toEqual([1, 2, 3, 4, 5, 6])
    expect([...shuffled].sort()).toEqual(cards)
  })

  it("does not draw anything for fewer than two items", () => {
    const rng = vi.fn(() => 0.5)
    expect(shuffle([], rng)).toEqual([])
    expect(shuffle([1], rng)).toEqual([1])
    expect(rng).not.toHaveBeenCalled()
  })
})

describe("sideSeed", () => {
  it("only depends on the high bits of the game seed, so a side stream says nothing about the shuffle", () => {
    expect(sideSeed(5 * 2 ** 32 + 123, 1)).toBe(1842868962)
    expect(sideSeed(5 * 2 ** 32 + 999, 1)).toBe(1842868962)
    expect(sideSeed(6 * 2 ** 32 + 123, 1)).toBe(741218851)
  })

  it("gives every stream its own seed", () => {
    expect(sideSeed(5 * 2 ** 32 + 123, 2)).toBe(1043244751)
    expect(sideSeed(5 * 2 ** 32, 3, 4, 5)).toBe(1159422745)
    expect(sideSeed(5 * 2 ** 32, 3, 4)).not.toBe(sideSeed(5 * 2 ** 32, 3, 4, 5))
  })

  it("is an unsigned 32-bit integer", () => {
    for (const seed of [0, 1, 2 ** 32, 2 ** 51 + 12345]) {
      const side = sideSeed(seed, 1, 2)
      expect(Number.isInteger(side)).toBe(true)
      expect(side).toBeGreaterThanOrEqual(0)
      expect(side).toBeLessThan(2 ** 32)
    }
  })
})

describe("randomSeed", () => {
  afterEach(() => vi.restoreAllMocks())

  it("builds an integer below 2^52 from two draws of Math.random", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.5).mockReturnValueOnce(0.25)
    expect(randomSeed()).toBe(524288 * 2 ** 32 + 1073741824)
  })

  it("stays in range", () => {
    for (let i = 0; i < 200; i++) {
      const seed = randomSeed()
      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThan(2 ** 52)
    }
  })
})
