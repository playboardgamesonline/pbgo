import { rankLabel } from "@pbgo/ui/ranks"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ rpc: mocks.rpc, from: mocks.from }) }))

import { MEMBER_GAMES_MAX, readBoard, readHistory, readMemberGames, readMemberTotals, readPlayerStanding } from "./standings"

const USER = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"

beforeEach(() => {
  mocks.rpc.mockReset()
  mocks.from.mockReset()
})

type Answer = { data: unknown; error: unknown }

/** The tables answer in turn: each `from(table)` takes the next answer queued for that table, and what is chained on it (`select`, `eq`, `in`…) is recorded, so that a test can say what was asked. */
function tables(answers: Record<string, Answer[]>) {
  const log: { table: string; calls: [string, unknown[]][] }[] = []
  mocks.from.mockImplementation((table: string) => {
    const entry = { table, calls: [] as [string, unknown[]][] }
    log.push(entry)
    const answer = answers[table]?.shift() ?? { data: null, error: { message: `no answer left for ${table}` } }
    const chain: object = new Proxy(
      {},
      {
        get: (_target, name) =>
          name === "then"
            ? (resolve: (value: Answer) => unknown) => resolve(answer)
            : (...args: unknown[]) => {
                entry.calls.push([String(name), args])
                return chain
              },
      },
    )
    return chain
  })
  return log
}

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

describe("readMemberGames", () => {
  const mine = [
    { game_result_id: "r1", seat: 1, outcome: "win", rank: 1, score: 12, finished_at: "2026-11-08T10:00:00+00:00", game_results: { game: "courtisans", ranked: true, player_count: 3, duration_s: 900, options: { rounds: 3 } } },
    // The database may embed the game as a list of one
    { game_result_id: "r2", seat: 0, outcome: "coop_win", rank: 1, score: 5, finished_at: "2026-11-07T10:00:00+00:00", game_results: [{ game: "hanabi", ranked: false, player_count: 2, duration_s: null, options: null }] },
  ]
  const seated = [
    { game_result_id: "r1", seat: 2, display_name: null, avatar_url: null },
    { game_result_id: "r1", seat: 0, display_name: "Ola", avatar_url: "https://example.com/o.png" },
    { game_result_id: "r1", seat: 1, display_name: "Uma", avatar_url: null },
    { game_result_id: "r2", seat: 0, display_name: "Uma", avatar_url: null },
    { game_result_id: "r2", seat: 1, display_name: "Zed", avatar_url: null },
  ]

  it("is the games the member finished, in any game and the latest first, each with how it ended, the rank points it gave and the others at the table by seat", async () => {
    const log = tables({
      game_participants: [
        { data: mine, error: null },
        { data: seated, error: null },
      ],
      rating_changes: [{ data: [{ game_result_id: "r1", points_before: 144, points_after: 160 }], error: null }],
    })
    expect(await readMemberGames(USER, 20)).toEqual([
      {
        id: "r1",
        game: "courtisans",
        ranked: true,
        finishedAt: "2026-11-08T10:00:00+00:00",
        outcome: "win",
        place: 1,
        score: 12,
        playerCount: 3,
        durationSeconds: 900,
        options: { rounds: 3 },
        points: 16,
        opponents: [
          { name: "Ola", avatarUrl: "https://example.com/o.png" },
          { name: null, avatarUrl: null },
        ],
      },
      { id: "r2", game: "hanabi", ranked: false, finishedAt: "2026-11-07T10:00:00+00:00", outcome: "coop_win", place: 1, score: 5, playerCount: 2, durationSeconds: null, options: {}, points: null, opponents: [{ name: "Zed", avatarUrl: null }] },
    ])
    // What was asked: the member's own seats, the latest first; then everybody seated at those games and what they gave the member
    expect(log.map((query) => query.table)).toEqual(["game_participants", "game_participants", "rating_changes"])
    expect(log[0]?.calls).toEqual(
      expect.arrayContaining([
        ["eq", ["user_id", USER]],
        ["order", ["finished_at", { ascending: false }]],
        ["limit", [20]],
      ]),
    )
    expect(log[1]?.calls).toContainEqual(["in", ["game_result_id", ["r1", "r2"]]])
    expect(log[2]?.calls).toEqual(
      expect.arrayContaining([
        ["eq", ["user_id", USER]],
        ["in", ["game_result_id", ["r1", "r2"]]],
      ]),
    )
  })

  it("asks for no more games than the database would answer in one request", async () => {
    const log = tables({ game_participants: [{ data: [], error: null }] })
    await readMemberGames(USER, 5000)
    expect(log[0]?.calls).toContainEqual(["limit", [MEMBER_GAMES_MAX]])
  })

  it("is empty after one question when the member finished nothing", async () => {
    const log = tables({ game_participants: [{ data: [], error: null }] })
    expect(await readMemberGames(USER, 20)).toEqual([])
    expect(log).toHaveLength(1)
  })

  it("is empty, without asking the database, for an account that is no user of it", async () => {
    expect(await readMemberGames("demo", 20)).toEqual([])
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it("throws what the database says, whichever of the questions it refuses", async () => {
    const error = { message: 'relation "public.game_participants" does not exist' }
    tables({ game_participants: [{ data: null, error }] })
    await expect(readMemberGames(USER, 20)).rejects.toBe(error)

    const refused = { message: "permission denied for table rating_changes" }
    tables({
      game_participants: [
        { data: mine, error: null },
        { data: seated, error: null },
      ],
      rating_changes: [{ data: null, error: refused }],
    })
    await expect(readMemberGames(USER, 20)).rejects.toBe(refused)
  })
})

describe("readMemberTotals", () => {
  it("is the totals of the member in each game they played, the games they won together counted, and the rank their points read as in the games they rated", async () => {
    const log = tables({
      player_stats: [
        {
          data: [
            { game: "courtisans", games_played: 12, wins: 5, coop_wins: 1, seconds_played: 7200 },
            { game: "hanabi", games_played: 3, wins: 0, coop_wins: 2, seconds_played: "5400" },
          ],
          error: null,
        },
      ],
      ratings: [{ data: [{ game: "courtisans", points: 1450, games_played: 8 }], error: null }],
    })
    const totals = await readMemberTotals(USER)
    expect(log.map((query) => query.table).sort()).toEqual(["player_stats", "ratings"])
    expect(log.flatMap((query) => query.calls)).toContainEqual(["eq", ["user_id", USER]])
    expect(totals.map((row) => [row.game, row.gamesPlayed, row.wins, row.secondsPlayed, row.points, row.ratedGames, row.rank && rankLabel(row.rank), row.rankProgress])).toEqual([
      ["courtisans", 12, 6, 7200, 1450, 8, "Platinum III", { points: 50, needed: 100 }],
      ["hanabi", 3, 2, 5400, null, 0, null, null],
    ])
    expect(JSON.stringify(totals)).not.toMatch(/rating"/i)
  })

  it("keeps a game the member rated even when nothing counted its totals, and has no progress at the top", async () => {
    tables({
      player_stats: [{ data: [], error: null }],
      ratings: [{ data: [{ game: "skyjo", points: 2400, games_played: 40 }], error: null }],
    })
    const [row] = await readMemberTotals(USER)
    expect(row).toMatchObject({ game: "skyjo", gamesPlayed: 0, wins: 0, ratedGames: 40, rank: { tier: "Legend" }, rankProgress: null })
  })

  it("is empty for a member who played nothing, and without asking the database for an account that is no user of it", async () => {
    tables({ player_stats: [{ data: [], error: null }], ratings: [{ data: null, error: null }] })
    expect(await readMemberTotals(USER)).toEqual([])
    mocks.from.mockClear()
    expect(await readMemberTotals("demo")).toEqual([])
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it("throws what the database says", async () => {
    const error = { message: 'relation "public.player_stats" does not exist' }
    tables({ player_stats: [{ data: null, error }], ratings: [{ data: [], error: null }] })
    await expect(readMemberTotals(USER)).rejects.toBe(error)
  })
})
