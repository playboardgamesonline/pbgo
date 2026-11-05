import { describe, expect, it } from "vitest"
import { agoOf, pointsLabel, pointsTone, recordOf, resultOf, resultWord, timePlayed, winRate, type Outcome } from "./results"

describe("resultOf", () => {
  it("calls a game won, lost or drawn whether it was played against the others or with them", () => {
    const words: Record<Outcome, string> = { win: "won", coop_win: "won", loss: "lost", coop_loss: "lost", draw: "draw", abandoned: "abandoned" }
    for (const [outcome, word] of Object.entries(words)) expect(resultOf(outcome as Outcome), outcome).toBe(word)
  })
})

describe("resultWord", () => {
  it("writes each of the four results with a capital", () => {
    expect(["won", "lost", "draw", "abandoned"].map((result) => resultWord(result as Parameters<typeof resultWord>[0]))).toEqual(["Won", "Lost", "Draw", "Abandoned"])
  })
})

describe("winRate", () => {
  it("is the share of the games won, in whole percent", () => {
    expect(winRate(14, 24)).toBe(58)
    expect(winRate(1, 3)).toBe(33)
    expect(winRate(2, 3)).toBe(67)
    expect(winRate(0, 5)).toBe(0)
    expect(winRate(5, 5)).toBe(100)
  })

  it("is nothing for a visitor who played no game", () => {
    expect(winRate(0, 0)).toBeNull()
  })
})

describe("recordOf", () => {
  it("says the wins and the games, in the singular where there is one", () => {
    expect(recordOf(14, 24)).toBe("14 wins in 24 games")
    expect(recordOf(1, 1)).toBe("1 win in 1 game")
    expect(recordOf(0, 3)).toBe("0 wins in 3 games")
    expect(recordOf(1, 12)).toBe("1 win in 12 games")
  })
})

describe("agoOf", () => {
  const NOW = Date.parse("2026-11-01T12:00:00Z")
  const MINUTE = 60_000
  const HOUR = 60 * MINUTE
  const DAY = 24 * HOUR
  const ago = (ms: number) => new Date(NOW - ms).toISOString()

  it("says just now under a minute, then minutes, hours, days, weeks, months and years", () => {
    expect(agoOf(ago(0), NOW)).toBe("Just now")
    expect(agoOf(ago(59_999), NOW)).toBe("Just now")
    expect(agoOf(ago(4 * MINUTE), NOW)).toBe("4 min ago")
    expect(agoOf(ago(59 * MINUTE), NOW)).toBe("59 min ago")
    expect(agoOf(ago(60 * MINUTE), NOW)).toBe("1 h ago")
    expect(agoOf(ago(23 * HOUR + 59 * MINUTE), NOW)).toBe("23 h ago")
    expect(agoOf(ago(DAY), NOW)).toBe("1 d ago")
    expect(agoOf(ago(6 * DAY), NOW)).toBe("6 d ago")
    expect(agoOf(ago(7 * DAY), NOW)).toBe("1 w ago")
    expect(agoOf(ago(59 * DAY), NOW)).toBe("8 w ago")
    expect(agoOf(ago(60 * DAY), NOW)).toBe("2 mo ago")
    expect(agoOf(ago(364 * DAY), NOW)).toBe("12 mo ago")
    expect(agoOf(ago(365 * DAY), NOW)).toBe("1 y ago")
  })

  it("counts a date that does not read, or one to come, as now", () => {
    expect(agoOf("not a date", NOW)).toBe("Just now")
    expect(agoOf(new Date(NOW + DAY).toISOString(), NOW)).toBe("Just now")
  })
})

describe("timePlayed", () => {
  it("says no time as 0 h, and less than an hour in minutes", () => {
    expect(timePlayed(0)).toBe("0 h")
    expect(timePlayed(59)).toBe("0 h")
    expect(timePlayed(60)).toBe("1 min")
    expect(timePlayed(42 * 60)).toBe("42 min")
    expect(timePlayed(59 * 60 + 59)).toBe("59 min")
  })

  it("counts in hours from one hour, always with one decimal, counted down, and never in days", () => {
    expect(timePlayed(3600)).toBe("1.0 h")
    expect(timePlayed(3600 + 5 * 60)).toBe("1.0 h")
    expect(timePlayed(3600 + 6 * 60)).toBe("1.1 h")
    expect(timePlayed(3 * 3600)).toBe("3.0 h")
    expect(timePlayed(9.5 * 3600)).toBe("9.5 h")
    expect(timePlayed(9 * 3600 + 59 * 60)).toBe("9.9 h")
    expect(timePlayed(10 * 3600)).toBe("10.0 h")
    expect(timePlayed(38 * 3600 + 25 * 60)).toBe("38.4 h")
    expect(timePlayed(240 * 3600)).toBe("240.0 h")
  })

  it("takes what is not a time for none", () => {
    expect(timePlayed(-30)).toBe("0 h")
    expect(timePlayed(Number.NaN)).toBe("0 h")
  })
})

describe("pointsLabel", () => {
  it("writes the points a game gave with a plus and the ones it took with a minus", () => {
    expect([32, 1, -11, -1].map(pointsLabel)).toEqual(["+32", "+1", "−11", "−1"])
  })

  it("writes 0 for a game that moved nothing and a dash where no points apply", () => {
    expect(pointsLabel(0)).toBe("0")
    expect(pointsLabel(null)).toBe("—")
  })
})

describe("pointsTone", () => {
  it("is green for a gain, red for a loss and grey for none", () => {
    expect([32, -11, 0, null].map(pointsTone)).toEqual(["success", "destructive", "secondary", "secondary"])
  })
})
