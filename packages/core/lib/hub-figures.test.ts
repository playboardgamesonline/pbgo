import { describe, expect, it } from "vitest"
import { figure, parseFigures, statsItems } from "./hub-figures"

describe("figure", () => {
  it("writes thousands with a comma", () => {
    expect(figure(0)).toBe("0")
    expect(figure(12_480)).toBe("12,480")
  })
})

describe("statsItems", () => {
  it("gives the players online (live), the members and the games, in that order", () => {
    expect(statsItems({ online: 128, members: 12_480 }, 71)).toEqual([
      { value: "128", label: "players online", live: true },
      { value: "12,480", label: "members" },
      { value: "71", label: "games" },
    ])
  })

  it("says one, not 'one members'", () => {
    expect(statsItems({ online: 1, members: 1 }, 1)).toEqual([
      { value: "1", label: "player online", live: true },
      { value: "1", label: "member" },
      { value: "1", label: "game" },
    ])
  })

  it("says zero in the plural", () => {
    expect(statsItems({ online: 0, members: 0 }, 71).map((item) => item.label)).toEqual(["players online", "members", "games"])
  })

  it("leaves out a figure that could not be counted and never makes one up", () => {
    expect(statsItems({ online: null, members: 3 }, 71).map((item) => item.label)).toEqual(["members", "games"])
    expect(statsItems({ online: 2, members: null }, 71).map((item) => item.label)).toEqual(["players online", "games"])
    expect(statsItems({ online: null, members: null }, 71).map((item) => item.label)).toEqual(["games"])
  })
})

describe("parseFigures", () => {
  it("reads the answer of the route", () => {
    expect(parseFigures({ online: 3, members: 1 })).toEqual({ online: 3, members: 1 })
    expect(parseFigures({ online: 0, members: 0 })).toEqual({ online: 0, members: 0 })
    expect(parseFigures({ online: null, members: 5 })).toEqual({ online: null, members: 5 })
  })

  it("does not trust anything else", () => {
    for (const value of [null, undefined, 4, "3", [], {}, { online: 1 }, { members: 1 }, { online: -1, members: 1 }, { online: 1.5, members: 1 }, { online: "3", members: 1 }, { online: 1, members: NaN }]) {
      expect(parseFigures(value), JSON.stringify(value)).toBeNull()
    }
  })
})
