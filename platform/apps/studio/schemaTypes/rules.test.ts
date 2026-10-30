import type { ValidationContext } from "sanity"
import { describe, expect, it } from "vitest"
import { checkCreatorsOnce, checkEndsAfterStart, checkName, checkNotItself, checkPlayersMax, checkSlug } from "./rules"

/** What the Studio hands a rule: the document being edited, which is not there when a seed checks the rule. */
const within = (document?: Record<string, unknown>) => ({ document }) as unknown as ValidationContext

const reference = (id: string) => ({ _type: "reference", _ref: id })

describe("checkName", () => {
  it("accepts a name, and no name at all (required() asks for it)", () => {
    expect(checkName("Flip 7")).toBe(true)
    expect(checkName(undefined)).toBe(true)
  })

  it("refuses an empty name, a name over 60 characters and one with a control character", () => {
    expect(checkName("   ")).toBe("The name is empty")
    expect(checkName("x".repeat(61))).toContain("60 at most")
    expect(checkName("Flip\u0007 7")).toContain("control character")
  })
})

describe("checkSlug", () => {
  it("accepts what a game's slug can be", () => {
    expect(checkSlug({ current: "flip-7" })).toBe(true)
    expect(checkSlug(undefined)).toBe(true)
  })

  it("refuses what is not one: capitals, spaces, a route of the site, a slug that is too long", () => {
    expect(checkSlug({ current: "Flip 7" })).toContain("is not a slug")
    expect(checkSlug({ current: "api" })).toContain("a route of the site")
    expect(checkSlug({ current: "a".repeat(41) })).toContain("40 at most")
  })
})

describe("checkNotItself", () => {
  const check = checkNotItself("not itself")

  it("refuses a game that points at itself, published or draft, alone or in a list", () => {
    expect(check(reference("game-a"), within({ _id: "game-a" }))).toBe("not itself")
    expect(check(reference("game-a"), within({ _id: "drafts.game-a" }))).toBe("not itself")
    expect(check([reference("game-b"), reference("game-a")], within({ _id: "drafts.game-a" }))).toBe("not itself")
  })

  it("accepts a game that points at others, at nothing, or when there is no document to compare with", () => {
    expect(check(reference("game-b"), within({ _id: "game-a" }))).toBe(true)
    expect(check([reference("game-b"), reference("game-c")], within({ _id: "game-a" }))).toBe(true)
    expect(check(undefined, within({ _id: "game-a" }))).toBe(true)
    expect(check(reference("game-a"), within())).toBe(true)
  })
})

describe("checkCreatorsOnce", () => {
  const line = (id: string, key: string) => ({ _key: key, _type: "gameCreator", creator: reference(id), roles: ["designer"] })

  it("accepts a list where each person is on one line, and an empty one", () => {
    expect(checkCreatorsOnce([line("creator-a", "1"), line("creator-b", "2")])).toBe(true)
    expect(checkCreatorsOnce([])).toBe(true)
    expect(checkCreatorsOnce(undefined)).toBe(true)
  })

  it("refuses a person on two lines, and says to give their roles on one", () => {
    expect(checkCreatorsOnce([line("creator-a", "1"), line("creator-b", "2"), line("creator-a", "3")])).toContain("give them all their roles there")
  })

  it("leaves a line that has no creator yet to required()", () => {
    expect(checkCreatorsOnce([{ _key: "1", _type: "gameCreator", roles: ["designer"] }, { _key: "2", _type: "gameCreator", roles: ["artist"] }])).toBe(true)
  })
})

describe("checkPlayersMax", () => {
  it("refuses a maximum under the minimum", () => {
    expect(checkPlayersMax(2, within({ playersMin: 3 }))).toBe("The maximum is under the minimum")
  })

  it("accepts an equal or higher maximum, no maximum (or more), no minimum, and no document", () => {
    expect(checkPlayersMax(3, within({ playersMin: 3 }))).toBe(true)
    expect(checkPlayersMax(5, within({ playersMin: 3 }))).toBe(true)
    expect(checkPlayersMax(undefined, within({ playersMin: 3 }))).toBe(true)
    expect(checkPlayersMax(2, within({}))).toBe(true)
    expect(checkPlayersMax(2, within())).toBe(true)
  })
})

describe("checkEndsAfterStart", () => {
  it("refuses an end that is not after the start", () => {
    expect(checkEndsAfterStart("2026-10-30T10:00:00Z", within({ startsAt: "2026-10-30T10:00:00Z" }))).toBe("It ends before it starts")
    expect(checkEndsAfterStart("2026-10-29T10:00:00Z", within({ startsAt: "2026-10-30T10:00:00Z" }))).toBe("It ends before it starts")
  })

  it("accepts a later end, no end, no start, and no document", () => {
    expect(checkEndsAfterStart("2026-10-31T10:00:00Z", within({ startsAt: "2026-10-30T10:00:00Z" }))).toBe(true)
    expect(checkEndsAfterStart(undefined, within({ startsAt: "2026-10-30T10:00:00Z" }))).toBe(true)
    expect(checkEndsAfterStart("2026-10-29T10:00:00Z", within({}))).toBe(true)
    expect(checkEndsAfterStart("2026-10-29T10:00:00Z", within())).toBe(true)
  })
})
