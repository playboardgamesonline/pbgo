import { describe, expect, it } from "vitest"
import type { AgeSubject } from "@pbgo/accounts"
import { NO_AGE_RULES, NO_AGE_STATES, ageStatesFor, hasAgeRules, tableAge, type AgeRules } from "./age-rules"

describe("hasAgeRules", () => {
  it("is false for a game that says no age and has no expansion that does", () => {
    expect(hasAgeRules(NO_AGE_RULES)).toBe(false)
  })

  it("is false while every age is advice: under 16 nothing is enforced", () => {
    expect(hasAgeRules({ game: 14, expansions: { "top-ten-party": 12 } })).toBe(false)
  })

  it("is true when the game asks for an age the platform enforces", () => {
    expect(hasAgeRules({ game: 18, expansions: {} })).toBe(true)
  })

  it("is true when only an expansion does, which is the case of the first games for adults", () => {
    expect(hasAgeRules({ game: 8, expansions: { "smile-life-18": 18 } })).toBe(true)
  })
})

describe("tableAge", () => {
  const rules: AgeRules = { game: 8, expansions: { "smile-life-18": 18, "smile-life-16": 16, "smile-life-kids": 6 } }

  it("asks nothing of a table of a game for everybody, with no expansion for adults switched on", () => {
    expect(tableAge(rules, {})).toBeNull()
    expect(tableAge(rules, { "smile-life-18": false, "smile-life-16": false })).toBeNull()
  })

  it("asks the age of the expansion for adults that is switched on: the table is a table for adults", () => {
    expect(tableAge(rules, { "smile-life-18": true })).toBe(18)
    expect(tableAge(rules, { "smile-life-16": true })).toBe(16)
  })

  it("asks the highest age among the expansions that are on", () => {
    expect(tableAge(rules, { "smile-life-18": true, "smile-life-16": true })).toBe(18)
  })

  it("does not read an expansion that is advice only, nor an option that is not an expansion", () => {
    expect(tableAge(rules, { "smile-life-kids": true, rounds: 3, speed: "fast" })).toBeNull()
  })

  it("reads an expansion as switched on only when its option is true", () => {
    expect(tableAge(rules, { "smile-life-18": "true" })).toBeNull()
    expect(tableAge(rules, { "smile-life-18": 1 })).toBeNull()
  })

  it("asks the age of a game that is for adults itself, whatever the expansions", () => {
    expect(tableAge({ game: 18, expansions: { "x-16": 16 } }, {})).toBe(18)
    expect(tableAge({ game: 18, expansions: { "x-16": 16 } }, { "x-16": true })).toBe(18)
    expect(tableAge({ game: 16, expansions: { "x-18": 18 } }, { "x-18": true })).toBe(18)
  })
})

describe("ageStatesFor", () => {
  const now = new Date("2026-11-09T12:00:00Z")
  const rules: AgeRules = { game: 8, expansions: { "smile-life-18": 18, "smile-life-16": 16, "smile-life-kids": 6 } }
  const member = (birthdate: string | null): AgeSubject => ({ kind: "member", birthdate })

  it("tells a guest to sign in for each expansion that asks for an age, and says nothing of the game, which asks none", () => {
    expect(ageStatesFor(rules, { kind: "guest" }, now)).toEqual({
      game: null,
      expansions: { "smile-life-18": { age: 18, refusal: "sign-in" }, "smile-life-16": { age: 16, refusal: "sign-in" } },
    })
  })

  it("asks a member who declared no date for it", () => {
    expect(ageStatesFor(rules, member(null), now).expansions).toEqual({ "smile-life-18": { age: 18, refusal: "date" }, "smile-life-16": { age: 16, refusal: "date" } })
  })

  it("tells a member who is old enough for one but not for the other, with the age that each asks", () => {
    expect(ageStatesFor(rules, member("2010-11-09"), now).expansions).toEqual({ "smile-life-18": { age: 18, refusal: "too-young" } })
  })

  it("has nothing to say to an adult", () => {
    expect(ageStatesFor(rules, member("1990-04-02"), now)).toEqual(NO_AGE_STATES)
  })

  it("never mentions an expansion that is advice only", () => {
    expect(ageStatesFor({ game: null, expansions: { "smile-life-kids": 6 } }, { kind: "guest" }, now)).toEqual(NO_AGE_STATES)
  })

  it("says the game itself when it asks for an age the person does not meet", () => {
    expect(ageStatesFor({ game: 18, expansions: {} }, { kind: "guest" }, now).game).toEqual({ age: 18, refusal: "sign-in" })
    expect(ageStatesFor({ game: 18, expansions: {} }, member("2008-11-10"), now).game).toEqual({ age: 18, refusal: "too-young" })
    expect(ageStatesFor({ game: 18, expansions: {} }, member("2008-11-09"), now).game).toBeNull()
  })

  it("has nothing to say for a game that asks for no age", () => {
    expect(ageStatesFor(NO_AGE_RULES, { kind: "guest" }, now)).toEqual(NO_AGE_STATES)
  })
})
