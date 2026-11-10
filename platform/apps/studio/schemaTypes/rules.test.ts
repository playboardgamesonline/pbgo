import type { ValidationContext } from "sanity"
import { describe, expect, it } from "vitest"
import { checkCreatorsOnce, checkDescriptions, checkEndsAfterStart, checkExpansionSlug, checkHelperKey, checkHelpersOnce, checkName, checkNameTranslations, checkNotItself, checkPlayersMax, checkRows, checkSlug, checkTranslations, isFilled } from "./rules"

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

describe("checkExpansionSlug", () => {
  it("accepts what an expansion's slug can be: a game's, and one up to 48 characters long, which starts with its base game's", () => {
    expect(checkExpansionSlug({ current: "flip-7-more" })).toBe(true)
    expect(checkExpansionSlug({ current: "the-werewolves-of-millers-hollow-the-village" })).toBe(true)
    expect(checkExpansionSlug({ current: "a".repeat(48) })).toBe(true)
    expect(checkExpansionSlug(undefined)).toBe(true)
  })

  it("refuses what is not one: capitals, a route of the site, a slug over 48 characters", () => {
    expect(checkExpansionSlug({ current: "More Cards" })).toContain("is not a slug")
    expect(checkExpansionSlug({ current: "api" })).toContain("a route of the site")
    expect(checkExpansionSlug({ current: "a".repeat(49) })).toContain("48 at most")
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

describe("checkHelperKey", () => {
  it.each(["show-score", "hints", "last-played-card", "a1", "x"])("accepts %s", (key) => {
    expect(checkHelperKey(key)).toBe(true)
  })

  it("leaves an empty key to required()", () => {
    expect(checkHelperKey(undefined)).toBe(true)
  })

  it.each(["Show-score", "show score", "show_score", "-show", "show-", "show--score", "scoré", "", "a".repeat(41)])("refuses %j and says what a key is", (key) => {
    expect(checkHelperKey(key)).toContain("owercase")
  })
})

describe("checkHelpersOnce", () => {
  const helper = (key: string) => ({ _key: key, _type: "gameHelper", title: key, key })

  it("accepts helpers with a key each, and none at all", () => {
    expect(checkHelpersOnce([helper("show-score"), helper("hints")])).toBe(true)
    expect(checkHelpersOnce([])).toBe(true)
    expect(checkHelpersOnce(undefined)).toBe(true)
  })

  it("refuses two helpers with one key", () => {
    expect(checkHelpersOnce([helper("show-score"), helper("hints"), helper("show-score")])).toContain("give each its own")
  })

  it("leaves a helper that has no key yet to required()", () => {
    expect(checkHelpersOnce([{ _key: "1", _type: "gameHelper", title: "A" }, { _key: "2", _type: "gameHelper", title: "B" }])).toBe(true)
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

// The translated fields: rows `{ _key, language, value }`, a row per language.
const row = (language: string, value?: unknown) => ({ _key: language, _type: "internationalizedArrayStringValue", language, ...(value === undefined ? {} : { value }) })
const picture = (id = "image-abc-10x10-webp") => ({ _type: "image", asset: { _type: "reference", _ref: id } })

describe("isFilled", () => {
  it("is true for a text that is not blank and for a picture that has its file", () => {
    expect(isFilled("A game")).toBe(true)
    expect(isFilled(picture())).toBe(true)
  })

  it("is false for nothing, a blank text, and a picture without a file (a hotspot alone)", () => {
    for (const value of [undefined, null, "", "   ", {}, { _type: "image" }, { _type: "image", hotspot: { x: 0.5, y: 0.5 } }, { _type: "image", asset: { _type: "reference" } }, { _type: "image", asset: { _ref: "" } }]) {
      expect(isFilled(value), JSON.stringify(value)).toBe(false)
    }
  })
})

describe("checkRows", () => {
  it("accepts no rows, and one row for each of the languages of the platform", () => {
    expect(checkRows(undefined)).toBe(true)
    expect(checkRows([])).toBe(true)
    expect(checkRows([row("en", "A"), row("fr", "B"), row("ko", "C")])).toBe(true)
    expect(checkRows([row("en", "A"), row("en-GB", "B"), row("fr", "C")])).toBe(true)
  })

  it("refuses a language the platform does not have, and says which row it is", () => {
    expect(checkRows([row("en", "A"), row("it", "B")])).toEqual({ message: '"it" is not a language of the platform', paths: [[{ _key: "it" }]] })
  })

  it("refuses a row with no language, the old format of the plugin", () => {
    expect(checkRows([{ _key: "en", value: "A" }])).toEqual({ message: "A row has no language", paths: [[{ _key: "en" }]] })
  })

  it("refuses two rows of one language, and points at the second", () => {
    expect(checkRows([row("en", "A"), { ...row("fr", "B"), _key: "first" }, { ...row("fr", "C"), _key: "second" }])).toEqual({ message: "There can only be one row per language", paths: [[{ _key: "second" }]] })
  })
})

describe("checkTranslations", () => {
  it("accepts a field with no value, an empty English row (the one every field has), and English alone", () => {
    expect(checkTranslations(undefined)).toBe(true)
    expect(checkTranslations([row("en")])).toBe(true)
    expect(checkTranslations([row("en", "A game")])).toBe(true)
  })

  it("accepts other languages once English has a value, in any order of the rows", () => {
    expect(checkTranslations([row("en", "A game"), row("fr", "Un jeu"), row("ja", "ゲーム")])).toBe(true)
    expect(checkTranslations([row("fr", "Un jeu"), row("en", "A game")])).toBe(true)
  })

  it("refuses a language that has a value when English has none, and points at the value of English", () => {
    expect(checkTranslations([row("en"), row("fr", "Un jeu")])).toEqual({ message: "Fill English (US) first: it is what every other language falls back on", paths: [[{ _key: "en" }, "value"]] })
    expect(checkTranslations([row("en", "   "), row("fr", "Un jeu")])).toMatchObject({ paths: [[{ _key: "en" }, "value"]] })
  })

  it("treats English (UK) as any other language: it may have a value once English (US) has one, and not before", () => {
    expect(checkTranslations([row("en", "Color"), row("en-GB", "Colour")])).toBe(true)
    expect(checkTranslations([row("en"), row("en-GB", "Colour")])).toEqual({ message: "Fill English (US) first: it is what every other language falls back on", paths: [[{ _key: "en" }, "value"]] })
  })

  it("points at the first value when there is no row of English at all", () => {
    expect(checkTranslations([row("es", "Un juego"), row("fr", "Un jeu")])).toMatchObject({ paths: [[{ _key: "es" }, "value"]] })
  })

  it("accepts empty rows of other languages, with a value in English or with none at all", () => {
    expect(checkTranslations([row("en", "A"), row("fr")])).toBe(true)
    expect(checkTranslations([row("en"), row("fr")])).toBe(true)
  })

  it("holds for pictures as for texts: a file in French needs one in English", () => {
    expect(checkTranslations([row("en", picture()), row("fr", picture("image-def-20x20-png"))])).toBe(true)
    expect(checkTranslations([row("en", { _type: "image" }), row("fr", picture())])).toMatchObject({ message: expect.stringContaining("Fill English (US) first") })
  })

  it("keeps the rules of the rows: a language that is not one, a language twice", () => {
    expect(checkTranslations([row("en", "A"), row("xx", "B")])).toMatchObject({ message: '"xx" is not a language of the platform' })
    expect(checkTranslations([row("en", "A"), { ...row("en", "B"), _key: "again" }])).toMatchObject({ message: "There can only be one row per language" })
  })

  it("is not fooled by what is not a list of rows", () => {
    expect(checkTranslations("a text")).toBe(true)
    expect(checkTranslations([null, "x", 3])).toBe(true)
  })
})

describe("checkDescriptions", () => {
  it("accepts no description, an empty English row, and a description of 240 characters at most in each language", () => {
    expect(checkDescriptions(undefined)).toBe(true)
    expect(checkDescriptions([row("en")])).toBe(true)
    expect(checkDescriptions([row("en", "a".repeat(240)), row("fr", "b".repeat(240))])).toBe(true)
  })

  it("refuses a language over 240 characters, says how long it is, and points at the value of that row", () => {
    expect(checkDescriptions([row("en", "a".repeat(240)), row("fr", "b".repeat(241))])).toEqual({
      message: "A description is 240 characters at most (this one has 241)",
      paths: [[{ _key: "fr" }, "value"]],
    })
  })

  it("keeps the rules of the translations: English first, one row per language", () => {
    expect(checkDescriptions([row("en"), row("fr", "Un jeu")])).toMatchObject({ message: expect.stringContaining("Fill English (US) first") })
    expect(checkDescriptions([row("en", "A"), { ...row("en", "B"), _key: "again" }])).toMatchObject({ message: "There can only be one row per language" })
  })
})

describe("checkNameTranslations", () => {
  it("accepts names in the other languages, and an empty row of English", () => {
    expect(checkNameTranslations(undefined)).toBe(true)
    expect(checkNameTranslations([row("en")])).toBe(true)
    expect(checkNameTranslations([row("en"), row("fr", "Les Loups-garous de Thiercelieux"), row("ja", "汝は人狼なりや？")])).toBe(true)
  })

  it("refuses a name in English: the English name is the Name of the document", () => {
    expect(checkNameTranslations([row("en", "Werewolves")])).toEqual({ message: "English (US) is the Name above: leave this row empty", paths: [[{ _key: "en" }, "value"]] })
  })

  it("accepts a name in English (UK), for a game that is called otherwise there", () => {
    expect(checkNameTranslations([row("en"), row("en-GB", "Catan")])).toBe(true)
  })

  it("keeps the rules of the rows", () => {
    expect(checkNameTranslations([row("en"), row("fr", "A"), { ...row("fr", "B"), _key: "again" }])).toMatchObject({ message: "There can only be one row per language" })
  })
})
