import { describe, expect, it } from "vitest"
import { ALONE, gameRefusal, gameRefusalText, searchBlock, searchBlockText, tableBlock, tableBlockText, type PlayGroup } from "./play-eligibility"

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
    expect(searchBlock({ size: 3, inGame: ["Marly"], offline: [], leads: true })).toEqual({ code: "MEMBER_IN_GAME", names: ["Marly"] })
    expect(searchBlockText({ code: "MEMBER_IN_GAME", names: ["Marly"] })).toBe("Marly is in a game.")
    expect(searchBlockText({ code: "MEMBER_IN_GAME", names: ["Marly", "Zoé"] })).toBe("Marly and Zoé are in a game.")
    expect(searchBlockText({ code: "MEMBER_IN_GAME", names: ["Marly", "Zoé", "Tom"] })).toBe("Marly, Zoé and Tom are in a game.")
  })

  it("is stopped when it is two or more: a group does not search together", () => {
    expect(searchBlock({ size: 2, inGame: [], offline: [], leads: true })).toEqual({ code: "GROUP_SEARCH" })
    expect(searchBlockText({ code: "GROUP_SEARCH" })).toBe("A group can't search together. Leave the group to search alone.")
  })

  it("says the member who is in a game first, since that reason stays when groups can search", () => {
    expect(searchBlock({ size: 2, inGame: ["Marly"], offline: [], leads: true })?.code).toBe("MEMBER_IN_GAME")
  })
})

describe("a member of a group who does not lead it", () => {
  it("cannot look for a table: only the leader does, whatever else is the matter", () => {
    expect(searchBlock({ size: 3, inGame: [], offline: [], leads: false })).toEqual({ code: "NOT_LEADER" })
    expect(searchBlock({ size: 3, inGame: ["Marly"], offline: [], leads: false })).toEqual({ code: "NOT_LEADER" })
    expect(searchBlockText({ code: "NOT_LEADER" })).toBe("Only the leader of your group can find a game.")
  })

  it("is not stopped when they are alone, and the leader is stopped only by the rest", () => {
    expect(ALONE.leads).toBe(true)
    expect(searchBlock({ size: 3, inGame: [], offline: [], leads: true })).toEqual({ code: "GROUP_SEARCH" })
  })

  it("cannot start a game either, and the leader and the visitor alone can", () => {
    expect(tableBlock({ size: 3, inGame: [], offline: [], leads: false }, { min: 2, max: 4 })).toEqual({ code: "NOT_LEADER" })
    expect(tableBlockText({ code: "NOT_LEADER" })).toBe("Only the leader of your group can start a game.")
    expect(tableBlock({ size: 3, inGame: [], offline: [], leads: true }, { min: 2, max: 4 })).toBeNull()
    expect(tableBlock(ALONE, { min: 1, max: 4 })).toBeNull()
  })
})

describe("a group that cannot start a game (PLT-141)", () => {
  const group = (over: Partial<PlayGroup> = {}): PlayGroup => ({ size: 3, inGame: [], offline: [], leads: true, ...over })

  it("is stopped when it is smaller than the game needs, and is told to invite a friend", () => {
    expect(tableBlock(ALONE, { min: 2, max: 4 })).toEqual({ code: "GROUP_TOO_SMALL", players: 1, min: 2 })
    expect(tableBlockText({ code: "GROUP_TOO_SMALL", players: 1, min: 2 })).toBe("This game needs at least 2 players. Invite a friend first.")
    expect(tableBlockText({ code: "GROUP_TOO_SMALL", players: 2, min: 4 })).toBe("This game needs at least 4 players. Invite friends first.")
  })

  it("is not stopped for a game that takes one player: the visitor alone starts it", () => {
    expect(tableBlock(ALONE, { min: 1, max: 1 })).toBeNull()
  })

  it("asks nothing of its size while no game is picked", () => {
    expect(tableBlock(ALONE, null)).toBeNull()
  })

  it("is stopped when a member is in a game or offline, and the names are told", () => {
    expect(tableBlock(group({ inGame: ["Marly"] }), { min: 2, max: 4 })).toEqual({ code: "MEMBER_IN_GAME", names: ["Marly"] })
    expect(tableBlockText({ code: "MEMBER_IN_GAME", names: ["Marly", "Zoé"] })).toBe("Marly and Zoé are in a game.")
    expect(tableBlock(group({ offline: ["Zoé"] }), { min: 2, max: 4 })).toEqual({ code: "MEMBER_OFFLINE", names: ["Zoé"] })
    expect(tableBlockText({ code: "MEMBER_OFFLINE", names: ["Zoé"] })).toBe("Zoé is offline.")
    expect(tableBlockText({ code: "MEMBER_OFFLINE", names: ["Ann", "Bob", "Cat"] })).toBe("Ann, Bob and Cat are offline.")
  })

  it("says the reasons in order: not the leader, too small, in a game, offline", () => {
    const all = group({ size: 1, inGame: ["Marly"], offline: ["Zoé"], leads: false })
    expect(tableBlock(all, { min: 2, max: 4 })?.code).toBe("NOT_LEADER")
    expect(tableBlock({ ...all, leads: true }, { min: 2, max: 4 })?.code).toBe("GROUP_TOO_SMALL")
    expect(tableBlock({ ...all, leads: true, size: 3 }, { min: 2, max: 4 })?.code).toBe("MEMBER_IN_GAME")
    expect(tableBlock({ ...all, leads: true, size: 3, inGame: [] }, { min: 2, max: 4 })?.code).toBe("MEMBER_OFFLINE")
  })
})
