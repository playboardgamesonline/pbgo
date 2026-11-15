import { describe, expect, it } from "vitest"
import { ALONE, gameRefusal, gameRefusalText, searchBlock, searchBlockText } from "./play-eligibility"

describe("a game the group is too large for", () => {
  it("is refused when more people sit together than it takes", () => {
    expect(gameRefusal({ size: 3 }, { min: 2, max: 2 })).toEqual({ code: "GROUP_TOO_LARGE", players: 3, max: 2 })
    expect(gameRefusal({ size: 9 }, { min: 2, max: 5 })).toEqual({ code: "GROUP_TOO_LARGE", players: 9, max: 5 })
  })

  it("is not refused when the group fits, whatever its least players: the table is filled up with others", () => {
    expect(gameRefusal({ size: 2 }, { min: 2, max: 2 })).toBeNull()
    expect(gameRefusal({ size: 2 }, { min: 4, max: 6 })).toBeNull()
    expect(gameRefusal(ALONE, { min: 2, max: 2 })).toBeNull()
  })

  it("is said with its figures", () => {
    expect(gameRefusalText({ code: "GROUP_TOO_LARGE", players: 4, max: 3 })).toBe("Your group has 4 players and this game takes 3 at most.")
  })
})

describe("a group that cannot look for a table", () => {
  it("is alone: nothing stops a visitor with nobody", () => {
    expect(searchBlock(ALONE)).toBeNull()
  })

  it("is stopped when a member is in a game, and the names are told", () => {
    expect(searchBlock({ size: 3, inGame: ["Marly"] })).toEqual({ code: "MEMBER_IN_GAME", names: ["Marly"] })
    expect(searchBlockText({ code: "MEMBER_IN_GAME", names: ["Marly"] })).toBe("Marly is in a game.")
    expect(searchBlockText({ code: "MEMBER_IN_GAME", names: ["Marly", "Zoé"] })).toBe("Marly and Zoé are in a game.")
    expect(searchBlockText({ code: "MEMBER_IN_GAME", names: ["Marly", "Zoé", "Tom"] })).toBe("Marly, Zoé and Tom are in a game.")
  })

  it("is stopped when it is two or more: a group does not search together", () => {
    expect(searchBlock({ size: 2, inGame: [] })).toEqual({ code: "GROUP_SEARCH" })
    expect(searchBlockText({ code: "GROUP_SEARCH" })).toBe("A group can't search together. Leave the group to search alone.")
  })

  it("says the member who is in a game first, since that reason stays when groups can search", () => {
    expect(searchBlock({ size: 2, inGame: ["Marly"] })?.code).toBe("MEMBER_IN_GAME")
  })
})
