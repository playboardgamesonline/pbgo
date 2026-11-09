import { describe, expect, it } from "vitest"
import {
  BIRTHDATE_KEY,
  COUNTRY_CODES,
  COUNTRY_KEY,
  MAXIMUM_AGE,
  MINIMUM_AGE,
  ageOn,
  birthYearOf,
  birthdateFields,
  birthdateOf,
  birthdateOfParts,
  calendarDateOf,
  checkBirthdate,
  checkCountry,
  countryName,
  countryOf,
  countryOptions,
  isCountryCode,
} from "./details"

// The day the form is judged on: the tests never read the clock
const TODAY = { year: 2026, month: 11, day: 9 }

describe("the keys that are ours", () => {
  it("carry the namespace of the platform, which a provider never writes", () => {
    expect(COUNTRY_KEY).toMatch(/^pbgo_/)
    expect(BIRTHDATE_KEY).toMatch(/^pbgo_/)
    expect(COUNTRY_KEY).not.toBe(BIRTHDATE_KEY)
  })
})

describe("the countries", () => {
  it("are the 249 of ISO 3166-1 and Kosovo's XK, each once, as two upper-case letters", () => {
    expect(COUNTRY_CODES).toHaveLength(250)
    expect(new Set(COUNTRY_CODES).size).toBe(250)
    for (const code of COUNTRY_CODES) expect(code).toMatch(/^[A-Z]{2}$/)
    expect(COUNTRY_CODES).toContain("XK")
  })

  it("all have an English name that this runtime knows: a code that is a typing mistake would be its own name", () => {
    for (const code of COUNTRY_CODES) expect(countryName(code), code).not.toBe(code)
    expect(countryName("FR")).toBe("France")
    expect(countryName("GB")).toBe("United Kingdom")
    expect(countryName("XK")).toBe("Kosovo")
  })

  it("are listed by their name, each code once", () => {
    const options = countryOptions()
    expect(options).toHaveLength(COUNTRY_CODES.length)
    expect(options[0]).toEqual({ code: "AF", name: "Afghanistan" })
    const names = options.map((option) => option.name)
    expect(names).toEqual([...names].sort((a, b) => new Intl.Collator("en").compare(a, b)))
    expect(options.find((option) => option.code === "FR")).toEqual({ code: "FR", name: "France" })
  })

  it("are recognised by their code, in upper case", () => {
    expect(isCountryCode("FR")).toBe(true)
    expect(isCountryCode("fr")).toBe(false)
    expect(isCountryCode("FRA")).toBe(false)
    expect(isCountryCode("ZZ")).toBe(false)
    expect(isCountryCode(33)).toBe(false)
    expect(isCountryCode(null)).toBe(false)
  })
})

describe("countryOf", () => {
  it("is the country the account keeps", () => {
    expect(countryOf({ user_metadata: { pbgo_country: "FR" } })).toBe("FR")
  })

  it("is null when the account keeps none, or something that is not a country: the member can write their own metadata", () => {
    expect(countryOf({})).toBeNull()
    expect(countryOf({ user_metadata: null })).toBeNull()
    expect(countryOf({ user_metadata: { pbgo_country: "france" } })).toBeNull()
    expect(countryOf({ user_metadata: { pbgo_country: "ZZ" } })).toBeNull()
    expect(countryOf({ user_metadata: { pbgo_country: 33 } })).toBeNull()
    expect(countryOf({ user_metadata: { country: "FR", locale: "fr-FR" } })).toBeNull()
  })
})

describe("birthdateOf", () => {
  it("is the date the account keeps, in the shape it is kept in", () => {
    expect(birthdateOf({ user_metadata: { pbgo_birthdate: "1994-06-18" } })).toBe("1994-06-18")
    expect(birthdateOf({ user_metadata: { pbgo_birthdate: "2000-02-29" } })).toBe("2000-02-29")
  })

  it("is null when there is none, when it is not a day that exists, or when it is not in the shape", () => {
    expect(birthdateOf({})).toBeNull()
    expect(birthdateOf({ user_metadata: { pbgo_birthdate: "1994-02-30" } })).toBeNull()
    expect(birthdateOf({ user_metadata: { pbgo_birthdate: "1900-02-29" } })).toBeNull()
    expect(birthdateOf({ user_metadata: { pbgo_birthdate: "1994-13-01" } })).toBeNull()
    expect(birthdateOf({ user_metadata: { pbgo_birthdate: "18/06/1994" } })).toBeNull()
    expect(birthdateOf({ user_metadata: { pbgo_birthdate: "1994-6-18" } })).toBeNull()
    expect(birthdateOf({ user_metadata: { pbgo_birthdate: " 1994-06-18" } })).toBeNull()
    expect(birthdateOf({ user_metadata: { pbgo_birthdate: 19940618 } })).toBeNull()
    expect(birthdateOf({ user_metadata: { birthdate: "1994-06-18", birthday: "1994-06-18" } })).toBeNull()
  })

  it("does not judge the limits of the form, which know what day it is: those are `checkBirthdate`'s", () => {
    expect(birthdateOf({ user_metadata: { pbgo_birthdate: "2050-01-01" } })).toBe("2050-01-01")
  })
})

describe("the parts of a date", () => {
  it("make the date as it is kept, and take it apart again for the form", () => {
    expect(birthdateOfParts({ year: 1994, month: 6, day: 8 })).toBe("1994-06-08")
    expect(birthdateFields("1994-06-08")).toEqual({ day: "8", month: "6", year: "1994" })
    expect(birthdateFields(null)).toEqual({ day: "", month: "", year: "" })
    expect(birthYearOf("1994-06-08")).toBe(1994)
  })

  it("read the day on the calendar of the device that made the `Date`", () => {
    expect(calendarDateOf(new Date(2026, 10, 9, 23, 59))).toEqual({ year: 2026, month: 11, day: 9 })
    expect(calendarDateOf(new Date(2026, 0, 1, 0, 0))).toEqual({ year: 2026, month: 1, day: 1 })
  })

  it("count whole years, a birthday counting on its day and not before", () => {
    expect(ageOn({ year: 2013, month: 11, day: 9 }, TODAY)).toBe(13)
    expect(ageOn({ year: 2013, month: 11, day: 10 }, TODAY)).toBe(12)
    expect(ageOn({ year: 2013, month: 12, day: 31 }, TODAY)).toBe(12)
    expect(ageOn({ year: 2013, month: 1, day: 1 }, TODAY)).toBe(13)
    expect(ageOn({ year: 1994, month: 6, day: 18 }, TODAY)).toBe(32)
    expect(ageOn({ year: 2026, month: 11, day: 10 }, TODAY)).toBe(-1)
  })
})

describe("checkBirthdate", () => {
  const check = (day: string, month: string, year: string, today = TODAY) => checkBirthdate({ day, month, year }, today)

  it("keeps a date that exists, in the shape it is kept in, with the blanks taken off", () => {
    expect(check("18", "6", "1994")).toEqual({ ok: true, birthdate: "1994-06-18" })
    expect(check(" 08 ", "06", " 1994 ")).toEqual({ ok: true, birthdate: "1994-06-08" })
    expect(check("29", "2", "2000")).toEqual({ ok: true, birthdate: "2000-02-29" })
  })

  it("takes the date away when the three fields are empty: it is optional", () => {
    expect(check("", "", "")).toEqual({ ok: true, birthdate: null })
    expect(check("  ", " ", "")).toEqual({ ok: true, birthdate: null })
  })

  it("asks for all three, and points at the first that is missing", () => {
    expect(check("", "6", "1994")).toEqual({ ok: false, problem: "Enter the day, the month and the year.", field: "day" })
    expect(check("18", "", "1994")).toMatchObject({ ok: false, field: "month" })
    expect(check("18", "6", "")).toMatchObject({ ok: false, field: "year" })
  })

  it("wants numbers, and a year of four digits", () => {
    expect(check("1a", "6", "1994")).toEqual({ ok: false, problem: "Use numbers only for the day.", field: "day" })
    expect(check("18", "june", "1994")).toEqual({ ok: false, problem: "Use numbers only for the month.", field: "month" })
    expect(check("18", "6", "94")).toEqual({ ok: false, problem: "Write the year with four digits.", field: "year" })
    expect(check("18", "6", "19944")).toMatchObject({ ok: false, field: "year" })
    expect(check("-1", "6", "1994")).toMatchObject({ ok: false, field: "day" })
    expect(check("1.5", "6", "1994")).toMatchObject({ ok: false, field: "day" })
  })

  it("refuses a date that does not exist, the 29th of February of a year that has none included", () => {
    expect(check("31", "2", "1994")).toEqual({ ok: false, problem: "That date does not exist.", field: null })
    expect(check("29", "2", "2001")).toMatchObject({ ok: false, problem: "That date does not exist." })
    expect(check("0", "6", "1994")).toMatchObject({ ok: false, problem: "That date does not exist." })
    expect(check("18", "13", "1994")).toMatchObject({ ok: false, problem: "That date does not exist." })
    expect(check("31", "4", "1994")).toMatchObject({ ok: false, problem: "That date does not exist." })
  })

  it("refuses a date in the future", () => {
    expect(check("10", "11", "2026")).toEqual({ ok: false, problem: "That date is in the future.", field: "year" })
    expect(check("1", "1", "2027")).toMatchObject({ ok: false, problem: "That date is in the future." })
    expect(check("1", "1", "9999")).toMatchObject({ ok: false, problem: "That date is in the future." })
  })

  it("refuses a date further back than 120 years, and keeps the one that is exactly that old", () => {
    expect(MAXIMUM_AGE).toBe(120)
    expect(check("9", "11", "1906")).toEqual({ ok: true, birthdate: "1906-11-09" })
    expect(check("8", "11", "1905")).toEqual({ ok: false, problem: "That is more than 120 years ago. Check the year.", field: "year" })
    expect(check("8", "11", "1905").ok).toBe(false)
    expect(check("1", "1", "1000")).toMatchObject({ ok: false, field: "year" })
  })

  it("refuses a member who is younger than 13 in plain words, as the Terms ask, and keeps the one who turns 13 today", () => {
    expect(MINIMUM_AGE).toBe(13)
    expect(check("10", "11", "2013")).toEqual({ ok: false, problem: "You must be at least 13 to use the site.", field: null })
    expect(check("9", "11", "2013")).toEqual({ ok: true, birthdate: "2013-11-09" })
    expect(check("9", "11", "2026")).toMatchObject({ ok: false, problem: "You must be at least 13 to use the site." })
    expect(check("29", "2", "2016")).toMatchObject({ ok: false, problem: "You must be at least 13 to use the site." })
  })

  it("moves with the day it is judged on: a birthday only counts when it has come", () => {
    expect(check("29", "2", "2012", { year: 2025, month: 2, day: 28 })).toMatchObject({ ok: false, problem: "You must be at least 13 to use the site." })
    expect(check("29", "2", "2012", { year: 2025, month: 3, day: 1 })).toEqual({ ok: true, birthdate: "2012-02-29" })
  })

  it("never keeps a date that the reader would not read back", () => {
    for (const [day, month, year] of [["18", "6", "1994"], ["1", "1", "2000"], ["29", "2", "2000"], ["31", "12", "1999"]] as const) {
      const checked = check(day, month, year)
      if (!checked.ok) throw new Error("unexpected")
      expect(birthdateOf({ user_metadata: { pbgo_birthdate: checked.birthdate } })).toBe(checked.birthdate)
    }
  })
})

describe("checkCountry", () => {
  it("keeps the code of a country of the list, in upper case", () => {
    expect(checkCountry("FR")).toEqual({ ok: true, country: "FR" })
    expect(checkCountry(" de ")).toEqual({ ok: true, country: "DE" })
  })

  it("takes the country away when none is chosen: it is optional", () => {
    expect(checkCountry("")).toEqual({ ok: true, country: null })
    expect(checkCountry("   ")).toEqual({ ok: true, country: null })
  })

  it("refuses what is not a country of the list", () => {
    expect(checkCountry("ZZ")).toEqual({ ok: false, problem: "Choose a country or region from the list." })
    expect(checkCountry("France")).toMatchObject({ ok: false })
    expect(checkCountry("FRA")).toMatchObject({ ok: false })
  })
})
