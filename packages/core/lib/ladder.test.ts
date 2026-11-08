import { rankLabel, TIERS } from "@pbgo/ui/ranks"
import { describe, expect, it } from "vitest"
import { DIVISION_POINTS, LEGEND_SCORE, progressOfScore, rankOfScore } from "./ladder"

describe("rankOfScore", () => {
  it("reads each step of the ladder as a tier and a division, a hundred points apiece", () => {
    expect(rankLabel(rankOfScore(0))).toBe("Apprentice I")
    expect(rankLabel(rankOfScore(99))).toBe("Apprentice I")
    expect(rankLabel(rankOfScore(100))).toBe("Apprentice II")
    expect(rankLabel(rankOfScore(299))).toBe("Apprentice III")
    expect(rankLabel(rankOfScore(300))).toBe("Bronze I")
    expect(rankLabel(rankOfScore(1200))).toBe("Platinum I")
    expect(rankLabel(rankOfScore(1450))).toBe("Platinum III")
    expect(rankLabel(rankOfScore(1800))).toBe("Master I")
    expect(rankLabel(rankOfScore(2083))).toBe("Master III")
    expect(rankLabel(rankOfScore(2399))).toBe("Grandmaster III")
  })

  it("has the eight tiers below Legend in order, three divisions each, and Legend alone at the top", () => {
    const ranks = Array.from({ length: LEGEND_SCORE / DIVISION_POINTS }, (_, step) => rankOfScore(step * DIVISION_POINTS))
    expect(ranks.map((rank) => rank.tier)).toEqual(TIERS.slice(0, 8).flatMap((tier) => [tier, tier, tier]))
    expect(ranks.map((rank) => rank.division)).toEqual(Array.from({ length: 24 }, (_, step) => (step % 3) + 1))
    expect(rankOfScore(LEGEND_SCORE)).toEqual({ tier: "Legend" })
    expect(rankOfScore(LEGEND_SCORE + 500)).toEqual({ tier: "Legend" })
  })

  it("reads a score below the first step as Apprentice I", () => {
    expect(rankOfScore(-40)).toEqual({ tier: "Apprentice", division: 1 })
  })
})

describe("progressOfScore", () => {
  it("is how far through its division a score is, out of a hundred, never the hundred itself", () => {
    expect(progressOfScore(0)).toEqual({ points: 0, needed: 100 })
    expect(progressOfScore(1450)).toEqual({ points: 50, needed: 100 })
    expect(progressOfScore(299)).toEqual({ points: 99, needed: 100 })
    expect(progressOfScore(300)).toEqual({ points: 0, needed: 100 })
  })

  it("is nothing for Legend, whose rank is a place", () => {
    expect(progressOfScore(LEGEND_SCORE)).toBeNull()
  })
})
