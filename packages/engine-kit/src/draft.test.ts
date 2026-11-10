import { describe, expect, it } from "vitest"
import { passAround, takePicks } from "./draft"

describe("passAround", () => {
  const hands = [["a1", "a2"], ["b1"], ["c1", "c2", "c3"], []]

  it("gives each hand to the next player in seat order with one step", () => {
    expect(passAround(hands, 1)).toEqual([[], ["a1", "a2"], ["b1"], ["c1", "c2", "c3"]])
  })

  it("gives each hand to the player before with a negative step, as the second age of a draft does", () => {
    expect(passAround(hands, -1)).toEqual([["b1"], ["c1", "c2", "c3"], [], ["a1", "a2"]])
  })

  it("turns the hands round as many seats as it is told, and back where they were after a whole turn", () => {
    expect(passAround(hands, 2)).toEqual([["c1", "c2", "c3"], [], ["a1", "a2"], ["b1"]])
    expect(passAround(hands, 4)).toEqual(hands)
    expect(passAround(hands, 0)).toEqual(hands)
    expect(passAround(hands, 9)).toEqual(passAround(hands, 1))
    expect(passAround(hands, -5)).toEqual(passAround(hands, -1))
  })

  it("is the inverse of itself with the opposite number of steps", () => {
    expect(passAround(passAround(hands, 3), -3)).toEqual(hands)
  })

  it("passes the hands themselves, none changed and none copied", () => {
    const passed = passAround(hands, 1)
    expect(passed[1]).toBe(hands[0])
    expect(hands[0]).toEqual(["a1", "a2"])
  })

  it("passes nothing round an empty table, and one hand to itself", () => {
    expect(passAround([], 3)).toEqual([])
    expect(passAround([["x"]], 5)).toEqual([["x"]])
  })

  it("refuses steps that are not a whole number", () => {
    expect(() => passAround(hands, 1.5)).toThrow(RangeError)
    expect(() => passAround(hands, Number.NaN)).toThrow(RangeError)
  })
})

describe("takePicks", () => {
  it("takes each picked card from its hand and says what each player took", () => {
    const { hands, taken } = takePicks([["a", "b", "c"], ["d", "e"], ["f"]], ["b", "e", "f"])
    expect(hands).toEqual([["a", "c"], ["d"], []])
    expect(taken).toEqual(["b", "e", "f"])
  })

  it("takes a card that is twice in a hand once", () => {
    expect(takePicks([["x", "x", "y"]], ["x"]).hands).toEqual([["x", "y"]])
  })

  it("changes neither list it is given", () => {
    const hands = [["a", "b"], ["c"]]
    const picks = ["a", "c"]
    takePicks(hands, picks)
    expect(hands).toEqual([["a", "b"], ["c"]])
    expect(picks).toEqual(["a", "c"])
  })

  it("refuses picks that are not as many as the hands, and a pick that is not in its hand", () => {
    expect(() => takePicks([["a"], ["b"]], ["a"])).toThrow(RangeError)
    expect(() => takePicks([["a"], ["b"]], ["b", "a"])).toThrow(RangeError)
  })

  it("makes a draft: pick, take, pass, until the hands are empty", () => {
    let hands: string[][] = [["a1", "a2", "a3"], ["b1", "b2", "b3"], ["c1", "c2", "c3"]]
    const tableau: string[][] = [[], [], []]
    let round = 0
    while (hands[0]!.length > 0) {
      // Everybody picks their first card
      const picked = takePicks(hands, hands.map((hand) => hand[0]!))
      picked.taken.forEach((card, seat) => tableau[seat]!.push(card))
      hands = passAround(picked.hands, round % 2 === 0 ? 1 : -1)
      round++
    }
    expect(tableau.flat().sort()).toEqual(["a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2", "c3"])
    expect(tableau.every((cards) => cards.length === 3)).toBe(true)
    // The first pick of each seat is its own first card, the second one comes from the seat before
    expect(tableau[1]!.slice(0, 2)).toEqual(["b1", "a2"])
  })
})
