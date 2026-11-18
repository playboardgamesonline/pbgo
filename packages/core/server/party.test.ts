import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ readGroupOf: vi.fn(), readMemberTables: vi.fn(), readTableSettingsOf: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./groups", () => ({ readGroupOf: mocks.readGroupOf }))
vi.mock("./tables", () => ({ readMemberTables: mocks.readMemberTables }))
vi.mock("./table-settings", () => ({ readTableSettingsOf: mocks.readTableSettingsOf }))

import { PARTY_TABLE_TTL_SECONDS } from "../lib/party"
import { assertLeadsGroup, readPartyTable } from "./party"

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const BOB = "5d0f5b8e-6f8e-4f55-9d6e-3f1a2b4c5d6e"
const CY = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
const GROUP = { id: "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f", leader: ANN, members: [ANN, BOB, CY] }
const NOW = Date.parse("2026-11-18T12:00:00.000Z")
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString()

/** A table of the leader, who hosts it with the seat `s-ann`: the seats of the people at it are `s-<name>`. */
const table = (over: Record<string, unknown> = {}) => ({
  game: "courtisans",
  code: "ABC234",
  status: "lobby",
  hostId: "s-ann",
  players: [{ id: "s-ann", nickname: "Ann" }],
  options: {},
  seat: "s-ann",
  createdAt: ago(20),
  updatedAt: ago(5),
  ...over,
})

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.readGroupOf.mockResolvedValue(GROUP)
  mocks.readTableSettingsOf.mockResolvedValue({ visibility: "private", seats: 3, party: true })
  // The tables of the leader, then the tables of whoever else asks
  mocks.readMemberTables.mockImplementation(async (id: string) => (id === ANN ? [table()] : []))
})

describe("the table that a group's leader opened for it", () => {
  it("is the leader's own, seen by the leader as the one they host and sit at", async () => {
    expect(await readPartyTable(ANN, NOW)).toEqual({ game: "courtisans", code: "ABC234", status: "lobby", seats: 3, seated: 1, you: true, host: true, waited: 20 })
    expect(mocks.readGroupOf).toHaveBeenCalledExactlyOnceWith(ANN)
    expect(mocks.readMemberTables).toHaveBeenCalledExactlyOnceWith(ANN)
  })

  it("is the table of the leader of the member's group, which the member does not sit at yet", async () => {
    expect(await readPartyTable(BOB, NOW)).toEqual({ game: "courtisans", code: "ABC234", status: "lobby", seats: 3, seated: 1, you: false, host: false, waited: 20 })
    expect(mocks.readMemberTables).toHaveBeenCalledWith(ANN)
    expect(mocks.readMemberTables).toHaveBeenCalledWith(BOB)
  })

  it("costs a group that has nothing to sit at two reads of the database: its group and its leader's tables", async () => {
    mocks.readMemberTables.mockResolvedValue([])
    expect(await readPartyTable(BOB, NOW)).toBeNull()
    expect(mocks.readGroupOf).toHaveBeenCalledOnce()
    expect(mocks.readMemberTables).toHaveBeenCalledExactlyOnceWith(ANN)
    expect(mocks.readTableSettingsOf).not.toHaveBeenCalled()
  })

  it("says the member sits at it once their seat is there, and counts those who sit", async () => {
    mocks.readMemberTables.mockImplementation(async (id: string) => {
      const seated = table({ players: [{ id: "s-ann", nickname: "Ann" }, { id: "s-bob", nickname: "Bob" }, { id: "s-cy", nickname: "Cy", left: true }] })
      return id === ANN ? [seated] : id === BOB ? [{ ...seated, seat: "s-bob" }] : []
    })
    expect(await readPartyTable(BOB, NOW)).toMatchObject({ you: true, host: false, seated: 2, seats: 3 })
  })

  it("follows the table into its ready check, which takes everybody who sits at it to the board", async () => {
    mocks.readMemberTables.mockImplementation(async (id: string) => (id === ANN ? [table({ status: "starting" })] : []))
    expect(await readPartyTable(ANN, NOW)).toMatchObject({ status: "starting" })
  })

  it("is nobody's when the account is in no group: the code of a table is told to the people of its group only", async () => {
    mocks.readGroupOf.mockResolvedValue(null)
    expect(await readPartyTable(BOB, NOW)).toBeNull()
    expect(mocks.readMemberTables).not.toHaveBeenCalled()
  })

  it("is not a table that the leader only sits at: they must host it", async () => {
    mocks.readMemberTables.mockImplementation(async (id: string) => (id === ANN ? [table({ hostId: "s-other" })] : []))
    expect(await readPartyTable(BOB, NOW)).toBeNull()
  })

  it("is not a table that was not opened for the group, a game in progress, or one that was forgotten", async () => {
    mocks.readTableSettingsOf.mockResolvedValue({ visibility: "private", seats: 3 })
    expect(await readPartyTable(BOB, NOW)).toBeNull()
    mocks.readTableSettingsOf.mockResolvedValue({ visibility: "private", seats: 3, party: true })
    mocks.readMemberTables.mockImplementation(async (id: string) => (id === ANN ? [table({ status: "playing" })] : []))
    expect(await readPartyTable(BOB, NOW)).toBeNull()
    mocks.readMemberTables.mockImplementation(async (id: string) => (id === ANN ? [table({ createdAt: ago(PARTY_TABLE_TTL_SECONDS + 1) })] : []))
    expect(await readPartyTable(BOB, NOW)).toBeNull()
  })

  it("is the one opened last when the leader has several, and the first that was opened for the group", async () => {
    mocks.readMemberTables.mockImplementation(async (id: string) =>
      id === ANN ? [table({ code: "OLD111", createdAt: ago(600) }), table({ code: "NEW222", createdAt: ago(10) }), table({ code: "PLAIN3", createdAt: ago(5) })] : [],
    )
    mocks.readTableSettingsOf.mockImplementation(async (_game: string, code: string) => (code === "PLAIN3" ? { visibility: "private" } : { visibility: "private", seats: 3, party: true }))
    expect((await readPartyTable(BOB, NOW))?.code).toBe("NEW222")
  })

  it("is nobody's where the functions of the migrations it stands on are not applied", async () => {
    mocks.readMemberTables.mockRejectedValue({ code: "PGRST202" })
    expect(await readPartyTable(BOB, NOW)).toBeNull()
  })

  it("throws what else the database says", async () => {
    mocks.readMemberTables.mockRejectedValue(new Error("boom"))
    await expect(readPartyTable(BOB, NOW)).rejects.toThrow("boom")
  })
})

describe("who opens a table for a group", () => {
  it("is the leader of a group", async () => {
    await expect(assertLeadsGroup(ANN)).resolves.toBeUndefined()
  })

  it.each([
    ["a member who does not lead it", BOB],
    ["a guest", null],
  ])("is not %s: 403 GROUP_NOT_LEADER", async (_who, id) => {
    const error = await assertLeadsGroup(id).then(
      () => null,
      (reason: unknown) => reason as { code?: string; status?: number },
    )
    expect([error?.code, error?.status]).toEqual(["GROUP_NOT_LEADER", 403])
  })

  it("is not a member with no group", async () => {
    mocks.readGroupOf.mockResolvedValue(null)
    await expect(assertLeadsGroup(ANN)).rejects.toMatchObject({ code: "GROUP_NOT_LEADER", status: 403 })
  })
})
