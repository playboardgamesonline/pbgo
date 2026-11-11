import { describe, expect, it } from "vitest"
import { continuePath, gamePath, tablePath } from "./site-url"

describe("continuePath", () => {
  it("leads a member to their home, which is theirs and only theirs", () => {
    expect(continuePath(true)).toBe("/home")
  })

  it("leads a guest to the public home, since they have no home of their own", () => {
    expect(continuePath(false)).toBe("/")
  })
})

describe("the paths of a game and of its tables", () => {
  it("are the hub's", () => {
    expect(gamePath("courtisans")).toBe("/game/courtisans")
    expect(tablePath("courtisans", "ABC234")).toBe("/game/courtisans/ABC234")
  })
})
