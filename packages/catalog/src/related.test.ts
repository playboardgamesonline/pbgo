import { describe, expect, it } from "vitest"
import { RELATED_MAX, categorySimilarity, rankRelated } from "./catalog"

const game = (slug: string, ...categories: string[]) => ({ slug, game: { categories } })

describe("categorySimilarity", () => {
  it("is 0 when the games share nothing, or when one has no category", () => {
    expect(categorySimilarity(["Cards"], ["Strategy"])).toBe(0)
    expect(categorySimilarity([], ["Strategy"])).toBe(0)
    expect(categorySimilarity([], [])).toBe(0)
  })

  it("is 1 for the same categories, whatever their order", () => {
    expect(categorySimilarity(["Cards", "Family"], ["Family", "Cards"])).toBe(1)
  })

  it("is the share of the categories of the two games that both have", () => {
    expect(categorySimilarity(["Cards", "Family"], ["Cards", "Cooperative"])).toBeCloseTo(1 / 3)
    expect(categorySimilarity(["Cards"], ["Cards", "Family"])).toBeCloseTo(1 / 2)
  })

  it("counts a category once", () => {
    expect(categorySimilarity(["Cards", "Cards"], ["Cards"])).toBe(1)
  })
})

describe("rankRelated", () => {
  const skyjo = game("skyjo", "Cards", "Family")
  const catalog = [
    skyjo,
    game("skyjo-action", "Cards"),
    game("the-mind", "Cooperative", "Cards"),
    game("hanabi", "Cooperative", "Cards"),
    game("catan", "Strategy"),
    game("bang", "Cards", "Family"),
  ]
  const family = new Set(["skyjo-action"])

  it("puts the family first, whatever it looks like, then the games that look like it, the likeliest first", () => {
    // `bang` shares both categories (1), `the-mind` and `hanabi` one of three (a third each), `catan` none: it is left out
    expect(rankRelated(skyjo, catalog, family)).toEqual(["skyjo-action", "bang", "the-mind", "hanabi"])
  })

  it("keeps the catalog's order inside the family, and between games that look as much like it", () => {
    const both = new Set(["bang", "skyjo-action"])
    expect(rankRelated(skyjo, catalog, both).slice(0, 2)).toEqual(["skyjo-action", "bang"])
    expect(rankRelated(skyjo, catalog, undefined).slice(-2)).toEqual(["the-mind", "hanabi"])
  })

  it("never recommends the game itself", () => {
    expect(rankRelated(skyjo, catalog, new Set(["skyjo", "skyjo-action"]))).not.toContain("skyjo")
  })

  it("recommends the games that players of it also play, and ranks higher those that also look like it", () => {
    // `hanabi` is the one most played with it (1) and shares a third of its categories: it passes `bang`, which looks more like it but is played with by no one
    const alsoPlayed = new Map([["hanabi", 4], ["the-mind", 2]])
    expect(rankRelated(skyjo, catalog, family, alsoPlayed)).toEqual(["skyjo-action", "hanabi", "bang", "the-mind"])
  })

  it("recommends a game that players also play even if its categories are others'", () => {
    expect(rankRelated(skyjo, catalog, family)).not.toContain("catan")
    expect(rankRelated(skyjo, catalog, family, new Map([["catan", 3]]))).toContain("catan")
  })

  it("ranks by categories alone when nothing is known of who plays what", () => {
    expect(rankRelated(skyjo, catalog, family, new Map())).toEqual(rankRelated(skyjo, catalog, family))
  })

  it("has nothing to recommend for a game with no category, no family and no play data", () => {
    expect(rankRelated(game("bare"), [...catalog, game("bare")], undefined)).toEqual([])
  })

  it("stops at the limit, the family first", () => {
    const crowd = Array.from({ length: 20 }, (_, index) => game(`game-${index}`, "Cards"))
    const entry = game("entry", "Cards")
    const result = rankRelated(entry, [entry, ...crowd], new Set(["game-17", "game-19"]), undefined, 5)
    expect(result).toEqual(["game-17", "game-19", "game-0", "game-1", "game-2"])
    expect(rankRelated(entry, [entry, ...crowd], undefined)).toHaveLength(RELATED_MAX)
  })
})
