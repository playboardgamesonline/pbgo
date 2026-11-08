import { rankLabel } from "@pbgo/ui/ranks"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ rpc: mocks.rpc }) }))

import { readBoard, readHistory, readPlayerStanding } from "./standings"

const USER = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"

beforeEach(() => {
  mocks.rpc.mockReset()
})

describe("readBoard", () => {
  it("asks for the best players of the game and reads each one's rank points as a rank, never a rating", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        { user_id: "a", display_name: "Ann", avatar_url: "https://example.com/a.png", place: 1, points: 2450, wins: 30, games_played: 40 },
        { user_id: "b", display_name: null, avatar_url: null, place: 2, points: 1450, wins: 9, games_played: 14 },
      ],
      error: null,
    })
    const board = await readBoard("courtisans", 100)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("game_standings", { p_game: "courtisans", p_limit: 100 })
    expect(board.map((row) => [row.userId, row.name, row.place, rankLabel(row.rank), row.wins, row.gamesPlayed])).toEqual([
      ["a", "Ann", 1, "Legend", 30, 40],
      ["b", null, 2, "Platinum III", 9, 14],
    ])
    expect(JSON.stringify(board)).not.toMatch(/rating/i)
  })

  it("is empty when nobody is on the board, or when the database answers nothing", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    expect(await readBoard("courtisans", 100)).toEqual([])
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await readBoard("courtisans", 100)).toEqual([])
  })

  it("throws what the database says, so that the page draws its empty state and logs it", async () => {
    const error = { message: "function public.game_standings does not exist" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(readBoard("courtisans", 100)).rejects.toBe(error)
  })
})

describe("readPlayerStanding", () => {
  const row = { games_played: 12, wins: 5, seconds_played: 7200, rated_games: 8, rated_wins: 3, display_name: "Uma", avatar_url: null, place: 4, points: 1450, pool_size: 31 }

  it("is the totals of the player, their place and their rank with how far they are through its division", async () => {
    mocks.rpc.mockResolvedValue({ data: [row], error: null })
    const standing = await readPlayerStanding(USER, "courtisans")
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("player_standing", { p_user: USER, p_game: "courtisans" })
    expect(standing).toMatchObject({ gamesPlayed: 12, wins: 5, secondsPlayed: 7200, ratedGames: 8, ratedWins: 3, name: "Uma", place: 4, rankProgress: { points: 50, needed: 100 }, poolSize: 31 })
    expect(rankLabel(standing.rank!)).toBe("Platinum III")
  })

  it("has a rank from the first rated game, and no place until the player has rated enough games to be on the board", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ ...row, rated_games: 3, rated_wins: 1, place: null, points: 140 }], error: null })
    const standing = await readPlayerStanding(USER, "courtisans")
    expect(rankLabel(standing.rank!)).toBe("Apprentice II")
    expect(standing).toMatchObject({ place: null, rankProgress: { points: 40, needed: 100 }, ratedGames: 3 })
  })

  it("has no rank for a player who has rated no game, whatever else they played", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ ...row, rated_games: 0, rated_wins: 0, display_name: null, place: null, points: null }], error: null })
    expect(await readPlayerStanding(USER, "courtisans")).toMatchObject({ gamesPlayed: 12, rank: null, rankProgress: null, place: null })
  })

  it("has no points at the top, where a rank is a place", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ ...row, place: 2, points: 2400 }], error: null })
    const standing = await readPlayerStanding(USER, "courtisans")
    expect(standing.rank).toEqual({ tier: "Legend" })
    expect(standing.rankProgress).toBeNull()
  })

  it("is all zeros for a player the database does not know", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    expect(await readPlayerStanding(USER, "courtisans")).toEqual({
      gamesPlayed: 0,
      wins: 0,
      secondsPlayed: 0,
      ratedGames: 0,
      ratedWins: 0,
      name: null,
      avatarUrl: null,
      place: null,
      rank: null,
      rankProgress: null,
      poolSize: 0,
    })
  })

  it("asks the database nothing for an account that is no user of it, the demo account of development, whose id is not a uuid", async () => {
    expect(await readPlayerStanding("demo", "courtisans")).toMatchObject({ gamesPlayed: 0, rank: null, place: null, poolSize: 0 })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("reads the figures the database sends as text, since a big integer may arrive so", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ ...row, seconds_played: "90000000000" }], error: null })
    expect((await readPlayerStanding(USER, "courtisans")).secondsPlayed).toBe(90000000000)
  })

  it("throws what the database says", async () => {
    const error = { message: "permission denied" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(readPlayerStanding(USER, "courtisans")).rejects.toBe(error)
  })
})

describe("readHistory", () => {
  it("is the games the player finished, each with how it ended, the rank points it gave and the others at the table", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: "g1",
          finished_at: "2026-11-08T10:00:00+00:00",
          outcome: "win",
          place: 1,
          score: 12,
          player_count: 3,
          duration_s: 900,
          options: { sevenWonders: true, rounds: 3 },
          points: 48,
          opponents: [
            { name: "Ola", avatarUrl: "https://example.com/o.png" },
            { name: null, avatarUrl: null },
          ],
        },
        { id: "g2", finished_at: "2026-11-07T10:00:00+00:00", outcome: "coop_win", place: 1, score: 5, player_count: 2, duration_s: null, options: null, points: null, opponents: null },
      ],
      error: null,
    })
    const history = await readHistory(USER, "courtisans", 10)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("player_history", { p_user: USER, p_game: "courtisans", p_limit: 10 })
    expect(history).toEqual([
      {
        id: "g1",
        finishedAt: "2026-11-08T10:00:00+00:00",
        outcome: "win",
        place: 1,
        score: 12,
        playerCount: 3,
        durationSeconds: 900,
        options: { sevenWonders: true, rounds: 3 },
        points: 48,
        opponents: [
          { name: "Ola", avatarUrl: "https://example.com/o.png" },
          { name: null, avatarUrl: null },
        ],
      },
      { id: "g2", finishedAt: "2026-11-07T10:00:00+00:00", outcome: "coop_win", place: 1, score: 5, playerCount: 2, durationSeconds: null, options: {}, points: null, opponents: [] },
    ])
  })

  it("is empty, without asking the database, for an account that is no user of it", async () => {
    expect(await readHistory("demo", "courtisans", 10)).toEqual([])
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("is empty for a player who finished nothing, and throws what the database says", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    expect(await readHistory(USER, "courtisans", 10)).toEqual([])
    const error = { message: "function public.player_history does not exist" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(readHistory(USER, "courtisans", 10)).rejects.toBe(error)
  })
})
