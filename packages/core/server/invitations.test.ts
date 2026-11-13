import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), ensureProfile: vi.fn(), readMemberTables: vi.fn(), readGame: vi.fn(), readTableSettingsOf: vi.fn(), loadSettings: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ rpc: mocks.rpc }) }))
vi.mock("./profiles", () => ({ ensureProfile: mocks.ensureProfile }))
vi.mock("./tables", () => ({ readMemberTables: mocks.readMemberTables }))
vi.mock("./games", () => ({ readGame: mocks.readGame }))
vi.mock("./table-settings", () => ({ readTableSettingsOf: mocks.readTableSettingsOf }))
vi.mock("../lib/settings-server", () => ({ loadSettings: mocks.loadSettings }))

import { INVITATION_TTL_MINUTES, MAX_INVITATIONS_RECEIVED, MAX_INVITATIONS_SENT } from "../lib/invitations"
import { acceptInvitation, declineInvitation, sendInvitation } from "./invitations"

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const ID = "5d0f5b8e-6f8e-4f55-9d6e-3f1a2b4c5d6e"
const account = { id: ANN, nickname: "Ann" } as never
const BOB = { nickname: "Bob", tag: 42 }
const GAME = { slug: "hanabi" } as never
const deps = { loadGame: vi.fn(async (slug: string) => (slug === "hanabi" ? GAME : null)) }
const seat = (id: string, left = false) => ({ id, name: id, ...(left ? { left: true } : {}) })
const table = (over: Record<string, unknown> = {}) => ({ game: "hanabi", code: "K7Q2", status: "lobby", hostId: "p1", players: [seat("p1")], options: {}, seat: "p1", createdAt: "", updatedAt: "", ...over })
const refusedWith = async (promise: Promise<unknown>, code: string, status?: number) => {
  const error = (await promise.then(
    () => null,
    (reason: unknown) => reason,
  )) as { code?: string; status?: number } | null
  expect(error?.code).toBe(code)
  if (status) expect(error?.status).toBe(status)
}

beforeEach(() => {
  for (const mock of [mocks.rpc, mocks.ensureProfile, mocks.readMemberTables, mocks.readGame, mocks.readTableSettingsOf, mocks.loadSettings]) mock.mockReset()
  mocks.ensureProfile.mockResolvedValue({ userId: ANN })
  mocks.readMemberTables.mockResolvedValue([table()])
  mocks.readTableSettingsOf.mockResolvedValue({})
  mocks.loadSettings.mockResolvedValue({ maxPlayers: 4 })
  mocks.rpc.mockResolvedValue({ data: "sent", error: null })
})

describe("sendInvitation", () => {
  it("invites the friend to the lobby the visitor sits at, with the limits and the time that the code gives", async () => {
    expect(await sendInvitation(deps, account, BOB, { game: "hanabi", code: "k7q2" })).toBe("sent")
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("invitation_send", {
      p_user: ANN,
      p_nickname: "Bob",
      p_tag: 42,
      p_game: "hanabi",
      p_code: "K7Q2",
      p_ttl: `${INVITATION_TTL_MINUTES} minutes`,
      p_max_sent: MAX_INVITATIONS_SENT,
      p_max_received: MAX_INVITATIONS_RECEIVED,
    })
  })

  it("refuses a game that cannot be played here, with 404", async () => {
    await refusedWith(sendInvitation(deps, account, BOB, { game: "nope", code: "K7Q2" }), "GAME_NOT_FOUND", 404)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("refuses a table the visitor does not sit at: nobody is pushed a code that is not the host's to give", async () => {
    mocks.readMemberTables.mockResolvedValue([table({ code: "OTHER1" }), table({ game: "courtisans" })])
    await refusedWith(sendInvitation(deps, account, BOB, { game: "hanabi", code: "K7Q2" }), "INVITE_NOT_AT_TABLE", 403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it.each(["starting", "playing"])("refuses a table that is %s: only a lobby that waits is invited to", async (status) => {
    mocks.readMemberTables.mockResolvedValue([table({ status })])
    await refusedWith(sendInvitation(deps, account, BOB, { game: "hanabi", code: "K7Q2" }), "GAME_IN_PROGRESS", 409)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("refuses a table whose seats are all taken, and counts a seat that left as free", async () => {
    mocks.readMemberTables.mockResolvedValue([table({ players: [seat("p1"), seat("p2"), seat("p3"), seat("p4")] })])
    await refusedWith(sendInvitation(deps, account, BOB, { game: "hanabi", code: "K7Q2" }), "GAME_FULL", 409)
    mocks.readMemberTables.mockResolvedValue([table({ players: [seat("p1"), seat("p2"), seat("p3"), seat("p4", true)] })])
    expect(await sendInvitation(deps, account, BOB, { game: "hanabi", code: "K7Q2" })).toBe("sent")
  })

  it("reads the seats the host set for the table, not only the game's most", async () => {
    mocks.readTableSettingsOf.mockResolvedValue({ seats: 2 })
    mocks.readMemberTables.mockResolvedValue([table({ players: [seat("p1"), seat("p2")] })])
    await refusedWith(sendInvitation(deps, account, BOB, { game: "hanabi", code: "K7Q2" }), "GAME_FULL", 409)
  })

  it.each([
    ["missing", "FRIEND_NOT_FOUND", 404],
    ["self", "FRIEND_SELF", 400],
    ["not_friends", "INVITE_NOT_FRIEND", 403],
    ["too_many_sent", "INVITE_LIMIT", 409],
    ["unavailable", "INVITE_UNAVAILABLE", 409],
  ])("turns the database's %s into %s", async (word, code, status) => {
    mocks.rpc.mockResolvedValue({ data: word, error: null })
    await refusedWith(sendInvitation(deps, account, BOB, { game: "hanabi", code: "K7Q2" }), code, status)
  })

  it("throws a word it does not know, and what the database says", async () => {
    mocks.rpc.mockResolvedValue({ data: "maybe", error: null })
    await expect(sendInvitation(deps, account, BOB, { game: "hanabi", code: "K7Q2" })).rejects.toThrow('answered "maybe"')
    const error = { code: "57014", message: "timeout" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(sendInvitation(deps, account, BOB, { game: "hanabi", code: "K7Q2" })).rejects.toBe(error)
  })

  it("is unavailable when the sender has no profile to be named by", async () => {
    mocks.ensureProfile.mockResolvedValue(null)
    await refusedWith(sendInvitation(deps, account, BOB, { game: "hanabi", code: "K7Q2" }), "INVITATIONS_UNAVAILABLE", 503)
  })
})

const answers = (peek: unknown, accept: unknown = { result: "accepted", game: "hanabi", code: "K7Q2" }) =>
  mocks.rpc.mockImplementation(async (_name: string, args: { p_answer: string }) => ({ data: args.p_answer === "peek" ? peek : accept, error: null }))
const PENDING = { result: "pending", game: "hanabi", code: "K7Q2" }
const lobby = (over: Record<string, unknown> = {}) => ({ code: "K7Q2", status: "lobby", players: [seat("p1")], ...over })

describe("acceptInvitation", () => {
  beforeEach(() => {
    mocks.readMemberTables.mockResolvedValue([])
    mocks.readGame.mockResolvedValue(lobby())
  })

  it("looks at the invitation, then at the table, then spends it, and gives the table to go to", async () => {
    answers(PENDING)
    expect(await acceptInvitation(deps, account, ID)).toEqual({ game: "hanabi", code: "K7Q2" })
    expect(mocks.rpc.mock.calls.map(([name, args]) => [name, args.p_answer])).toEqual([["invitation_answer", "peek"], ["invitation_answer", "accept"]])
    expect(mocks.rpc).toHaveBeenCalledWith("invitation_answer", { p_user: ANN, p_id: ID, p_answer: "accept" })
  })

  it("is gone for an invitation that is not theirs, was answered or whose sender is not a friend any more", async () => {
    answers({ result: "missing" })
    await refusedWith(acceptInvitation(deps, account, ID), "INVITE_GONE", 404)
  })

  it("is expired for one whose time has passed: 410", async () => {
    answers({ result: "expired" })
    await refusedWith(acceptInvitation(deps, account, ID), "INVITE_EXPIRED", 410)
  })

  it("says the table does not exist any more when its game is not here or its row is deleted, and keeps the invitation", async () => {
    answers({ result: "pending", game: "retired", code: "K7Q2" })
    await refusedWith(acceptInvitation(deps, account, ID), "INVITE_TABLE_GONE", 404)
    answers(PENDING)
    const { ApiError } = await import("./api")
    mocks.readGame.mockRejectedValue(new ApiError("GAME_NOT_FOUND", 404))
    await refusedWith(acceptInvitation(deps, account, ID), "INVITE_TABLE_GONE", 404)
    expect(mocks.rpc.mock.calls.every(([, args]) => args.p_answer === "peek")).toBe(true)
  })

  it("says the game began when the table is no lobby and they do not sit at it, and keeps the invitation", async () => {
    answers(PENDING)
    mocks.readGame.mockResolvedValue(lobby({ status: "playing" }))
    await refusedWith(acceptInvitation(deps, account, ID), "INVITE_TABLE_STARTED", 409)
    expect(mocks.rpc.mock.calls.every(([, args]) => args.p_answer === "peek")).toBe(true)
  })

  it("says the table is full when every seat is taken, and keeps the invitation", async () => {
    answers(PENDING)
    mocks.readGame.mockResolvedValue(lobby({ players: [seat("p1"), seat("p2"), seat("p3"), seat("p4")] }))
    await refusedWith(acceptInvitation(deps, account, ID), "INVITE_TABLE_FULL", 409)
    expect(mocks.rpc.mock.calls.every(([, args]) => args.p_answer === "peek")).toBe(true)
  })

  it("only takes them to the table when they sit at it already, even if it is full or began", async () => {
    answers(PENDING)
    mocks.readMemberTables.mockResolvedValue([table({ players: [seat("p1"), seat("p2"), seat("p3"), seat("p4")], status: "playing" })])
    mocks.readGame.mockResolvedValue(lobby({ status: "playing", players: [seat("p1"), seat("p2"), seat("p3"), seat("p4")] }))
    expect(await acceptInvitation(deps, account, ID)).toEqual({ game: "hanabi", code: "K7Q2" })
  })

  it("is gone when the invitation was answered between the look and the answer", async () => {
    answers(PENDING, { result: "missing" })
    await refusedWith(acceptInvitation(deps, account, ID), "INVITE_GONE", 404)
    answers(PENDING, { result: "expired" })
    await refusedWith(acceptInvitation(deps, account, ID), "INVITE_EXPIRED", 410)
  })
})

describe("declineInvitation", () => {
  it("declines, and says declined even for an invitation that is gone", async () => {
    mocks.rpc.mockResolvedValue({ data: { result: "declined", game: "hanabi", code: "K7Q2" }, error: null })
    expect(await declineInvitation(account, ID)).toBe("declined")
    expect(mocks.rpc).toHaveBeenCalledWith("invitation_answer", { p_user: ANN, p_id: ID, p_answer: "decline" })
    mocks.rpc.mockResolvedValue({ data: { result: "missing" }, error: null })
    expect(await declineInvitation(account, ID)).toBe("declined")
  })

  it("throws what the database says", async () => {
    const error = { code: "57014", message: "timeout" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(declineInvitation(account, ID)).rejects.toBe(error)
  })
})
