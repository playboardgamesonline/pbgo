import { describe, expect, it } from "vitest"
import { fold, matchOptions } from "./match-options"

describe("fold", () => {
  it("lowers the case and drops the accents", () => {
    expect(fold("Hervé MARLY")).toBe("herve marly")
    expect(fold("Stratégie")).toBe("strategie")
  })
})

describe("matchOptions", () => {
  const options = ["Bluffing", "Cards", "Co-op", "Dés", "Party", "Stratégie"]

  it("keeps every option, in its order, for no text or only blanks", () => {
    expect(matchOptions(options, "")).toEqual(options)
    expect(matchOptions(options, "   ")).toEqual(options)
  })

  it("keeps the options that hold the text, wherever it is in them", () => {
    expect(matchOptions(options, "ar")).toEqual(["Cards", "Party"])
    expect(matchOptions(options, "o-")).toEqual(["Co-op"])
    expect(matchOptions(options, "gie")).toEqual(["Stratégie"])
  })

  it("ignores the case, the accents and the blanks around the text", () => {
    expect(matchOptions(options, " STRATEGIE ")).toEqual(["Stratégie"])
    expect(matchOptions(options, "des")).toEqual(["Dés"])
    expect(matchOptions(options, "dés")).toEqual(["Dés"])
  })

  it("finds nothing for a text that no option holds", () => {
    expect(matchOptions(options, "zzz")).toEqual([])
  })

  it("never changes the options it is given", () => {
    const given = [...options]
    matchOptions(given, "ar")
    matchOptions(given, "")
    expect(given).toEqual(options)
  })
})
