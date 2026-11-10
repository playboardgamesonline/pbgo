import { describe, expect, it } from "vitest"
import { OLDEST_AGE, RESTRICTED_FROM, SITE_MINIMUM_AGE, ageInYears, ageOn, ageRefusal, birthdateProblem, isRealDay, restrictedAge, utcDayOf, type AgeSubject } from "./age"

const at = (iso: string) => new Date(iso)

describe("restrictedAge", () => {
  it("enforces the minimum age of a game from 16 up, and the number of the game is the age that is asked", () => {
    expect(RESTRICTED_FROM).toBe(16)
    expect(restrictedAge(16)).toBe(16)
    expect(restrictedAge(17)).toBe(17)
    expect(restrictedAge(18)).toBe(18)
    expect(restrictedAge(21)).toBe(21)
  })

  it("leaves the ages below 16 as advice: the site's own minimum, 13, is the only one they ask", () => {
    for (const age of [0, 6, 8, 10, 12, 13, 14, 15]) expect(restrictedAge(age), String(age)).toBeNull()
  })

  it("asks nothing of a game that says no age", () => {
    expect(restrictedAge(null)).toBeNull()
    expect(restrictedAge(undefined)).toBeNull()
    expect(restrictedAge(Number.NaN)).toBeNull()
    expect(restrictedAge(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it("rounds a fractional age up to a whole year, which is the stricter way", () => {
    expect(restrictedAge(17.2)).toBe(18)
    expect(restrictedAge(15.5)).toBeNull()
  })
})

describe("ageInYears", () => {
  it("counts a birthday on its day, and not before: the day before is still the younger age", () => {
    expect(ageInYears("2008-11-09", at("2026-11-08T23:59:59Z"))).toBe(17)
    expect(ageInYears("2008-11-09", at("2026-11-09T00:00:00Z"))).toBe(18)
    expect(ageInYears("2008-11-09", at("2026-11-09T23:59:59Z"))).toBe(18)
  })

  it("counts in whole years across the months of the year", () => {
    expect(ageInYears("2000-06-15", at("2026-06-14T12:00:00Z"))).toBe(25)
    expect(ageInYears("2000-06-15", at("2026-06-15T12:00:00Z"))).toBe(26)
    expect(ageInYears("2000-06-15", at("2026-12-31T12:00:00Z"))).toBe(26)
    expect(ageInYears("2000-12-31", at("2026-01-01T00:00:00Z"))).toBe(25)
  })

  it("counts a 29 February on the 1st of March in a year that has none, and on the 29th in a leap year", () => {
    expect(ageInYears("2000-02-29", at("2023-02-28T12:00:00Z"))).toBe(22)
    expect(ageInYears("2000-02-29", at("2023-03-01T00:00:00Z"))).toBe(23)
    expect(ageInYears("2000-02-29", at("2024-02-28T12:00:00Z"))).toBe(23)
    expect(ageInYears("2000-02-29", at("2024-02-29T00:00:00Z"))).toBe(24)
    expect(ageInYears("2000-02-29", at("2028-02-29T10:00:00Z"))).toBe(28)
  })

  it("reads the calendar of UTC, whatever the clock of the machine says", () => {
    // 23:30 on the 8th at UTC-1 is 00:30 on the 9th in UTC; 01:30 on the 9th at UTC+2 is 23:30 on the 8th in UTC
    expect(ageInYears("2008-11-09", at("2026-11-08T23:30:00-01:00"))).toBe(18)
    expect(ageInYears("2008-11-09", at("2026-11-09T01:30:00+02:00"))).toBe(17)
  })

  it("gives a negative age to a date in the future and 0 to a baby, which the caller judges", () => {
    expect(ageInYears("2030-01-01", at("2026-11-09T00:00:00Z"))).toBeLessThan(0)
    expect(ageInYears("2026-11-09", at("2026-11-09T00:00:00Z"))).toBe(0)
  })

  it.each([null, undefined, 20000101, "", "2000-1-1", "2000-13-01", "2000-00-10", "2000-02-30", "2001-02-29", "2000-01-32", "2000-01-01T00:00:00Z", " 2000-01-01", "01/02/2000", "20000101", {}])(
    "is null for %j, which is not a date of birth",
    (value) => {
      expect(ageInYears(value, at("2026-11-09T00:00:00Z"))).toBeNull()
    },
  )

  it("reads a year below 100 as that year, not as a year of the 1900s", () => {
    expect(ageInYears("0050-01-01", at("2026-11-09T00:00:00Z"))).toBe(1976)
  })
})

describe("birthdateProblem", () => {
  const now = at("2026-11-09T12:00:00Z")

  it("keeps a date that makes the member old enough", () => {
    expect(birthdateProblem("1990-04-02", now)).toBeNull()
    expect(birthdateProblem("2013-11-09", now)).toBeNull()
  })

  it("refuses a date that makes the member younger than the site allows, the day before the 13th birthday included", () => {
    expect(SITE_MINIMUM_AGE).toBe(13)
    expect(birthdateProblem("2013-11-10", now)).toBe("under-minimum")
    expect(birthdateProblem("2020-01-01", now)).toBe("under-minimum")
    expect(birthdateProblem("2026-11-09", now)).toBe("under-minimum")
  })

  it("refuses what is not a date of birth: a day that does not exist, the future, a year too far back", () => {
    expect(OLDEST_AGE).toBe(120)
    expect(birthdateProblem("2000-02-30", now)).toBe("invalid")
    expect(birthdateProblem("2030-01-01", now)).toBe("invalid")
    expect(birthdateProblem("1900-01-01", now)).toBe("invalid")
    expect(birthdateProblem("1906-11-09", now)).toBeNull()
    expect(birthdateProblem("1906-11-10", now)).toBeNull()
    expect(birthdateProblem("1905-11-09", now)).toBe("invalid")
    expect(birthdateProblem("not a date", now)).toBe("invalid")
    expect(birthdateProblem(undefined, now)).toBe("invalid")
  })
})

describe("ageRefusal", () => {
  const now = at("2026-11-09T12:00:00Z")
  const member = (birthdate: string | null): AgeSubject => ({ kind: "member", birthdate })

  it("asks nothing of anybody at a table that asks no age: a guest included", () => {
    expect(ageRefusal(null, { kind: "guest" }, now)).toBeNull()
    expect(ageRefusal(null, member(null), now)).toBeNull()
    expect(ageRefusal(null, member("2020-01-01"), now)).toBeNull()
  })

  it("sends a guest to sign in: they have no account, so no date of birth", () => {
    expect(ageRefusal(18, { kind: "guest" }, now)).toBe("sign-in")
  })

  it("asks a member who declared no date for it", () => {
    expect(ageRefusal(18, member(null), now)).toBe("date")
  })

  it("counts a date that is not a date of birth as no date", () => {
    expect(ageRefusal(18, member("garbage"), now)).toBe("date")
    expect(ageRefusal(18, member("2000-02-30"), now)).toBe("date")
  })

  it("refuses a member who is not old enough, down to the last day before the birthday, and lets them in on the day", () => {
    expect(ageRefusal(18, member("2008-11-10"), now)).toBe("too-young")
    expect(ageRefusal(18, member("2008-11-09"), now)).toBeNull()
    expect(ageRefusal(18, member("1990-01-01"), now)).toBeNull()
    expect(ageRefusal(16, member("2010-11-09"), now)).toBeNull()
    expect(ageRefusal(16, member("2010-11-10"), now)).toBe("too-young")
  })

  it("asks the age of the table, not 18: a table for 21 refuses a member of 20", () => {
    expect(ageRefusal(21, member("2006-01-01"), now)).toBe("too-young")
    expect(ageRefusal(21, member("2005-11-09"), now)).toBeNull()
  })
})

describe("the calendar the form and the server share", () => {
  it("knows which days exist, leap years included, and rejects what is not a whole day", () => {
    expect(isRealDay({ year: 2000, month: 2, day: 29 })).toBe(true)
    expect(isRealDay({ year: 1900, month: 2, day: 29 })).toBe(false)
    expect(isRealDay({ year: 2001, month: 2, day: 29 })).toBe(false)
    expect(isRealDay({ year: 2026, month: 4, day: 31 })).toBe(false)
    expect(isRealDay({ year: 2026, month: 13, day: 1 })).toBe(false)
    expect(isRealDay({ year: 2026, month: 0, day: 1 })).toBe(false)
    expect(isRealDay({ year: 2026, month: 1.5, day: 1 })).toBe(false)
    expect(isRealDay({ year: 50, month: 1, day: 1 })).toBe(true)
  })

  it("takes the day of an instant on the UTC calendar, whatever the offset it was written with", () => {
    expect(utcDayOf(new Date("2026-11-09T23:59:59Z"))).toEqual({ year: 2026, month: 11, day: 9 })
    expect(utcDayOf(new Date("2026-11-10T01:30:00+02:00"))).toEqual({ year: 2026, month: 11, day: 9 })
    expect(utcDayOf(new Date("2026-11-08T23:30:00-01:00"))).toEqual({ year: 2026, month: 11, day: 9 })
  })

  it("counts whole years between two days, a birthday on its day and a 29 February on the 1st of March", () => {
    const today = { year: 2026, month: 11, day: 9 }
    expect(ageOn({ year: 2013, month: 11, day: 9 }, today)).toBe(13)
    expect(ageOn({ year: 2013, month: 11, day: 10 }, today)).toBe(12)
    expect(ageOn({ year: 2026, month: 11, day: 10 }, today)).toBe(-1)
    expect(ageOn({ year: 2000, month: 2, day: 29 }, { year: 2025, month: 2, day: 28 })).toBe(24)
    expect(ageOn({ year: 2000, month: 2, day: 29 }, { year: 2025, month: 3, day: 1 })).toBe(25)
  })
})
