import { describe, expect, it } from "vitest"
import { CARDS, CATALOGUE, CHARACTER_KEYS, DECK, GUESSES, cardType, type CharacterKey } from "./catalogue"
import { OPTIONS, tokensToWin } from "./options"

// The box, as data. Rulebook, p. 2: 21 character cards of ten characters, valued 0 to 9. The keys are a contract with the Studio
// (`content/parity/engine.test.ts` keeps both sides equal), so they are listed here by name: a key that moves breaks this file first.

const KEYS: CharacterKey[] = ["spy", "guard", "priest", "baron", "handmaid", "prince", "chancellor", "king", "countess", "princess"]
const COPIES: Record<CharacterKey, number> = { spy: 2, guard: 6, priest: 2, baron: 2, handmaid: 2, prince: 2, chancellor: 2, king: 1, countess: 1, princess: 1 }

describe("the ten characters", () => {
  it("are the ten keys of the Studio, from the Spy at 0 to the Princess at 9 (p. 2)", () => {
    expect(CHARACTER_KEYS).toEqual(KEYS)
    expect(Object.keys(CARDS)).toEqual(KEYS)
  })

  it("each have a value of their own, 0 to 9, in the order of the list (pp. 2, 8-13)", () => {
    expect(KEYS.map((key) => CARDS[key].value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it("name a player the way the booklet says: another one (Guard, Priest, Baron, King), any (Prince), or nobody (pp. 9-12)", () => {
    const other: CharacterKey[] = ["guard", "priest", "baron", "king"]
    for (const key of KEYS) expect(CARDS[key].target, key).toBe(other.includes(key) ? "other" : key === "prince" ? "any" : null)
  })

  it("are read by key", () => {
    expect(cardType("king")).toEqual({ value: 7, target: "other" })
    expect(cardType("spy")).toEqual({ value: 0, target: null })
  })
})

describe("the guesses of a Guard", () => {
  it("are the nine characters but the Guard, the Spy included (p. 12)", () => {
    expect(GUESSES).toHaveLength(9)
    expect(GUESSES).not.toContain("guard")
    expect(GUESSES).toContain("spy")
    expect([...GUESSES].sort()).toEqual(KEYS.filter((key) => key !== "guard").sort())
  })
})

describe("the box", () => {
  it("holds 2 Spies, 6 Guards, 2 Priests, 2 Barons, 2 Handmaids, 2 Princes, 2 Chancellors, a King, a Countess and a Princess (p. 2)", () => {
    expect(DECK.map(({ type, copies }) => [type, copies])).toEqual(KEYS.map((key) => [key, COPIES[key]]))
  })

  it("lists each character once, in the order of CARDS", () => {
    expect(DECK.map(({ type }) => type)).toEqual(KEYS)
  })

  it("makes 21 cards, the copies of each character one after the other", () => {
    expect(CATALOGUE).toHaveLength(21)
    expect(CATALOGUE.slice(0, 2)).toEqual(["spy", "spy"])
    expect(CATALOGUE.slice(2, 8)).toEqual(Array.from({ length: 6 }, () => "guard"))
    expect(CATALOGUE.at(-1)).toBe("princess")
    for (const key of KEYS) expect(CATALOGUE.filter((card) => card === key), key).toHaveLength(COPIES[key])
  })

  it("adds up to the values of the deck: 0*2 + 1*6 + 2*2 + 3*2 + 4*2 + 5*2 + 6*2 + 7 + 8 + 9", () => {
    expect(CATALOGUE.reduce((sum, key) => sum + CARDS[key].value, 0)).toBe(70)
  })
})

describe("the favor tokens that win the game", () => {
  it("are 6, 5, 4, 3 and 3 at 2, 3, 4, 5 and 6 players (p. 7)", () => {
    expect([2, 3, 4, 5, 6].map(tokensToWin)).toEqual([6, 5, 4, 3, 3])
  })

  it("are not asked of a table the game does not seat: that is a bug of the game, not a player's mistake", () => {
    for (const players of [0, 1, 7, 2.5, -2, Number.NaN]) expect(() => tokensToWin(players), String(players)).toThrow(RangeError)
  })
})

describe("the options", () => {
  it("are none: the standard game, with no variant and no expansion (the classic version of p. 14 is out of scope)", () => {
    expect(OPTIONS).toEqual({})
  })
})
