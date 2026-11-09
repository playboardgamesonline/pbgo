import { describe, expect, it } from "vitest"
import { DEFAULT_PREFERENCES, NICKNAME_KEY, PREFERENCE_KEYS, REDUCE_MOTION_CHOICES, TIME_FORMATS, hourCycleOf, isReduceMotion, isTimeFormat, nicknameOf, preferencesOf } from "./preferences"

describe("the keys that are ours", () => {
  it("carry the namespace of the platform, which a provider never writes", () => {
    for (const key of [NICKNAME_KEY, ...Object.values(PREFERENCE_KEYS)]) expect(key).toMatch(/^pbgo_/)
  })

  it("are one key for each preference", () => {
    expect(Object.keys(PREFERENCE_KEYS).sort()).toEqual(Object.keys(DEFAULT_PREFERENCES).sort())
    expect(new Set(Object.values(PREFERENCE_KEYS)).size).toBe(Object.keys(PREFERENCE_KEYS).length)
  })
})

describe("preferencesOf", () => {
  it("is the default of each preference for an account that set none", () => {
    expect(preferencesOf({})).toEqual(DEFAULT_PREFERENCES)
    expect(preferencesOf({ user_metadata: {} })).toEqual(DEFAULT_PREFERENCES)
    expect(preferencesOf({ user_metadata: null })).toEqual(DEFAULT_PREFERENCES)
  })

  it("reads what the member set, preference by preference", () => {
    expect(preferencesOf({ user_metadata: { pbgo_notify_turn: false, pbgo_hide_history: true } })).toEqual({ ...DEFAULT_PREFERENCES, notifyTurn: false, hideHistory: true })
  })

  it("reads a choice of words as the member set it: how the time is written, and whether the motion is reduced", () => {
    expect(preferencesOf({ user_metadata: { pbgo_time_format: "12h", pbgo_reduce_motion: "never" } })).toEqual({ ...DEFAULT_PREFERENCES, timeFormat: "12h", reduceMotion: "never" })
    expect(preferencesOf({ user_metadata: { pbgo_time_format: "24h", pbgo_reduce_motion: "always" } })).toMatchObject({ timeFormat: "24h", reduceMotion: "always" })
  })

  it("reads a word that is not one of the choices as no choice: the default, never what was written", () => {
    expect(preferencesOf({ user_metadata: { pbgo_time_format: "13h", pbgo_reduce_motion: "sometimes" } })).toEqual(DEFAULT_PREFERENCES)
    expect(preferencesOf({ user_metadata: { pbgo_time_format: true, pbgo_reduce_motion: 1 } })).toEqual(DEFAULT_PREFERENCES)
    expect(preferencesOf({ user_metadata: { pbgo_time_format: "AUTO", pbgo_reduce_motion: " always" } })).toEqual(DEFAULT_PREFERENCES)
  })

  it("reads anything that is not a boolean as no choice: the member can write their own metadata", () => {
    expect(preferencesOf({ user_metadata: { pbgo_notify_turn: "no", pbgo_notify_invites: 0, pbgo_hide_history: null } })).toEqual(DEFAULT_PREFERENCES)
  })

  it("does not read the keys of a provider for a preference", () => {
    expect(preferencesOf({ user_metadata: { notifyTurn: false, hideHistory: true, full_name: "Oré" } })).toEqual(DEFAULT_PREFERENCES)
  })
})

describe("the choices of words", () => {
  it("each have a default among their words, which is `auto`: the device or the page's language decides", () => {
    expect(TIME_FORMATS).toContain(DEFAULT_PREFERENCES.timeFormat)
    expect(REDUCE_MOTION_CHOICES).toContain(DEFAULT_PREFERENCES.reduceMotion)
    expect(DEFAULT_PREFERENCES.timeFormat).toBe("auto")
    expect(DEFAULT_PREFERENCES.reduceMotion).toBe("auto")
  })

  it("are recognised by their words alone", () => {
    for (const word of TIME_FORMATS) expect(isTimeFormat(word)).toBe(true)
    for (const word of REDUCE_MOTION_CHOICES) expect(isReduceMotion(word)).toBe(true)
    for (const value of ["", "12", "12H", null, undefined, 12, {}]) expect(isTimeFormat(value)).toBe(false)
    for (const value of ["", "on", "system", null, undefined, true, {}]) expect(isReduceMotion(value)).toBe(false)
  })
})

describe("hourCycleOf", () => {
  it("forces the clock the member chose, and leaves Automatic to the language of the formatter", () => {
    expect(hourCycleOf("12h")).toBe("h12")
    expect(hourCycleOf("24h")).toBe("h23")
    expect(hourCycleOf("auto")).toBeUndefined()
  })

  it("writes the same instant on the clock that was asked, with the options the pages build their formatters from", () => {
    const instant = new Date("2026-10-28T21:12:00Z")
    const write = (format: "auto" | "12h" | "24h") => {
      const hourCycle = hourCycleOf(format)
      return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: hourCycle === "h12" ? "numeric" : "2-digit", minute: "2-digit", hourCycle, timeZone: "UTC" }).format(instant)
    }
    expect(write("auto")).toBe("28 Oct, 21:12")
    expect(write("24h")).toBe("28 Oct, 21:12")
    expect(write("12h")).toBe("28 Oct, 9:12 pm")
  })

  it("has a clock for every way of writing the time but one: Automatic", () => {
    expect(TIME_FORMATS.filter((format) => hourCycleOf(format) === undefined)).toEqual(["auto"])
  })
})

describe("nicknameOf", () => {
  it("is the nickname the member chose, cleaned like a display name", () => {
    expect(nicknameOf({ user_metadata: { pbgo_nickname: "  Marly   74 " } })).toBe("Marly 74")
    expect(nicknameOf({ user_metadata: { pbgo_nickname: "Mar\u0000ly" } })).toBe("Marly")
  })

  it("is null when they chose none, or when the key holds no sensible name", () => {
    expect(nicknameOf({})).toBeNull()
    expect(nicknameOf({ user_metadata: { full_name: "Oré" } })).toBeNull()
    expect(nicknameOf({ user_metadata: { pbgo_nickname: "   " } })).toBeNull()
    expect(nicknameOf({ user_metadata: { pbgo_nickname: 42 } })).toBeNull()
    expect(nicknameOf({ user_metadata: { pbgo_nickname: "x".repeat(41) } })).toBeNull()
  })

  it("counts a name as a person does: an emoji is one character", () => {
    expect(nicknameOf({ user_metadata: { pbgo_nickname: "🎲".repeat(40) } })).toBe("🎲".repeat(40))
  })
})
