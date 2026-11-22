import { describe, expect, it } from "vitest"
import { CARD_SOUND, flightCues, soundOfTransition } from "./sounds"
import { CARD_STATES, type CardState } from "./states"

describe("the sound of a card changing state", () => {
  it("is a hover sound for a card that can be chosen and is now under the pointer", () => {
    expect(soundOfTransition("interactive", "hover")).toBe(CARD_SOUND.hover)
  })

  it("is none for a card that only came back to the hover after a press", () => {
    expect(soundOfTransition("pressed", "hover")).toBeNull()
  })

  it("is a select sound when the card is pressed, from whichever state it was pressed in", () => {
    expect(soundOfTransition("hover", "pressed")).toBe(CARD_SOUND.select)
    expect(soundOfTransition("interactive", "pressed")).toBe(CARD_SOUND.select)
  })

  it("is a select sound when the card is picked by the game, and none when the pick follows the press that made it", () => {
    expect(soundOfTransition("interactive", "selected")).toBe(CARD_SOUND.select)
    expect(soundOfTransition("hover", "selected")).toBe(CARD_SOUND.select)
    expect(soundOfTransition("pressed", "selected")).toBeNull()
  })

  it("is none when nothing changed", () => {
    for (const state of CARD_STATES) expect(soundOfTransition(state, state)).toBeNull()
  })

  it("is none for what the game does to a card: it can be chosen, it is disabled, it is out, it is back to base", () => {
    const quiet: [CardState, CardState][] = [
      ["base", "interactive"],
      ["interactive", "disabled"],
      ["interactive", "out"],
      ["selected", "interactive"],
      ["hover", "base"],
      ["selected", "hover"],
    ]
    for (const [from, to] of quiet) expect(soundOfTransition(from, to)).toBeNull()
  })

  it("is none for a card that ignores the visitor, whatever the visitor does", () => {
    for (const state of ["base", "disabled", "out"] as const) expect(soundOfTransition(state, "hover")).toBeNull()
  })
})

describe("the sounds of a card's flight", () => {
  it("are a slide as it leaves and a place as it lands, one flight apart", () => {
    expect(flightCues(0, 0.6)).toEqual([
      { name: "slide", delay: 0 },
      { name: "place", delay: 0.6 },
    ])
  })

  it("wait for the card's turn: both are counted from the delay it waits", () => {
    const [slide, place] = flightCues(0.4, 0.5)
    expect(slide?.delay).toBeCloseTo(0.4)
    expect(place?.delay).toBeCloseTo(0.9)
  })

  it("use the names the platform shares", () => {
    expect(Object.values(CARD_SOUND)).toEqual(["hover", "select", "slide", "place"])
  })
})
