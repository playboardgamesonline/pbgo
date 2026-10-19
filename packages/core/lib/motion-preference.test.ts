import { describe, expect, it } from "vitest"
import { fade, REDUCED_FADE, resolveMotion, travel } from "./motion-preference"

describe("resolveMotion", () => {
  it("is calm unless the game asks for more", () => {
    expect(resolveMotion(false, undefined)).toBe("calm")
    expect(resolveMotion(false, "calm")).toBe("calm")
  })

  it("is lively when the game asks for it", () => {
    expect(resolveMotion(false, "lively")).toBe("lively")
  })

  it("is reduced whenever the visitor asks for less motion, whatever the game says", () => {
    expect(resolveMotion(true, undefined)).toBe("reduced")
    expect(resolveMotion(true, "calm")).toBe("reduced")
    expect(resolveMotion(true, "lively")).toBe("reduced")
  })
})

describe("fade", () => {
  it("keeps a fade as long as it is under calm and lively motion", () => {
    expect(fade("calm", 0.6)).toBe(0.6)
    expect(fade("lively", 0.6)).toBe(0.6)
  })

  it("caps a fade at 150 ms under reduced motion, and leaves a shorter one alone", () => {
    expect(REDUCED_FADE).toBe(0.15)
    expect(fade("reduced", 0.6)).toBe(0.15)
    expect(fade("reduced", 0.1)).toBe(0.1)
  })
})

describe("travel", () => {
  it("moves the element under calm and lively motion", () => {
    expect(travel("calm", -8)).toBe(-8)
    expect(travel("lively", 24)).toBe(24)
  })

  it("does not move it under reduced motion: it only fades", () => {
    expect(travel("reduced", -8)).toBe(0)
  })
})
