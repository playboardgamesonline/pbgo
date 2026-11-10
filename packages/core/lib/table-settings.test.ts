import { describe, expect, it } from "vitest"
import {
  ASKABLE_TIERS,
  asksSomething,
  checkTableSettings,
  creationSettings,
  defaultSeats,
  effectiveSettings,
  isLocked,
  modeOf,
  OPEN_TO_ANYONE,
  parseTableSettings,
  RANK_GAP_BASE,
  RANK_GAP_STEP_MS,
  rankGap,
  tierOf,
  unmetCriteria,
  UNMET_CODES,
  visibilityOf,
  withinRankGap,
  type TableSettings,
  type TableSettingsInput,
  type Viewer,
} from "./table-settings"

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

describe("visibilityOf", () => {
  it("is what the host set", () => {
    expect(visibilityOf({ visibility: "public" })).toBe("public")
    expect(visibilityOf({ visibility: "private" })).toBe("private")
  })

  it("is private for a table that kept no setting, whatever else it kept", () => {
    expect(visibilityOf({})).toBe("private")
    expect(visibilityOf(undefined)).toBe("private")
    expect(visibilityOf({ pace: "fast", seats: 3 } as TableSettings)).toBe("private")
  })

  it("agrees with the settings the lobby shows", () => {
    for (const settings of [{}, { visibility: "public" as const }, { visibility: "private" as const }]) expect(visibilityOf(settings)).toBe(effectiveSettings(settings, 5).visibility)
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
    expect(UNMET_CODES).toEqual({ rank: "RANK_TOO_LOW", language: "LANGUAGE_MISMATCH", gap: "RANK_GAP" })
  })

  it("keeps a ranked table to the tiers near the one it opened at, more of them the longer it has waited", () => {
    const ranked = table({ ranked: true, anchor: "Gold" })
    expect(unmetCriteria(ranked, viewer({ tier: "Gold" }))).toBeNull()
    expect(unmetCriteria(ranked, viewer({ tier: "Silver" }))).toBeNull()
    expect(unmetCriteria(ranked, viewer({ tier: "Platinum" }))).toBeNull()
    expect(unmetCriteria(ranked, viewer({ tier: "Bronze" }))).toBe("gap")
    expect(unmetCriteria(ranked, viewer({ tier: "Diamond" }))).toBe("gap")
    // Thirty seconds later it takes one more tier on each side, and in the end anybody
    expect(unmetCriteria(ranked, viewer({ tier: "Bronze" }), RANK_GAP_STEP_MS)).toBeNull()
    expect(unmetCriteria(ranked, viewer({ tier: "Apprentice" }), RANK_GAP_STEP_MS)).toBe("gap")
    expect(unmetCriteria(ranked, viewer({ tier: "Apprentice" }), 8 * RANK_GAP_STEP_MS)).toBeNull()
    expect(unmetCriteria(ranked, viewer({ tier: "Legend" }), 8 * RANK_GAP_STEP_MS)).toBeNull()
  })

  it("asks no gap of a table that is not ranked, nor of a ranked one that kept no tier", () => {
    expect(unmetCriteria(table({ anchor: "Gold" }), viewer({ tier: "Apprentice" }))).toBeNull()
    expect(unmetCriteria(table({ ranked: true }), viewer({ tier: "Apprentice" }))).toBeNull()
  })
})

describe("the rank gap", () => {
  it("is one tier at first and one more for each step of waiting", () => {
    expect(rankGap(0)).toBe(RANK_GAP_BASE)
    expect(rankGap(RANK_GAP_STEP_MS - 1)).toBe(RANK_GAP_BASE)
    expect(rankGap(RANK_GAP_STEP_MS)).toBe(RANK_GAP_BASE + 1)
    expect(rankGap(3 * RANK_GAP_STEP_MS + 5)).toBe(RANK_GAP_BASE + 3)
  })

  it("never goes under the first gap, whatever the clock says", () => {
    for (const waited of [-1, -RANK_GAP_STEP_MS, Number.NaN, Number.POSITIVE_INFINITY * 0]) expect(rankGap(waited)).toBe(RANK_GAP_BASE)
  })

  it("is measured in tiers between two players, in either direction", () => {
    expect(withinRankGap("Gold", "Silver", 0)).toBe(true)
    expect(withinRankGap("Silver", "Gold", 0)).toBe(true)
    expect(withinRankGap("Gold", "Apprentice", 0)).toBe(false)
    expect(withinRankGap("Apprentice", "Gold", 2 * RANK_GAP_STEP_MS)).toBe(true)
  })
})

describe("a ranked table", () => {
  it("is read back from what it kept: it is ranked, and has the tier it opened at", () => {
    expect(parseTableSettings({ visibility: "public", ranked: true, anchor: "Gold", seats: 3 })).toEqual({ visibility: "public", ranked: true, anchor: "Gold", seats: 3 })
  })

  it("keeps nothing that is not a ranked table's: only `true` says ranked, and the tier is one of ours", () => {
    expect(parseTableSettings({ ranked: false, anchor: "Mythic" })).toEqual({})
    expect(parseTableSettings({ ranked: "yes", anchor: 3 })).toEqual({})
    // The lowest tier is a tier a table opens at, though no table asks for it
    expect(parseTableSettings({ ranked: true, anchor: "Apprentice" })).toEqual({ ranked: true, anchor: "Apprentice" })
  })

  it("counts as ranked and is fixed; every other table counts as normal and may be changed", () => {
    expect([modeOf({ ranked: true }), isLocked({ ranked: true })]).toEqual(["ranked", true])
    expect([modeOf({}), isLocked({})]).toEqual(["normal", false])
    expect([modeOf({ ranked: false }), isLocked({ ranked: false })]).toEqual(["normal", false])
  })

  it("asks something of whoever sits, since it looks at their tier", () => {
    expect(asksSomething({ visibility: "public", ranked: true })).toBe(true)
    expect(asksSomething({ visibility: "public" })).toBe(false)
  })
})

describe("defaultSeats", () => {
  it("is the value between the game's least and most players", () => {
    expect(defaultSeats(2, 4)).toBe(3)
    expect(defaultSeats(2, 6)).toBe(4)
    expect(defaultSeats(3, 5)).toBe(4)
    expect(defaultSeats(1, 8)).toBe(4)
  })

  it("is the lower one when there is none in the middle, and the only one for a game that takes one count", () => {
    expect(defaultSeats(2, 3)).toBe(2)
    expect(defaultSeats(2, 5)).toBe(3)
    expect(defaultSeats(2, 2)).toBe(2)
    expect(defaultSeats(4, 4)).toBe(4)
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
