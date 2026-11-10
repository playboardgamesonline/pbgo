import { describe, expect, it } from "vitest"
import { ASKABLE_TIERS, asksSomething, checkTableSettings, creationSettings, effectiveSettings, OPEN_TO_ANYONE, parseTableSettings, tierOf, unmetCriteria, UNMET_CODES, type TableSettings, type TableSettingsInput, type Viewer } from "./table-settings"

const limits = { min: 2, max: 5, seated: 1 }
const input = (over: Partial<Record<keyof TableSettingsInput, unknown>> = {}) => ({ visibility: "public", minRank: null, language: null, pace: "normal", seats: 4, ...over })

describe("parseTableSettings", () => {
  it("reads the settings a table keeps", () => {
    expect(parseTableSettings({ visibility: "public", minRank: "Silver", language: "fr", pace: "fast", seats: 3 })).toEqual({ visibility: "public", minRank: "Silver", language: "fr", pace: "fast", seats: 3 })
  })

  it("has nothing for a table that has none, and for what is not an object", () => {
    expect(parseTableSettings({})).toEqual({})
    for (const raw of [null, undefined, [], "public", 3, true]) expect(parseTableSettings(raw)).toEqual({})
  })

  it("leaves out a key that is not ours and a value that is not one of its kind", () => {
    expect(
      parseTableSettings({ visibility: "friends", minRank: "Apprentice", language: "en-GB", pace: "turbo", seats: 2.5, other: 1 }),
    ).toEqual({})
    expect(parseTableSettings({ visibility: "private", minRank: "Platinum", language: "klingon", seats: 99 })).toEqual({ visibility: "private", minRank: "Platinum" })
    expect(parseTableSettings({ seats: "3", pace: "async" })).toEqual({ pace: "async" })
  })
})

describe("checkTableSettings", () => {
  it("accepts the settings a host sends and keeps what asks for something", () => {
    expect(checkTableSettings(input({ minRank: "Gold", language: "de" }), limits)).toEqual({ ok: true, settings: { visibility: "public", minRank: "Gold", language: "de", pace: "normal", seats: 4 } })
  })

  it("does not write a rank or a language that asks for nothing", () => {
    expect(checkTableSettings(input({ visibility: "private" }), limits)).toEqual({ ok: true, settings: { visibility: "private", pace: "normal", seats: 4 } })
    expect(checkTableSettings(input({ minRank: undefined, language: undefined }), limits)).toEqual({ ok: true, settings: { visibility: "public", pace: "normal", seats: 4 } })
  })

  it("refuses what is not one of its kind", () => {
    const invalid = { ok: false, code: "INVALID_REQUEST" }
    expect(checkTableSettings(null, limits)).toEqual(invalid)
    expect(checkTableSettings([], limits)).toEqual(invalid)
    expect(checkTableSettings(input({ visibility: "friends" }), limits)).toEqual(invalid)
    expect(checkTableSettings(input({ visibility: undefined }), limits)).toEqual(invalid)
    // The lowest tier asks for nothing, so it is no choice
    expect(checkTableSettings(input({ minRank: "Apprentice" }), limits)).toEqual(invalid)
    expect(checkTableSettings(input({ minRank: "Mythic" }), limits)).toEqual(invalid)
    // English (UK) is a form of English: a table asks for English
    expect(checkTableSettings(input({ language: "en-GB" }), limits)).toEqual(invalid)
    expect(checkTableSettings(input({ language: "elvish" }), limits)).toEqual(invalid)
    expect(checkTableSettings(input({ pace: "turbo" }), limits)).toEqual(invalid)
    // A lobby is not set to the day-a-turn pace
    expect(checkTableSettings(input({ pace: "async" }), limits)).toEqual(invalid)
    expect(checkTableSettings(input({ seats: "4" }), limits)).toEqual(invalid)
    expect(checkTableSettings(input({ seats: 3.5 }), limits)).toEqual(invalid)
  })

  it("keeps the seats between the game's least and most players, and never under the people who sit", () => {
    const players = { ok: false, code: "INVALID_PLAYERS" }
    expect(checkTableSettings(input({ seats: 1 }), limits)).toEqual(players)
    expect(checkTableSettings(input({ seats: 6 }), limits)).toEqual(players)
    expect(checkTableSettings(input({ seats: 2 }), { ...limits, seated: 3 })).toEqual(players)
    expect(checkTableSettings(input({ seats: 3 }), { ...limits, seated: 3 })).toMatchObject({ ok: true })
    expect(checkTableSettings(input({ seats: 5 }), limits)).toMatchObject({ ok: true })
  })

  it("never goes over the most seats a table is drawn with", () => {
    expect(checkTableSettings(input({ seats: 16 }), { min: 2, max: 40, seated: 1 })).toEqual({ ok: false, code: "INVALID_PLAYERS" })
  })
})

describe("effectiveSettings", () => {
  it("is a private table of the usual speed and the game's seats for a table that never had settings", () => {
    expect(effectiveSettings({}, 5)).toEqual({ visibility: "private", minRank: null, language: null, pace: "normal", seats: 5 })
  })

  it("puts what the table keeps over it, with the seats kept within the game's", () => {
    expect(effectiveSettings({ visibility: "public", minRank: "Gold", language: "fr", pace: "slow", seats: 3 }, 5)).toEqual({ visibility: "public", minRank: "Gold", language: "fr", pace: "slow", seats: 3 })
    expect(effectiveSettings({ seats: 9 }, 5).seats).toBe(5)
    expect(effectiveSettings({}, 0).seats).toBe(1)
  })
})

describe("tierOf", () => {
  it("is the tier of a rank, and the lowest for a player who has none", () => {
    expect(tierOf({ tier: "Gold" })).toBe("Gold")
    expect(tierOf(null)).toBe("Apprentice")
    expect(tierOf(undefined)).toBe("Apprentice")
  })
})

describe("unmetCriteria", () => {
  const viewer = (over: Partial<Viewer> = {}): Viewer => ({ tier: "Silver", language: "en", ...over })
  const table = (over: Partial<TableSettings> = {}): TableSettings => ({ visibility: "public", ...over })

  it("asks nothing of a visitor at a table that asks for nothing", () => {
    expect(unmetCriteria(table(), viewer({ tier: "Apprentice" }))).toBeNull()
    expect(unmetCriteria({}, viewer())).toBeNull()
  })

  it("only a public table asks for something", () => {
    expect(unmetCriteria({ visibility: "private", minRank: "Legend", language: "fr" }, viewer({ tier: "Apprentice" }))).toBeNull()
    expect(unmetCriteria({ minRank: "Legend" }, viewer({ tier: "Apprentice" }))).toBeNull()
  })

  it("compares the rank by tier: the asked one and the ones above it meet it", () => {
    expect(unmetCriteria(table({ minRank: "Silver" }), viewer({ tier: "Bronze" }))).toBe("rank")
    expect(unmetCriteria(table({ minRank: "Silver" }), viewer({ tier: "Silver" }))).toBeNull()
    expect(unmetCriteria(table({ minRank: "Silver" }), viewer({ tier: "Legend" }))).toBeNull()
    expect(unmetCriteria(table({ minRank: "Bronze" }), viewer({ tier: tierOf(null) }))).toBe("rank")
  })

  it("compares the language by its base form: English (UK) speaks English", () => {
    expect(unmetCriteria(table({ language: "fr" }), viewer({ language: "en" }))).toBe("language")
    expect(unmetCriteria(table({ language: "fr" }), viewer({ language: "fr" }))).toBeNull()
    expect(unmetCriteria(table({ language: "en" }), viewer({ language: "en-GB" }))).toBeNull()
  })

  it("says the rank first when both are missing, and each has its code", () => {
    expect(unmetCriteria(table({ minRank: "Gold", language: "fr" }), viewer({ tier: "Bronze", language: "en" }))).toBe("rank")
    expect(UNMET_CODES).toEqual({ rank: "RANK_TOO_LOW", language: "LANGUAGE_MISMATCH" })
  })
})

describe("asksSomething", () => {
  it("is a public table with a rank or a language", () => {
    expect(asksSomething({ visibility: "public", minRank: "Gold" })).toBe(true)
    expect(asksSomething({ visibility: "public", language: "fr" })).toBe(true)
    expect(asksSomething({ visibility: "public" })).toBe(false)
    expect(asksSomething({ visibility: "private", minRank: "Gold" })).toBe(false)
    expect(asksSomething({})).toBe(false)
  })
})

describe("ASKABLE_TIERS", () => {
  it("is every tier but the lowest", () => {
    expect(ASKABLE_TIERS).not.toContain("Apprentice")
    expect(ASKABLE_TIERS[0]).toBe("Bronze")
    expect(ASKABLE_TIERS.at(-1)).toBe("Legend")
  })
})

describe("creationSettings", () => {
  const range = { min: 2, max: 5 }

  it("is what the space that opens a table shows: public, nothing asked, the usual speed and the game's most seats", () => {
    expect(creationSettings(OPEN_TO_ANYONE, "normal", null, range)).toEqual({ visibility: "public", minRank: null, language: null, pace: "normal", seats: 5 })
  })

  it("takes what the host picked, and what it makes is what the server accepts", () => {
    const made = creationSettings({ visibility: "private", minRank: "Gold", language: "fr" }, "fast", 3, range)
    expect(made).toEqual({ visibility: "private", minRank: "Gold", language: "fr", pace: "fast", seats: 3 })
    expect(checkTableSettings(made, { min: 2, max: 5, seated: 1 })).toMatchObject({ ok: true })
  })

  it("brings the number of players back between the game's least and most", () => {
    expect(creationSettings(OPEN_TO_ANYONE, "normal", 1, range).seats).toBe(2)
    expect(creationSettings(OPEN_TO_ANYONE, "normal", 9, range).seats).toBe(5)
  })

  it("leaves out a language that is not one the lobby offers and a speed it does not offer", () => {
    expect(creationSettings({ visibility: "public", minRank: null, language: "klingon" }, "async", null, range)).toMatchObject({ language: null, pace: "normal" })
    expect(creationSettings({ visibility: "public", minRank: null, language: "en-GB" }, "normal", null, range).language).toBeNull()
  })
})
