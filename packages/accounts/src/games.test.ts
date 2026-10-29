import { describe, expect, it } from "vitest"
import { ordinal, perGame, statsOf, type PlayedGame } from "./games"

const game = (id: string, slug: string, name: string, state: PlayedGame["state"], result?: PlayedGame["result"]): PlayedGame => ({
  id,
  slug,
  name,
  playedAt: "2026-10-28T21:12:00Z",
  table: "ABC",
  opponents: [{ nickname: "Marly" }],
  state,
  result,
})

describe("statsOf", () => {
  it("has nothing to say of no game", () => {
    expect(statsOf([])).toEqual({ played: 0, wins: 0, winRate: null, favourite: null })
  })

  it("counts the games that are over, the wins, the share of wins and the game played the most", () => {
    const games = [
      game("1", "courtisans", "Courtisans", "finished", "won"),
      game("2", "courtisans", "Courtisans", "finished", "lost"),
      game("3", "hanabi", "Hanabi", "finished", "won"),
    ]
    expect(statsOf(games)).toEqual({ played: 3, wins: 2, winRate: 67, favourite: "Courtisans" })
  })

  it("counts a game in progress for nothing yet", () => {
    expect(statsOf([game("1", "courtisans", "Courtisans", "in-progress")])).toEqual({ played: 0, wins: 0, winRate: null, favourite: null })
  })

  it("does not count a draw as a win, but as a game played", () => {
    expect(statsOf([game("1", "skyjo", "Skyjo", "finished", "draw")])).toMatchObject({ played: 1, wins: 0, winRate: 0 })
  })

  it("rounds the share of wins to a whole percent", () => {
    const games = [game("1", "a", "A", "finished", "won"), game("2", "a", "A", "finished", "lost"), game("3", "a", "A", "finished", "lost")]
    expect(statsOf(games).winRate).toBe(33)
  })

  it("takes the first by name when two games are played as much", () => {
    const games = [game("1", "skyjo", "Skyjo", "finished", "won"), game("2", "hanabi", "Hanabi", "finished", "won")]
    expect(statsOf(games).favourite).toBe("Hanabi")
  })
})

describe("perGame", () => {
  it("is one row per game that is over, the most played first, then by name", () => {
    const games = [
      game("1", "skyjo", "Skyjo", "finished", "lost"),
      game("2", "courtisans", "Courtisans", "finished", "won"),
      game("3", "courtisans", "Courtisans", "finished", "lost"),
      game("4", "hanabi", "Hanabi", "finished", "won"),
      game("5", "love-letter", "Love Letter", "in-progress"),
    ]
    expect(perGame(games)).toEqual([
      { slug: "courtisans", name: "Courtisans", played: 2, wins: 1 },
      { slug: "hanabi", name: "Hanabi", played: 1, wins: 1 },
      { slug: "skyjo", name: "Skyjo", played: 1, wins: 0 },
    ])
  })

  it("is empty with no game that is over", () => {
    expect(perGame([])).toEqual([])
  })
})

describe("ordinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
    [101, "101st"],
    [111, "111th"],
  ])("writes %i as %s", (rank, written) => {
    expect(ordinal(rank)).toBe(written)
  })
})
