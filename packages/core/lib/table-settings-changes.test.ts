import { describe, expect, it } from "vitest"
import { changedSettings } from "./table-settings-changes"
import type { TableSettingsInput } from "./table-settings"

const BASE: TableSettingsInput = { visibility: "private", minRank: null, language: null, pace: "normal", seats: 4 }

describe("changedSettings", () => {
  it("is none when nothing changed", () => {
    expect(changedSettings(BASE, { ...BASE })).toEqual([])
  })

  it.each([
    ["who may join", { visibility: "public" as const }, ["visibility"]],
    ["the rank a table asks", { minRank: "Silver" as const }, ["min_rank"]],
    ["the language a table asks", { language: "fr" as const }, ["language"]],
    ["the speed", { pace: "fast" as const }, ["pace"]],
    ["the seats", { seats: 3 }, ["seats"]],
  ])("names %s", (_what, patch, expected) => {
    expect(changedSettings(BASE, { ...BASE, ...patch })).toEqual(expected)
  })

  it("names every setting that changed, in the order the lobby shows them", () => {
    expect(changedSettings(BASE, { visibility: "public", minRank: "Silver", language: "en", pace: "slow", seats: 2 })).toEqual(["visibility", "min_rank", "language", "pace", "seats"])
  })

  it("names the setting that went back to nothing as one that changed", () => {
    expect(changedSettings({ ...BASE, minRank: "Silver", language: "fr" }, BASE)).toEqual(["min_rank", "language"])
  })

  it("never holds a value: only the names of the settings", () => {
    const names = changedSettings(BASE, { visibility: "public", minRank: "Silver", language: "fr", pace: "fast", seats: 2 })
    expect(names.join(" ")).not.toMatch(/silver|\bfr\b|fast|public/i)
  })
})
