import { describe, expect, it } from "vitest"
import { TIERS, rankLabel, type Division, type Rank } from "./ranks"

describe("TIERS", () => {
  it("are nine, from the lowest to the highest", () => {
    expect(TIERS).toEqual(["Apprentice", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Champion", "Legend"])
  })
})

describe("rankLabel", () => {
  it.each([
    [{ tier: "Apprentice", division: 1 }, "Apprentice I"],
    [{ tier: "Bronze", division: 2 }, "Bronze II"],
    [{ tier: "Gold", division: 2 }, "Gold II"],
    [{ tier: "Platinum", division: 3 }, "Platinum III"],
    [{ tier: "Champion", division: 3 }, "Champion III"],
  ] satisfies [Rank, string][])("writes %j as %s", (rank, label) => {
    expect(rankLabel(rank)).toBe(label)
  })

  it("writes Legend with no division", () => {
    expect(rankLabel({ tier: "Legend" })).toBe("Legend")
  })

  it("writes every tier but Legend with its three divisions, in numerals, and Legend alone: twenty-five ranks in all", () => {
    const divisions: Division[] = [1, 2, 3]
    const labels = TIERS.flatMap((tier): string[] => (tier === "Legend" ? [rankLabel({ tier })] : divisions.map((division) => rankLabel({ tier, division }))))
    expect(labels).toHaveLength(25)
    expect(new Set(labels).size).toBe(25)
    expect(labels.slice(0, 3)).toEqual(["Apprentice I", "Apprentice II", "Apprentice III"])
    expect(labels.at(-1)).toBe("Legend")
  })

  it("is the type that says it: Legend has no division and every other tier has one", () => {
    // @ts-expect-error Legend has no division
    const legendWithDivision: Rank = { tier: "Legend", division: 1 }
    // @ts-expect-error a tier below Legend has a division
    const goldWithNone: Rank = { tier: "Gold" }
    // @ts-expect-error there are three divisions
    const goldIV: Rank = { tier: "Gold", division: 4 }
    expect([legendWithDivision, goldWithNone, goldIV]).toHaveLength(3)
  })
})
