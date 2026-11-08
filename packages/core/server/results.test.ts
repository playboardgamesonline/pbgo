import type { AnyGameDefinition, PlayerResult, Results } from "@pbgo/engine-kit"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PlayableGame } from "../lib/binding"
import type { GameRow } from "./games"

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ rpc: mocks.rpc }) }))

import { engineVersion, gameResultOf, markGameStarted, markTakenOver, recordGameResult } from "./results"

/** A game whose state is just its results: what the view of a finished game says, whatever the game. */
type State = { results: Results | null }
const GAME = {
  id: "testgame",
  name: "Test game",
  minPlayers: 2,
  maxPlayers: 4,
  options: { rounds: { type: "number", label: "Rounds", defaultValue: 3, min: 1, max: 5 } },
  clientActions: ["move"],
  setup: () => ({ results: null }),
  apply: (state: State) => state,
  view: (state: State) => ({ results: state.results }),
  isOver: (state: State) => state.results !== null,
} as unknown as AnyGameDefinition
const game = { slug: "testgame", binding: { GAME } } as unknown as PlayableGame

const ann = { id: "p1", nickname: "Ann", avatarUrl: "https://example.com/ann.png" }
const bob = { id: "p2", nickname: "Bob" }
const cy = { id: "p3", nickname: "Cy" }

const line = (playerId: string, total: number, rank: number): PlayerResult => ({ playerId, total, rank, detail: [] })

/** A finished table at which `results` were reached. */
function finished(results: Results | null, partial: Partial<GameRow> = {}): GameRow {
  return {
    code: "ABC234",
    host_id: "p1",
    status: "over",
    players: [ann, bob],
    options: { rounds: 4 },
    state: { results } satisfies State,
    replay: [],
    takeover_votes: [],
    version: 9,
    created_at: "2026-11-08T10:00:00.000Z",
    updated_at: "2026-11-08T10:20:00.000Z",
    ...partial,
  }
}

const duel: Results = { players: [line("p2", 7, 2), line("p1", 12, 1)], winners: ["p1"] }

beforeEach(() => {
  mocks.rpc.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("engineVersion", () => {
  it("is the commit of the deployment, twelve characters of it", () => {
    expect(engineVersion({ VERCEL_GIT_COMMIT_SHA: "7e849d2dd0123456789abcdef0123456789abcde" })).toBe("7e849d2dd012")
  })

  it("is dev where no deployment says it", () => {
    expect(engineVersion({})).toBe("dev")
    expect(engineVersion({ VERCEL_GIT_COMMIT_SHA: "" })).toBe("dev")
  })
})

describe("gameResultOf", () => {
  it("tells each seat of the table, in the order they sat down, with the outcome of the engine's results", () => {
    expect(gameResultOf(GAME, finished(duel), { env: {} })).toEqual({
      rating_kind: "elo",
      end_reason: "finished",
      coop_outcome: null,
      coop_score: null,
      engine_version: "dev",
      options: { rounds: 4 },
      participants: [
        { seat: 0, player: "p1", name: "Ann", avatar_url: "https://example.com/ann.png", rank: 1, score: 12, outcome: "win" },
        { seat: 1, player: "p2", name: "Bob", avatar_url: null, rank: 2, score: 7, outcome: "loss" },
      ],
    })
  })

  it("reads a tie for the first place of some of the players as a win for them, and a tie of everybody as a draw", () => {
    const table = finished(null, { players: [ann, bob, cy] })
    const tie: Results = { players: [line("p1", 9, 1), line("p2", 9, 1), line("p3", 4, 3)], winners: ["p1", "p2"] }
    expect(gameResultOf(GAME, { ...table, state: { results: tie } }, { env: {} })?.participants.map(({ player, outcome, rank }) => [player, outcome, rank])).toEqual([
      ["p1", "win", 1],
      ["p2", "win", 1],
      ["p3", "loss", 3],
    ])
    const all: Results = { players: [line("p1", 9, 1), line("p2", 9, 1)], winners: ["p1", "p2"] }
    expect(gameResultOf(GAME, finished(all), { env: {} })?.participants.map(({ outcome }) => outcome)).toEqual(["draw", "draw"])
  })

  it("tells a table that won or lost together by its outcome and its score, and rates it apart from the games played against each other", () => {
    const won: Results = { coop: "won", players: [line("p1", 24, 1), line("p2", 24, 1)], winners: ["p1", "p2"] }
    const lost: Results = { coop: "lost", players: [line("p1", 17, 1), line("p2", 17, 1)], winners: [] }
    expect(gameResultOf(GAME, finished(won), { env: {} })).toMatchObject({ rating_kind: "coop", coop_outcome: "won", coop_score: 24, participants: [{ outcome: "coop_win" }, { outcome: "coop_win" }] })
    expect(gameResultOf(GAME, finished(lost), { env: {} })).toMatchObject({ rating_kind: "coop", coop_outcome: "lost", coop_score: 17, participants: [{ outcome: "coop_loss" }, { outcome: "coop_loss" }] })
  })

  it("writes the options the game was played with, the engine's defaults where the table chose none", () => {
    expect(gameResultOf(GAME, finished(duel, { options: {} }), { env: {} })?.options).toEqual({ rounds: 3 })
    expect(gameResultOf(GAME, finished(duel, { options: { rounds: 5, ghost: true } }), { env: {} })?.options).toEqual({ rounds: 5 })
  })

  it("carries what the request that ended the game knows of it: a debug command, the players the takeover played for, why it ended", () => {
    const result = gameResultOf(GAME, finished(duel), { env: {}, debug: true, takenOver: ["p2"], endReason: "timeout" })
    expect(result).toMatchObject({ end_reason: "timeout", debug: true, taken_over: ["p2"] })
    const plain = gameResultOf(GAME, finished(duel), { env: {} })
    expect(plain).not.toHaveProperty("debug")
    expect(plain).not.toHaveProperty("taken_over")
  })

  it("holds whole numbers only: a total is rounded, a figure that is not a number or a place below the first is nothing", () => {
    const odd: Results = { players: [{ playerId: "p1", total: 7.5, rank: 1, detail: [] }, { playerId: "p2", total: Number.NaN, rank: 0, detail: [] }], winners: ["p1"] }
    expect(gameResultOf(GAME, finished(odd), { env: {} })?.participants).toMatchObject([
      { player: "p1", score: 8, rank: 1 },
      { player: "p2", score: null, rank: null },
    ])
  })

  it("leaves out a player the table does not know, and says nothing when the game has no results or no state", () => {
    const stranger: Results = { players: [line("p1", 3, 1), line("p9", 1, 2)], winners: ["p1"] }
    expect(gameResultOf(GAME, finished(stranger), { env: {} })?.participants.map(({ player }) => player)).toEqual(["p1"])
    expect(gameResultOf(GAME, finished({ players: [line("p9", 1, 1)], winners: ["p9"] }), { env: {} })).toBeNull()
    expect(gameResultOf(GAME, finished(null), { env: {} })).toBeNull()
    expect(gameResultOf(GAME, finished(duel, { state: null }), { env: {} })).toBeNull()
  })
})

describe("recordGameResult", () => {
  it("asks the database to write the game of the table, as of the instant the write that ended it was made", async () => {
    mocks.rpc.mockResolvedValue({ data: "7c1d3a52-0000-4000-8000-000000000001", error: null })
    await recordGameResult(game, finished(duel))
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("record_game_result", {
      p_game: "testgame",
      p_code: "ABC234",
      p_table_created_at: "2026-11-08T10:00:00.000Z",
      p_finished_at: "2026-11-08T10:20:00.000Z",
      p_result: gameResultOf(GAME, finished(duel)),
    })
  })

  it("tells the database what the request that ended the game knows of it", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    await recordGameResult(game, finished(duel), { debug: true, takenOver: ["p2"] })
    expect(mocks.rpc.mock.calls[0]?.[1].p_result).toMatchObject({ debug: true, taken_over: ["p2"] })
  })

  it("never throws: a refusal of the database is logged by its code and its message, never by the row it holds", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "function public.record_game_result does not exist", details: "Ann, Bob" } })
    await expect(recordGameResult(game, finished(duel))).resolves.toBeUndefined()
    mocks.rpc.mockRejectedValue(new Error("network down"))
    await expect(recordGameResult(game, finished(duel))).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("Ann")
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("ABC234")
  })

  it("writes nothing for a game that is over and tells no results, or a table with no dates, and says so", async () => {
    await recordGameResult(game, finished(null))
    await recordGameResult(game, finished(duel, { updated_at: undefined }))
    await recordGameResult(game, finished(duel, { created_at: undefined }))
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledTimes(3)
  })
})

describe("markGameStarted", () => {
  it("tells the database that play began at the instant of the write that began it", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    await markGameStarted({ slug: "testgame" }, { code: "ABC234", updated_at: "2026-11-08T10:10:00.000Z" })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("mark_game_started", { p_game: "testgame", p_code: "ABC234", p_at: "2026-11-08T10:10:00.000Z" })
  })

  it("writes nothing for a table with no date, and never throws", async () => {
    await markGameStarted({ slug: "testgame" }, { code: "ABC234" })
    expect(mocks.rpc).not.toHaveBeenCalled()
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "function does not exist" } })
    await expect(markGameStarted({ slug: "testgame" }, { code: "ABC234", updated_at: "2026-11-08T10:10:00.000Z" })).resolves.toBeUndefined()
    mocks.rpc.mockRejectedValue(new Error("network down"))
    await expect(markGameStarted({ slug: "testgame" }, { code: "ABC234", updated_at: "2026-11-08T10:10:00.000Z" })).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledTimes(2)
  })
})

describe("markTakenOver", () => {
  it("tells the database which players the others played for", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    await markTakenOver({ slug: "testgame" }, "ABC234", ["p2", "p3"])
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("mark_taken_over", { p_game: "testgame", p_code: "ABC234", p_players: ["p2", "p3"] })
  })

  it("writes nothing for no player, and never throws", async () => {
    await markTakenOver({ slug: "testgame" }, "ABC234", [])
    expect(mocks.rpc).not.toHaveBeenCalled()
    mocks.rpc.mockRejectedValue(new Error("network down"))
    await expect(markTakenOver({ slug: "testgame" }, "ABC234", ["p2"])).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledTimes(1)
  })
})
