import { describe, expect, it } from "vitest"
import { type OptionDefinitions, normalizeOptions, defaultOptions } from "./options"

const DEFS: OptionDefinitions = {
  rounds: { type: "number", label: "Manches", defaultValue: 3, min: 1, max: 5 },
  mode: { type: "choice", label: "Mode", defaultValue: "a", choices: [{ value: "a", label: "A" }, { value: "b", label: "B" }] },
  variant: { type: "boolean", label: "Variante", defaultValue: false },
}

describe("options", () => {
  it("donne les valeurs par défaut", () => {
    expect(defaultOptions(DEFS)).toEqual({ rounds: 3, mode: "a", variant: false })
  })
  it("borne, arrondit et rejette les valeurs invalides", () => {
    expect(normalizeOptions(DEFS, { rounds: 9, mode: "z", variant: "oui", unknown: 1 })).toEqual({ rounds: 5, mode: "a", variant: false })
    expect(normalizeOptions(DEFS, { rounds: 2.4, mode: "b", variant: true })).toEqual({ rounds: 2, mode: "b", variant: true })
    expect(normalizeOptions(DEFS, null)).toEqual({ rounds: 3, mode: "a", variant: false })
  })
})
