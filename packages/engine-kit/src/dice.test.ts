import { describe, expect, it } from "vitest"
import { rerollDice, rollDice, rollDie } from "./dice"
import { createRng, createSaveableRng, restoreRng } from "./rng"

describe("rollDie", () => {
  it("rolls the numbers it always rolled (pinned: a change here would change every game already played)", () => {
    const rng = createRng(42)
    expect(Array.from({ length: 8 }, () => rollDie(rng))).toEqual([4, 3, 6, 5, 2, 4, 2, 4])
  })

  it("stays between 1 and the number of sides, whatever the die", () => {
    const rng = createRng(7)
    for (const sides of [2, 4, 6, 8, 10, 12, 20, 100]) {
      for (let i = 0; i < 500; i++) {
        const value = rollDie(rng, sides)
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(1)
        expect(value).toBeLessThanOrEqual(sides)
      }
    }
  })

  it("reaches every face, about as often as the others", () => {
    const rng = createRng(2024)
    const counts = new Array<number>(6).fill(0)
    const rolls = 60000
    for (let i = 0; i < rolls; i++) counts[rollDie(rng) - 1]!++
    for (const count of counts) expect(Math.abs(count - rolls / 6)).toBeLessThan((rolls / 6) * 0.05)
  })

  it("draws exactly one number from the stream", () => {
    const rng = createSaveableRng(5)
    const reference = createSaveableRng(5)
    rollDie(rng)
    reference()
    expect(rng.save()).toBe(reference.save())
  })

  it("refuses a die that has no sides to roll", () => {
    for (const sides of [1, 0, -6, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => rollDie(createRng(1), sides), String(sides)).toThrow(RangeError)
    }
  })
})

describe("rollDice", () => {
  it("is the same as that many dice rolled one after the other", () => {
    const together = rollDice(createRng(11), 5)
    const rng = createRng(11)
    expect(together).toEqual([rollDie(rng), rollDie(rng), rollDie(rng), rollDie(rng), rollDie(rng)])
  })

  it("rolls nothing, and draws nothing, for an empty pool", () => {
    const rng = createSaveableRng(3)
    expect(rollDice(rng, 0)).toEqual([])
    expect(rng.save()).toBe(3)
  })

  it("rolls dice of another size", () => {
    const rolled = rollDice(createRng(9), 200, 20)
    expect(Math.max(...rolled)).toBeLessThanOrEqual(20)
    expect(Math.max(...rolled)).toBeGreaterThan(6)
  })

  it("refuses a pool that is not a whole number of dice", () => {
    for (const count of [-1, 1.5, Number.NaN]) expect(() => rollDice(createRng(1), count), String(count)).toThrow(RangeError)
  })
})

describe("rerollDice", () => {
  const pool = [3, 3, 5, 1, 6]

  it("rolls the dice it is told to and keeps the others", () => {
    const next = rerollDice(createRng(8), pool, [1, 3])
    expect(next[0]).toBe(3)
    expect(next[2]).toBe(5)
    expect(next[4]).toBe(6)
    expect(next).toHaveLength(5)
  })

  it("leaves the pool it was given alone", () => {
    const before = [...pool]
    rerollDice(createRng(8), pool, [0, 1, 2, 3, 4])
    expect(pool).toEqual(before)
  })

  it("rolls in the order of the index, so the order the player listed them in changes nothing", () => {
    expect(rerollDice(createRng(8), pool, [3, 0, 2])).toEqual(rerollDice(createRng(8), pool, [0, 2, 3]))
  })

  it("draws one number for each die it rolls, no more", () => {
    const rng = createSaveableRng(21)
    const reference = createSaveableRng(21)
    rerollDice(rng, pool, [4, 1])
    reference()
    reference()
    expect(rng.save()).toBe(reference.save())
  })

  it("rolls the same dice as a fresh roll of that many", () => {
    const next = rerollDice(createRng(30), pool, [1, 4])
    const fresh = rollDice(createRng(30), 2)
    expect([next[1], next[4]]).toEqual(fresh)
  })

  it("rolls no die at all when none is listed", () => {
    const rng = createSaveableRng(2)
    expect(rerollDice(rng, pool, [])).toEqual(pool)
    expect(rng.save()).toBe(2)
  })

  it("refuses a die that is not in the pool, and a die rolled twice", () => {
    for (const bad of [[5], [-1], [1.5], [Number.NaN]]) expect(() => rerollDice(createRng(1), pool, bad), String(bad)).toThrow(RangeError)
    expect(() => rerollDice(createRng(1), pool, [2, 2])).toThrow(RangeError)
  })
})

describe("rolling inside a game", () => {
  // What `apply` of a game does: restore the stream from the state, roll, and keep the position of the stream in the new state
  type State = { rng: number; dice: number[]; rolls: number }
  const start = (seed: number): State => ({ rng: createSaveableRng(seed).save(), dice: [], rolls: 0 })
  const roll = (state: State, count: number): State => {
    const rng = restoreRng(state.rng)
    const dice = rollDice(rng, count)
    return { rng: rng.save(), dice, rolls: state.rolls + 1 }
  }

  it("gives the same dice for the same seed and the same actions, through jsonb", () => {
    const play = (seed: number) => {
      let state = start(seed)
      const seen: number[][] = []
      for (let turn = 0; turn < 6; turn++) {
        state = JSON.parse(JSON.stringify(roll(state, 3))) as State
        seen.push(state.dice)
      }
      return seen
    }
    expect(play(77)).toEqual(play(77))
    expect(play(77)).not.toEqual(play(78))
  })

  it("does not repeat a roll: every roll goes on from where the stream was", () => {
    let state = start(5)
    const seen = new Set<string>()
    for (let turn = 0; turn < 10; turn++) {
      state = roll(state, 4)
      seen.add(state.dice.join(","))
    }
    expect(seen.size).toBeGreaterThan(5)
  })
})
