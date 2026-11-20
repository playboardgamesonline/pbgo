import { describe, expect, it } from "vitest"
import { CARD_STATE_FIELDS, CARD_STATE_SETTINGS, CARD_STATES, type CardState, effectiveState, haloSide, isPressable, stateLook, type Touch } from "./states"

const NONE: Touch = { hovered: false, focused: false, pressed: false }

describe("the state a card is drawn in", () => {
  it("is the one the game says, while nobody touches the card", () => {
    for (const state of CARD_STATES) expect(effectiveState(state, NONE)).toBe(state)
  })

  it("raises a card that can be chosen to hover under the pointer or the keyboard focus, and to pressed while it is pressed", () => {
    expect(effectiveState("interactive", { ...NONE, hovered: true })).toBe("hover")
    expect(effectiveState("interactive", { ...NONE, focused: true })).toBe("hover")
    expect(effectiveState("interactive", { ...NONE, hovered: true, pressed: true })).toBe("pressed")
    expect(effectiveState("interactive", { ...NONE, pressed: true })).toBe("pressed")
  })

  it("keeps a picked card picked under the pointer, and only dips it while it is pressed", () => {
    expect(effectiveState("selected", { ...NONE, hovered: true })).toBe("selected")
    expect(effectiveState("selected", { ...NONE, focused: true })).toBe("selected")
    expect(effectiveState("selected", { ...NONE, hovered: true, pressed: true })).toBe("pressed")
  })

  it("lets a game force hover and pressed on a card whose zone the pointer is over", () => {
    expect(effectiveState("hover", NONE)).toBe("hover")
    expect(effectiveState("hover", { ...NONE, pressed: true })).toBe("pressed")
    expect(effectiveState("pressed", NONE)).toBe("pressed")
  })

  it("lets the visitor do nothing to a card that is not chosen, disabled or out", () => {
    for (const state of ["base", "disabled", "out"] as CardState[]) {
      expect(effectiveState(state, { hovered: true, focused: true, pressed: true })).toBe(state)
    }
  })

  it("is pressed only for the states that can be chosen", () => {
    expect(CARD_STATES.filter(isPressable)).toEqual(["interactive", "hover", "pressed", "selected"])
  })
})

describe("what a state does to a card", () => {
  const look = (state: CardState) => stateLook(state)

  it("lights nothing for a card that lies as it is, is disabled or is out", () => {
    for (const state of ["base", "disabled", "out"] as CardState[]) {
      expect(look(state).bloom).toBe(0)
      expect(look(state).theme).toBeNull()
    }
    expect(look("base")).toMatchObject({ lift: 0, scale: 1, dim: 0 })
  })

  it("lights a card that can be chosen softly, brighter under the pointer, brightest while pressed", () => {
    expect(look("interactive").bloom).toBeGreaterThan(0)
    expect(look("hover").bloom).toBeGreaterThan(look("interactive").bloom)
    expect(look("pressed").bloom).toBeGreaterThan(look("hover").bloom)
    expect(look("pressed").bloom).toBeLessThanOrEqual(1)
  })

  it("rests a card that can be chosen on the table, lifts it under the pointer and puts it back down when pressed", () => {
    expect(look("interactive").lift).toBe(0)
    expect(look("hover").lift).toBeGreaterThan(0)
    expect(look("hover").scale).toBeGreaterThan(1)
    expect(look("pressed").lift).toBe(0)
    expect(look("pressed").scale).toBeLessThan(1)
  })

  it("raises a picked card higher and makes it bigger than a card under the pointer", () => {
    expect(look("selected").lift).toBeGreaterThan(look("hover").lift)
    expect(look("selected").scale).toBeGreaterThan(look("hover").scale)
  })

  it("darkens a disabled card and nothing else", () => {
    expect(look("disabled")).toMatchObject({ bloom: 0, lift: 0, scale: 1 })
    expect(look("disabled").dim).toBeGreaterThan(0)
    expect(look("interactive").dim).toBe(0)
  })

  it("colours each state that has a bloom from its own entry of the theme", () => {
    expect(look("interactive").theme).toBe("interactive")
    expect(look("hover").theme).toBe("hover")
    expect(look("pressed").theme).toBe("pressed")
    expect(look("selected").theme).toBe("selected")
  })

  it("reads the settings it is given, which the debug panel changes while the game runs", () => {
    expect(stateLook("hover", { ...CARD_STATE_SETTINGS, hoverLift: 0.5 }).lift).toBe(0.5)
  })

  it("has a knob for every setting", () => {
    expect(Object.keys(CARD_STATE_FIELDS).sort()).toEqual(Object.keys(CARD_STATE_SETTINGS).sort())
  })
})

describe("which side of a card its bloom lies on", () => {
  it("is behind a card lying face up, seen from above", () => {
    expect(haloSide({ x: 0, y: 1, z: 0 }, { x: 0, y: 8, z: 6 })).toBe("back")
  })

  it("is in front of a card lying face down, so the light still reaches out round a pile", () => {
    expect(haloSide({ x: 0, y: -1, z: 0 }, { x: 0, y: 8, z: 6 })).toBe("front")
  })

  it("is behind a card that stands up to the camera, and in front of one that turns its back on it", () => {
    expect(haloSide({ x: 0, y: 0.6, z: 0.8 }, { x: 0, y: 3, z: 8 })).toBe("back")
    expect(haloSide({ x: 0, y: -0.6, z: -0.8 }, { x: 0, y: 3, z: 8 })).toBe("front")
  })

  it("does not care how far the card is turned about the vertical", () => {
    const yaw = Math.PI * 0.75
    expect(haloSide({ x: 0, y: 1, z: 0 }, { x: Math.sin(yaw) * 5, y: 8, z: Math.cos(yaw) * 5 })).toBe("back")
  })
})
