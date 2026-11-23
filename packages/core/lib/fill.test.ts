import { fill } from "@pbgo/studio-kit/fill"
import { describe, expect, it } from "vitest"
import { fill as skinFill } from "./skin"

describe("fill", () => {
  it("puts a value where its placeholder is, a number as it is written", () => {
    expect(fill("Round {round}: {name} has {points} points", { round: 2, name: "Ada", points: 41 })).toBe("Round 2: Ada has 41 points")
  })

  it("fills a placeholder every time it comes", () => {
    expect(fill("{n} and {n}", { n: 3 })).toBe("3 and 3")
  })

  it("leaves a placeholder that has no value as it is written, so a mistake shows instead of hiding", () => {
    expect(fill("Hello {name}", {})).toBe("Hello {name}")
    expect(fill("Hello {name}")).toBe("Hello {name}")
  })

  it("reads a placeholder of letters, digits and underscores only", () => {
    expect(fill("{a_1} {b-c} { d }", { a_1: "x", "b-c": "y", d: "z" })).toBe("x {b-c} { d }")
  })

  it("is the one function: the platform's `fill` of the skin is the same", () => {
    expect(skinFill).toBe(fill)
  })
})
