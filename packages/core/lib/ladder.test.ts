import { rankLabel, TIERS } from "@pbgo/ui/ranks"
import { describe, expect, it } from "vitest"
import { DIVISION_POINTS, LEGEND_POINTS, progressOfPoints, rankOfPoints } from "./ladder"

describe("rankOfPoints", () => {
  it("reads each step of the ladder as a tier and a division, a hundred points apiece", () => {
    expect(rankLabel(rankOfPoints(0))).toBe("Apprentice I")
    expect(rankLabel(rankOfPoints(99))).toBe("Apprentice I")
    expect(rankLabel(rankOfPoints(100))).toBe("Apprentice II")
    expect(rankLabel(rankOfPoints(299))).toBe("Apprentice III")
    expect(rankLabel(rankOfPoints(300))).toBe("Bronze I")
    expect(rankLabel(rankOfPoints(1200))).toBe("Platinum I")
    expect(rankLabel(rankOfPoints(1450))).toBe("Platinum III")
    expect(rankLabel(rankOfPoints(1800))).toBe("Master I")
    expect(rankLabel(rankOfPoints(2083))).toBe("Master III")
    expect(rankLabel(rankOfPoints(2399))).toBe("Grandmaster III")
  })

  it("has the eight tiers below Legend in order, three divisions each, and Legend alone at the top", () => {
    const ranks = Array.from({ length: LEGEND_POINTS / DIVISION_POINTS }, (_, step) => rankOfPoints(step * DIVISION_POINTS))
    expect(ranks.map((rank) => rank.tier)).toEqual(TIERS.slice(0, 8).flatMap((tier) => [tier, tier, tier]))
    expect(ranks.map((rank) => rank.division)).toEqual(Array.from({ length: 24 }, (_, step) => (step % 3) + 1))
    expect(rankOfPoints(LEGEND_POINTS)).toEqual({ tier: "Legend" })
    expect(rankOfPoints(LEGEND_POINTS + 500)).toEqual({ tier: "Legend" })
  })

  it("reads fewer than no points as Apprentice I", () => {
    expect(rankOfPoints(-40)).toEqual({ tier: "Apprentice", division: 1 })
  })

  it("does not depend on anything but the points: the same number is the same rank for every player and every game", () => {
    expect(rankOfPoints(640)).toEqual(rankOfPoints(640))
    expect(rankLabel(rankOfPoints(640))).toBe("Silver I")
  })
})

describe("progressOfPoints", () => {
  it("is how far through its division a number of points is, out of a hundred, never the hundred itself", () => {
    expect(progressOfPoints(0)).toEqual({ points: 0, needed: 100 })
    expect(progressOfPoints(1450)).toEqual({ points: 50, needed: 100 })
    expect(progressOfPoints(299)).toEqual({ points: 99, needed: 100 })
    expect(progressOfPoints(300)).toEqual({ points: 0, needed: 100 })
  })

  it("is nothing for Legend, whose rank is a place", () => {
    expect(progressOfPoints(LEGEND_POINTS)).toBeNull()
  })
})
