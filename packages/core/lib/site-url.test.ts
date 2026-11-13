import { describe, expect, it } from "vitest"
import { continuePath, gamePath, seatedPath, tablePath } from "./site-url"

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

describe("seatedPath", () => {
  it("is the lobby while the table waits", () => {
    expect(seatedPath("courtisans", "ABC234", "lobby")).toBe("/game/courtisans/ABC234")
  })

  it("is the board once the table has begun, in its ready check or in play", () => {
    expect(seatedPath("courtisans", "ABC234", "starting")).toBe("/courtisans/game/ABC234")
    expect(seatedPath("courtisans", "ABC234", "playing")).toBe("/courtisans/game/ABC234")
  })
})
