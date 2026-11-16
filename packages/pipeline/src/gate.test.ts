import { describe, expect, it } from "vitest"
import { parseAnswer, YES_WORDS } from "./gate.ts"

describe("the words of a gate", () => {
  it("takes the words of the skills as a yes, in any case and with the punctuation of a sentence", () => {
    for (const word of YES_WORDS) expect(parseAnswer(word, "validate")).toEqual({ kind: "validate" })
    expect(parseAnswer("  Validate. ", "validate")).toEqual({ kind: "validate" })
    expect(parseAnswer("OUI!", "validate")).toEqual({ kind: "validate" })
  })

  it("does not take an empty line for a yes", () => {
    expect(parseAnswer("", "validate")).toEqual({ kind: "empty" })
    expect(parseAnswer("   ", "publish")).toEqual({ kind: "empty" })
  })

  it("takes an answer that mixes a yes and a change for a change", () => {
    expect(parseAnswer("ok but the slug is wrong", "validate")).toEqual({ kind: "change", text: "ok but the slug is wrong" })
    expect(parseAnswer("2019 edition", "validate")).toEqual({ kind: "change", text: "2019 edition" })
  })

  it("stops, opens and goes back", () => {
    expect(parseAnswer("q", "validate")).toEqual({ kind: "quit" })
    expect(parseAnswer("Quit", "publish")).toEqual({ kind: "quit" })
    expect(parseAnswer("o", "validate")).toEqual({ kind: "open" })
    expect(parseAnswer("b", "publish")).toEqual({ kind: "back" })
  })

  it("asks for the word publish, and nothing else, at the gate that makes something public", () => {
    expect(parseAnswer("publish", "publish")).toEqual({ kind: "publish" })
    expect(parseAnswer("Publish.", "publish")).toEqual({ kind: "publish" })
    for (const word of ["validate", "yes", "ok", "go", "oui", "y", "v"]) expect(parseAnswer(word, "publish").kind).toBe("unknown")
    expect(parseAnswer("change the title", "publish").kind).toBe("unknown")
  })

  it("says that validate comes before publish", () => {
    expect(parseAnswer("publish", "validate")).toMatchObject({ kind: "unknown" })
  })
})
