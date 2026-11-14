import { CARDS } from "@skyjo/engine"
import { describe, expect, it } from "vitest"
import { cardName } from "./cards"

describe("the name of a card", () => {
  it("is the figure printed on it, for every face of the catalogue", () => {
    for (const [key, { value }] of Object.entries(CARDS)) expect(cardName(key), key).toBe(String(value))
    expect(cardName("card-minus-2")).toBe("-2")
    expect(cardName("card-0")).toBe("0")
  })

  it("writes a key the catalogue does not know as it is", () => {
    expect(cardName("joker")).toBe("joker")
  })
})
