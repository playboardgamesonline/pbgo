import { describe, expect, it } from "vitest"
import { type OptionDefinitions, applyPreset, defaultOptions, normalizeOptions, optionStatus, presetMatches } from "./options"

const DEFS: OptionDefinitions = {
  rounds: { type: "number", label: "Rounds", defaultValue: 3, min: 1, max: 5 },
  mode: { type: "choice", label: "Mode", defaultValue: "a", choices: [{ value: "a", label: "A" }, { value: "b", label: "B" }] },
  variant: { type: "boolean", label: "Variant", defaultValue: false },
}

describe("options", () => {
  it("gives the default values", () => {
    expect(defaultOptions(DEFS)).toEqual({ rounds: 3, mode: "a", variant: false })
  })
  it("clamps, rounds and rejects invalid values", () => {
    expect(normalizeOptions(DEFS, { rounds: 9, mode: "z", variant: "yes", unknown: 1 })).toEqual({ rounds: 5, mode: "a", variant: false })
    expect(normalizeOptions(DEFS, { rounds: 2.4, mode: "b", variant: true })).toEqual({ rounds: 2, mode: "b", variant: true })
    expect(normalizeOptions(DEFS, null)).toEqual({ rounds: 3, mode: "a", variant: false })
  })
})

const EXT: OptionDefinitions = {
  rainbow: { type: "boolean", group: "extension", label: "Rainbow", defaultValue: false },
  sixth: { type: "boolean", group: "extension", label: "6th color", defaultValue: false, conflictsWith: ["rainbow"] },
  expert: { type: "boolean", group: "extension", label: "Expert", defaultValue: false, requires: ["sixth"] },
  duo: { type: "boolean", group: "extension", label: "Duo", defaultValue: false, players: { max: 3 } },
}

describe("extensions", () => {
  it("turns off an extension whose prerequisite is missing", () => {
    expect(normalizeOptions(EXT, { expert: true }).expert).toBe(false)
    expect(normalizeOptions(EXT, { expert: true, sixth: true })).toMatchObject({ sixth: true, expert: true })
  })
  it("resolves conflicts: the one declared first wins", () => {
    expect(normalizeOptions(EXT, { rainbow: true, sixth: true })).toMatchObject({ rainbow: true, sixth: false })
  })
  it("cascades the deactivation", () => {
    expect(normalizeOptions(EXT, { rainbow: true, sixth: true, expert: true })).toMatchObject({ sixth: false, expert: false })
  })
  it("respects the number of players", () => {
    expect(normalizeOptions(EXT, { duo: true }, { playerCount: 5 }).duo).toBe(false)
    expect(normalizeOptions(EXT, { duo: true }, { playerCount: 2 }).duo).toBe(true)
    expect(optionStatus(EXT, {}, "duo", { playerCount: 5 })).toEqual({ available: false, reason: "players" })
  })
  it("explains why an option is unavailable", () => {
    expect(optionStatus(EXT, {}, "expert")).toEqual({ available: false, reason: "requires", with: ["sixth"] })
    expect(optionStatus(EXT, { rainbow: true }, "sixth")).toEqual({ available: false, reason: "conflicts", with: ["rainbow"] })
  })
  it("applies a preset without bypassing the constraints", () => {
    const preset = { id: "x", label: "X", values: { expert: true } }
    expect(applyPreset(EXT, preset).expert).toBe(false)
    const ok = { id: "y", label: "Y", values: { sixth: true, expert: true } }
    expect(presetMatches(ok, applyPreset(EXT, ok))).toBe(true)
  })
})
