import { describe, expect, it } from "vitest"
import type { GameTotals } from "@pbgo/accounts"
import { playtimePodium, winRatePodium } from "./profile-podiums"

const game = (slug: string, played: number, wins: number, seconds?: number): GameTotals => ({ slug, name: slug.replace(/^./, (letter) => letter.toUpperCase()), played, wins, ...(seconds === undefined ? {} : { seconds }) })

describe("playtimePodium", () => {
  it("puts the games they spent the most time at first, two at the most, each with its time", () => {
    const rows = [game("a", 3, 1, 600), game("b", 9, 4, 7500), game("c", 2, 0, 3900), game("d", 5, 2, 120), game("e", 1, 1, 30)]
    expect(playtimePodium(rows)).toEqual([
      { slug: "b", name: "B", value: "2 h 05" },
      { slug: "c", name: "C", value: "1 h 05" },
    ])
  })

  it("breaks a tie of time by the games played, then by the name", () => {
    const rows = [game("zed", 2, 0, 600), game("amy", 2, 0, 600), game("bob", 5, 0, 600), game("cy", 1, 0, 600)]
    expect(playtimePodium(rows).map((entry) => entry.slug)).toEqual(["bob", "amy"])
  })

  it("leaves out a game with no time told, and has nobody on the podium of a member who has none", () => {
    expect(playtimePodium([game("a", 3, 1), game("b", 2, 0, 0)])).toEqual([])
    expect(playtimePodium([])).toEqual([])
  })

  it("has fewer than two where they played fewer games", () => {
    expect(playtimePodium([game("a", 1, 0, 90)]).map((entry) => entry.slug)).toEqual(["a"])
  })

  it("does not change the list it is given", () => {
    const rows = [game("a", 1, 0, 60), game("b", 1, 0, 120)]
    playtimePodium(rows)
    expect(rows.map((row) => row.slug)).toEqual(["a", "b"])
  })
})

describe("winRatePodium", () => {
  it("puts the games they win the most often first, two at the most, each with its share in whole percent", () => {
    const rows = [game("a", 4, 2), game("b", 3, 3), game("c", 8, 6), game("d", 5, 1), game("e", 6, 0)]
    expect(winRatePodium(rows)).toEqual([
      { slug: "b", name: "B", value: "100%" },
      { slug: "c", name: "C", value: "75%" },
    ])
  })

  it("compares the shares as they are, not rounded, and breaks a tie by the games played, then by the name", () => {
    // 2 of 3 is 66.7% and 3 of 5 is 60%, both written 67% and 60%; 1 of 2 and 2 of 4 are the same share
    expect(winRatePodium([game("slim", 5, 3), game("fat", 3, 2)]).map((entry) => entry.slug)).toEqual(["fat", "slim"])
    expect(winRatePodium([game("amy", 2, 1), game("bob", 4, 2), game("cy", 4, 2)]).map((entry) => entry.slug)).toEqual(["bob", "cy"])
  })

  it("leaves out a game they never won, and has nobody on the podium of a member who won nothing", () => {
    expect(winRatePodium([game("a", 3, 0), game("b", 2, 0)])).toEqual([])
    expect(winRatePodium([])).toEqual([])
  })

  it("leaves out a game with no game played, whatever its wins say", () => {
    expect(winRatePodium([game("a", 0, 2)])).toEqual([])
  })
})
