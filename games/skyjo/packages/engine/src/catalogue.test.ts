import { describe, expect, it } from "vitest"
import { CARDS, CATALOGUE, DECK, MAX_VALUE, MIN_VALUE, bandOf, cardType, keyOfValue } from "./catalogue"

// Rulebook, page 1: "150 cartes de jeu". The box (the count of each value) is the one of the real game: -2 x5, -1 x10, 0 x15, 1 to 12 x10.

describe("the box", () => {
  it("holds 150 cards", () => {
    expect(CATALOGUE).toHaveLength(150)
    expect(DECK.reduce((total, entry) => total + entry.copies, 0)).toBe(150)
  })

  it("holds five -2, ten -1, fifteen 0 and ten of each value from 1 to 12", () => {
    const count = (value: number) => CATALOGUE.filter((key) => cardType(key).value === value).length
    expect(count(-2)).toBe(5)
    expect(count(-1)).toBe(10)
    expect(count(0)).toBe(15)
    for (let value = 1; value <= 12; value++) expect(count(value), `${value}`).toBe(10)
  })

  it("has one face for each value from -2 to 12 and nothing else", () => {
    expect(Object.keys(CARDS)).toHaveLength(15)
    expect(Object.values(CARDS).map((card) => card.value)).toEqual(Array.from({ length: 15 }, (_, i) => i - 2))
    expect(MIN_VALUE).toBe(-2)
    expect(MAX_VALUE).toBe(12)
  })

  it("lists every face in the deck once", () => {
    expect(DECK.map((entry) => entry.type)).toEqual(Object.keys(CARDS))
  })

  it("names the face of a value, and refuses a value no card has", () => {
    expect(keyOfValue(-2)).toBe("card-minus-2")
    expect(keyOfValue(0)).toBe("card-0")
    expect(keyOfValue(12)).toBe("card-12")
    expect(() => keyOfValue(13)).toThrow(RangeError)
    expect(() => keyOfValue(-3)).toThrow(RangeError)
  })

  it("paints the colour bands of the cards: dark blue -2 and -1, light blue 0, green 1-4, yellow 5-8, red 9-12", () => {
    const bands = Array.from({ length: 15 }, (_, i) => bandOf(i - 2))
    expect(bands).toEqual(["dark-blue", "dark-blue", "light-blue", "green", "green", "green", "green", "yellow", "yellow", "yellow", "yellow", "red", "red", "red", "red"])
  })
})
