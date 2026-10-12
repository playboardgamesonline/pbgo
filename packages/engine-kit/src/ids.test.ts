import { describe, expect, it } from "vitest"
import { cardOf, ID_SPACE, issueIds, reissueId, reissueIds } from "./ids"
import { createRng, sideSeed, type Rng } from "./rng"

/** A stream that returns the given numbers, one after the other. */
function script(...values: number[]): Rng {
  let i = 0
  return () => {
    if (i >= values.length) throw new Error("the script ran out of numbers")
    return values[i++] as number
  }
}

describe("issueIds", () => {
  it("issues the asked number of different integers", () => {
    const ids = issueIds(56, createRng(1))
    expect(ids).toHaveLength(56)
    expect(new Set(ids).size).toBe(56)
    for (const id of ids) {
      expect(Number.isInteger(id)).toBe(true)
      expect(id).toBeGreaterThanOrEqual(0)
      expect(id).toBeLessThan(ID_SPACE)
    }
  })

  it("is deterministic: the same stream issues the same ids", () => {
    expect(issueIds(20, createRng(7))).toEqual(issueIds(20, createRng(7)))
    expect(issueIds(20, createRng(7))).not.toEqual(issueIds(20, createRng(8)))
  })

  it("draws one number per id, as Courtisans always did (its ids stay what they were)", () => {
    const side = sideSeed(2 ** 40 + 5, 1)
    const direct = createRng(side)
    const expected = Array.from({ length: 10 }, () => Math.floor(direct() * 36 ** 6))
    expect(issueIds(10, createRng(side), 36 ** 6)).toEqual(expected)
  })

  it("draws again when an id is already taken", () => {
    expect(issueIds(3, script(0.1, 0.1, 0.1, 0.2, 0.2, 0.3), 10)).toEqual([1, 2, 3])
  })

  it("can use every id of a small space", () => {
    expect([...issueIds(8, createRng(3), 8)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it("issues nothing for no card", () => {
    expect(issueIds(0, createRng(1))).toEqual([])
  })

  it("refuses what cannot be done", () => {
    expect(() => issueIds(9, createRng(1), 8)).toThrow(RangeError)
    expect(() => issueIds(-1, createRng(1))).toThrow(RangeError)
    expect(() => issueIds(1.5, createRng(1))).toThrow(RangeError)
    expect(() => issueIds(1, createRng(1), 0)).toThrow(RangeError)
    expect(() => issueIds(1, createRng(1), ID_SPACE + 1)).toThrow(RangeError)
    expect(() => issueIds(1, createRng(1), 2.5)).toThrow(RangeError)
  })

  it("issues numbers: ids are lean (no strings, nothing to format)", () => {
    expect(issueIds(5, createRng(2)).every((id) => typeof id === "number")).toBe(true)
  })
})

describe("reissueId", () => {
  const ids = [11, 22, 33, 44]

  it("gives the card a new id and changes nothing else in the table", () => {
    const { ids: next, fresh } = reissueId(ids, 33, createRng(5))
    expect(next).toHaveLength(4)
    expect(next[2]).toBe(fresh)
    expect([next[0], next[1], next[3]]).toEqual([11, 22, 44])
    expect(ids).not.toContain(fresh)
  })

  it("keeps the card where it was in the catalogue: the new id leads to the same card", () => {
    const { ids: next, fresh } = reissueId(ids, 33, createRng(5))
    expect(cardOf(next, fresh)).toBe(cardOf(ids, 33))
    expect(cardOf(next, 33)).toBe(-1)
  })

  it("does not modify its input", () => {
    const before = [...ids]
    reissueId(ids, 11, createRng(1))
    expect(ids).toEqual(before)
  })

  it("is deterministic", () => {
    expect(reissueId(ids, 22, createRng(9))).toEqual(reissueId(ids, 22, createRng(9)))
  })

  it("skips an id that another card holds", () => {
    // 0.5 * 100 = 50 is held by the third card: the next number is used
    const { fresh } = reissueId([1, 2, 50], 1, script(0.5, 0.6), 100)
    expect(fresh).toBe(60)
  })

  it("throws for an id the table does not hold", () => {
    expect(() => reissueId(ids, 99, createRng(1))).toThrow(RangeError)
  })

  it("throws when every id of the space is held", () => {
    expect(() => reissueId([0, 1], 0, createRng(1), 2)).toThrow(RangeError)
  })

  it("never gives the same id twice in a row for a card that goes back into hiding again and again", () => {
    const rng = createRng(11)
    let table = issueIds(10, rng)
    let id = table[4] as number
    const seen = new Set<number>([id])
    for (let i = 0; i < 50; i++) {
      const next = reissueId(table, id, rng)
      expect(seen.has(next.fresh)).toBe(false)
      seen.add(next.fresh)
      table = next.ids
      id = next.fresh
    }
    expect(table).toHaveLength(10)
    expect(new Set(table).size).toBe(10)
  })
})

describe("reissueIds", () => {
  const ids = [11, 22, 33, 44, 55]

  it("reissues several cards, the new id of held[i] being fresh[i]", () => {
    const { ids: next, fresh } = reissueIds(ids, [55, 11, 33], createRng(4))
    expect(fresh).toHaveLength(3)
    expect(next[4]).toBe(fresh[0])
    expect(next[0]).toBe(fresh[1])
    expect(next[2]).toBe(fresh[2])
    expect([next[1], next[3]]).toEqual([22, 44])
  })

  it("issues ids that no card holds and that are different from each other", () => {
    const { ids: next, fresh } = reissueIds(ids, [11, 22, 33, 44, 55], createRng(4))
    expect(new Set(next).size).toBe(5)
    expect(fresh.filter((id) => ids.includes(id))).toEqual([])
  })

  it("does nothing for no card, and does not modify its input", () => {
    const before = [...ids]
    const { ids: next, fresh } = reissueIds(ids, [], createRng(1))
    expect(next).toEqual(ids)
    expect(next).not.toBe(ids)
    expect(fresh).toEqual([])
    expect(ids).toEqual(before)
  })

  it("throws for an id twice or unknown", () => {
    expect(() => reissueIds(ids, [11, 11], createRng(1))).toThrow(RangeError)
    expect(() => reissueIds(ids, [11, 99], createRng(1))).toThrow(RangeError)
  })
})

describe("cardOf", () => {
  it("finds the card that holds an id", () => {
    expect(cardOf([5, 8, 13], 13)).toBe(2)
    expect(cardOf([5, 8, 13], 5)).toBe(0)
  })

  it("answers -1 for an id nobody holds", () => {
    expect(cardOf([5, 8, 13], 6)).toBe(-1)
    expect(cardOf([], 1)).toBe(-1)
  })
})
