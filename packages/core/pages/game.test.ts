import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PlayableGame } from "../lib/binding"
import { GamePage } from "./game"

const h = vi.hoisted(() => ({
  row: null as { code: string; status: "lobby" | "starting" | "playing" | "over" } | null,
  /** What the table is once what is due on it has been settled (its ready check that ran out of time, the deadline of its game), when something was */
  settled: null as { code: string; status: "lobby" | "starting" | "playing" | "over" } | null,
  failure: null as Error | null,
  redirected: [] as string[],
}))

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    h.redirected.push(path)
    throw new Error(`NEXT_REDIRECT ${path}`)
  },
}))
vi.mock("../components/game/game-client", () => ({ GameClient: () => null }))
vi.mock("../lib/locale-server", () => ({ getLocale: async () => "en" }))
vi.mock("../lib/settings-server", () => ({ loadSettings: async () => ({ title: "Courtisans" }) }))
vi.mock("../server/games", () => ({
  loadGameData: async () => ({ cards: [] }),
  readGame: async () => {
    if (h.failure) throw h.failure
    if (!h.row) throw new Error("GAME_NOT_FOUND")
    return h.row
  },
}))
vi.mock("../server/settle", () => ({
  settleTable: async (_game: unknown, row: unknown) => h.settled ?? row,
}))

const game = { slug: "courtisans" } as PlayableGame

beforeEach(() => {
  h.row = null
  h.settled = null
  h.failure = null
  h.redirected = []
})

describe("GamePage", () => {
  it("sends the link of a table that waits for players to its page on the hub", async () => {
    h.row = { code: "ABC234", status: "lobby" }
    await expect(GamePage({ game, code: "abc234" })).rejects.toThrow("NEXT_REDIRECT /game/courtisans/ABC234")
    expect(h.redirected).toEqual(["/game/courtisans/ABC234"])
  })

  it("shows the board of a table that is starting, started or over, with the game's data and its code in capitals", async () => {
    for (const status of ["starting", "playing", "over"] as const) {
      h.row = { code: "ABC234", status }
      const element = await GamePage({ game, code: "abc234" })
      expect(element.props).toEqual({ code: "ABC234", data: { cards: [] } })
    }
    expect(h.redirected).toEqual([])
  })

  it("sends a table whose ready check ran out of time, now back in the lobby, to its page on the hub", async () => {
    h.row = { code: "ABC234", status: "starting" }
    h.settled = { code: "ABC234", status: "lobby" }
    await expect(GamePage({ game, code: "abc234" })).rejects.toThrow("NEXT_REDIRECT /game/courtisans/ABC234")
  })

  it("leaves a table that does not exist, or that cannot be read, to the client, which says so", async () => {
    expect((await GamePage({ game, code: "zzzzzz" })).props.code).toBe("ZZZZZZ")
    h.failure = new Error("database down")
    expect((await GamePage({ game, code: "abc234" })).props.code).toBe("ABC234")
    expect(h.redirected).toEqual([])
  })
})
