import { rankLabel } from "@pbgo/ui/ranks"
import { describe, expect, it } from "vitest"
import type { MemberGameRow, MemberGameTotals } from "../server/standings"
import { memberGamesOf, NO_GAMES } from "./member-games"

const NAMES: Record<string, string> = { courtisans: "Courtisans", hanabi: "Hanabi", skyjo: "Skyjo" }
const nameOf = (slug: string) => NAMES[slug] ?? slug

const row = (overrides: Partial<MemberGameRow> = {}): MemberGameRow => ({
  id: "r1",
  game: "courtisans",
  ranked: true,
  finishedAt: "2026-11-08T10:00:00+00:00",
  outcome: "win",
  place: 1,
  score: 12,
  playerCount: 3,
  durationSeconds: 900,
  options: {},
  points: 16,
  opponents: [{ name: "Ola", avatarUrl: null }],
  ...overrides,
})

const totals = (overrides: Partial<MemberGameTotals> = {}): MemberGameTotals => ({
  game: "courtisans",
  gamesPlayed: 12,
  wins: 6,
  secondsPlayed: 7200,
  points: null,
  ratedGames: 0,
  rank: null,
  rankProgress: null,
  ...overrides,
})

describe("memberGamesOf", () => {
  it("has nothing for a member who played nothing", () => {
    expect(memberGamesOf([], [], nameOf)).toEqual(NO_GAMES)
    expect(NO_GAMES.stats).toEqual({ played: 0, wins: 0, winRate: null, favourite: null })
  })

  it("lists the latest games under the name of their game, as the member's own, and keeps their order", () => {
    const { games } = memberGamesOf([row({ id: "r1" }), row({ id: "r2", game: "hanabi", outcome: "loss", place: 2 }), row({ id: "r3", game: "unknown-game" })], [], nameOf)
    expect(games.map((game) => [game.id, game.name, game.slug, game.result, game.state])).toEqual([
      ["r1", "Courtisans", "courtisans", "won", "finished"],
      ["r2", "Hanabi", "hanabi", "lost", "finished"],
      ["r3", "unknown-game", "unknown-game", "won", "finished"],
    ])
  })

  it("carries the rank points a game gave, and none for a game that was not rated", () => {
    const { games } = memberGamesOf([row({ points: 16 }), row({ id: "r2", points: -11 }), row({ id: "r3", points: null })], [], nameOf)
    expect(games.map((game) => game.points)).toEqual([16, -11, undefined])
  })

  it("gives the figures and the games from the totals of every game finished, not from the few that are listed", () => {
    const { games, stats, perGame } = memberGamesOf(
      [row()],
      [totals(), totals({ game: "hanabi", gamesPlayed: 3, wins: 2 }), totals({ game: "skyjo", gamesPlayed: 0, wins: 0 }), totals({ game: "zz", gamesPlayed: 12, wins: 0 })],
      nameOf,
    )
    expect(games).toHaveLength(1)
    expect(stats).toEqual({ played: 27, wins: 8, winRate: 30, favourite: "Courtisans" })
    // The most played first, then by name; a game with no game finished has no row
    expect(perGame).toEqual([
      { slug: "courtisans", name: "Courtisans", played: 12, wins: 6 },
      { slug: "zz", name: "zz", played: 12, wins: 0 },
      { slug: "hanabi", name: "Hanabi", played: 3, wins: 2 },
    ])
  })

  it("gives a rank for each game rated, the highest first, with how far the member is through its division", () => {
    const { ranks } = memberGamesOf(
      [],
      [
        totals({ game: "hanabi", points: 160, ratedGames: 6, rank: { tier: "Apprentice", division: 2 }, rankProgress: { points: 60, needed: 100 } }),
        totals({ game: "courtisans", points: 1450, ratedGames: 8, rank: { tier: "Platinum", division: 3 }, rankProgress: { points: 50, needed: 100 } }),
        totals({ game: "skyjo", points: 2400, ratedGames: 40, rank: { tier: "Legend" }, rankProgress: null }),
        totals({ game: "zz", points: null }),
      ],
      nameOf,
    )
    expect(ranks.map((entry) => [entry.slug, entry.name, rankLabel(entry.rank), entry.progress])).toEqual([
      ["skyjo", "Skyjo", "Legend", null],
      ["courtisans", "Courtisans", "Platinum III", { points: 50, needed: 100 }],
      ["hanabi", "Hanabi", "Apprentice II", { points: 60, needed: 100 }],
    ])
    // The points a rank is read from are not sent on
    expect(JSON.stringify(ranks)).not.toMatch(/"points":(160|1450|2400)/)
  })

  it("orders games rated with as many points by name", () => {
    const { ranks } = memberGamesOf(
      [],
      [totals({ game: "skyjo", points: 100, rank: { tier: "Apprentice", division: 2 } }), totals({ game: "hanabi", points: 100, rank: { tier: "Apprentice", division: 2 } })],
      nameOf,
    )
    expect(ranks.map((entry) => entry.name)).toEqual(["Hanabi", "Skyjo"])
  })

  it("keeps a rank for a game rated that has no totals, and draws no row for it", () => {
    const result = memberGamesOf([], [totals({ game: "hanabi", gamesPlayed: 0, wins: 0, points: 100, ratedGames: 5, rank: { tier: "Apprentice", division: 2 }, rankProgress: { points: 0, needed: 100 } })], nameOf)
    expect(result.perGame).toEqual([])
    expect(result.ranks).toHaveLength(1)
  })
})
