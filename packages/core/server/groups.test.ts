import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), ensureProfile: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ rpc: mocks.rpc }) }))
vi.mock("./profiles", () => ({ ensureProfile: mocks.ensureProfile }))

import { MAX_GROUP_MEMBERS } from "../lib/groups"
import { INVITATION_TTL_MINUTES, MAX_INVITATIONS_RECEIVED, MAX_INVITATIONS_SENT } from "../lib/invitations"
import { acceptGroupInvitation, askToJoinGroup, groupsNotApplied, handOverLead, inviteToGroup, leaveGroup, readGroupOf, removeFromGroup } from "./groups"

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const BOB_ID = "5d0f5b8e-6f8e-4f55-9d6e-3f1a2b4c5d6e"
const GROUP_ID = "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f"
const account = { id: ANN, nickname: "Ann" } as never
const BOB = { nickname: "Bob", tag: 42 }
const LIMITS = { p_ttl: `${INVITATION_TTL_MINUTES} minutes`, p_max_sent: MAX_INVITATIONS_SENT, p_max_received: MAX_INVITATIONS_RECEIVED, p_max_members: MAX_GROUP_MEMBERS }

const refusedWith = async (promise: Promise<unknown>, code: string, status?: number) => {
  const error = (await promise.then(
    () => null,
    (reason: unknown) => reason,
  )) as { code?: string; status?: number } | null
  expect(error?.code).toBe(code)
  if (status) expect(error?.status).toBe(status)
}

beforeEach(() => {
  mocks.rpc.mockReset()
  mocks.ensureProfile.mockReset()
  mocks.ensureProfile.mockResolvedValue({ userId: ANN })
  mocks.rpc.mockResolvedValue({ data: "sent", error: null })
})

describe("inviteToGroup", () => {
  it("invites the friend of the handle to the group of the account, with the limits the code gives", async () => {
    expect(await inviteToGroup(account, BOB)).toBe("sent")
    expect(mocks.ensureProfile).toHaveBeenCalledWith(account)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("group_invite", { p_user: ANN, p_nickname: "Bob", p_tag: 42, ...LIMITS })
  })

  it("is unavailable when the account has no profile to be named by, and asks the database nothing", async () => {
    mocks.ensureProfile.mockResolvedValue(null)
    await refusedWith(inviteToGroup(account, BOB), "GROUPS_UNAVAILABLE", 503)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it.each([
    ["missing", "FRIEND_NOT_FOUND", 404],
    ["self", "FRIEND_SELF", 400],
    ["not_friends", "INVITE_NOT_FRIEND", 403],
    ["already", "GROUP_ALREADY_MEMBER", 409],
    ["busy", "GROUP_TARGET_IN_GROUP", 409],
    ["full", "GROUP_FULL", 409],
    ["too_many_sent", "INVITE_LIMIT", 409],
    ["unavailable", "INVITE_UNAVAILABLE", 409],
  ])("turns the database's %s into %s", async (word, code, status) => {
    mocks.rpc.mockResolvedValue({ data: word, error: null })
    await refusedWith(inviteToGroup(account, BOB), code, status)
  })

  it("throws a word it does not know, and what the database says", async () => {
    mocks.rpc.mockResolvedValue({ data: "maybe", error: null })
    await expect(inviteToGroup(account, BOB)).rejects.toThrow('answered "maybe"')
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    await expect(inviteToGroup(account, BOB)).rejects.toThrow("answered object")
    const error = { code: "57014", message: "timeout" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(inviteToGroup(account, BOB)).rejects.toBe(error)
  })
})

describe("askToJoinGroup", () => {
  it("asks to join the group of the friend of the handle, with the same limits", async () => {
    expect(await askToJoinGroup(account, BOB)).toBe("sent")
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("group_ask", { p_user: ANN, p_nickname: "Bob", p_tag: 42, ...LIMITS })
  })

  it("is unavailable when the account has no profile to be named by", async () => {
    mocks.ensureProfile.mockResolvedValue(null)
    await refusedWith(askToJoinGroup(account, BOB), "GROUPS_UNAVAILABLE", 503)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it.each([
    ["missing", "FRIEND_NOT_FOUND", 404],
    ["self", "FRIEND_SELF", 400],
    ["not_friends", "INVITE_NOT_FRIEND", 403],
    ["in_group", "GROUP_ALREADY_IN", 409],
    ["no_group", "GROUP_GONE", 404],
    ["full", "GROUP_FULL", 409],
    ["unavailable", "GROUP_UNAVAILABLE", 409],
    ["too_many_sent", "INVITE_LIMIT", 409],
  ])("turns the database's %s into %s", async (word, code, status) => {
    mocks.rpc.mockResolvedValue({ data: word, error: null })
    await refusedWith(askToJoinGroup(account, BOB), code, status)
  })

  it("throws a word it does not know, and what the database says", async () => {
    mocks.rpc.mockResolvedValue({ data: "whenever", error: null })
    await expect(askToJoinGroup(account, BOB)).rejects.toThrow('answered "whenever"')
    const error = { code: "57014", message: "timeout" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(askToJoinGroup(account, BOB)).rejects.toBe(error)
  })
})

describe("acceptGroupInvitation", () => {
  it.each(["created", "joined"])("accepts the invitation and says the group was %s, with the cap the code gives", async (word) => {
    mocks.rpc.mockResolvedValue({ data: word, error: null })
    expect(await acceptGroupInvitation(account, BOB_ID)).toBe(word)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("group_accept", { p_user: ANN, p_id: BOB_ID, p_max_members: MAX_GROUP_MEMBERS })
  })

  it.each([
    ["missing", "INVITE_GONE", 404],
    ["expired", "INVITE_EXPIRED", 410],
    ["in_group", "GROUP_ALREADY_IN", 409],
    ["full", "GROUP_FULL", 409],
    ["unavailable", "GROUP_UNAVAILABLE", 409],
  ])("turns the database's %s into %s", async (word, code, status) => {
    mocks.rpc.mockResolvedValue({ data: word, error: null })
    await refusedWith(acceptGroupInvitation(account, BOB_ID), code, status)
  })

  it("throws a word it does not know, and what the database says, and is unavailable without a profile", async () => {
    mocks.rpc.mockResolvedValue({ data: "ok", error: null })
    await expect(acceptGroupInvitation(account, BOB_ID)).rejects.toThrow('answered "ok"')
    const error = { code: "57014", message: "timeout" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(acceptGroupInvitation(account, BOB_ID)).rejects.toBe(error)
    mocks.ensureProfile.mockResolvedValue(null)
    await refusedWith(acceptGroupInvitation(account, BOB_ID), "GROUPS_UNAVAILABLE", 503)
  })
})

describe("leaveGroup", () => {
  it("leaves the group, and is as left as it can be for a member who is in none", async () => {
    mocks.rpc.mockResolvedValue({ data: "left", error: null })
    expect(await leaveGroup(ANN)).toBe("left")
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("group_leave", { p_user: ANN })
    mocks.rpc.mockResolvedValue({ data: "missing", error: null })
    expect(await leaveGroup(ANN)).toBe("left")
  })

  it("throws a word it does not know, and what the database says", async () => {
    mocks.rpc.mockResolvedValue({ data: "gone", error: null })
    await expect(leaveGroup(ANN)).rejects.toThrow('answered "gone"')
    const error = { code: "57014", message: "timeout" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(leaveGroup(ANN)).rejects.toBe(error)
  })
})

describe("removeFromGroup and handOverLead", () => {
  it("remove a member and hand the lead over, by handle", async () => {
    mocks.rpc.mockResolvedValue({ data: "kicked", error: null })
    expect(await removeFromGroup(ANN, BOB)).toBe("kicked")
    expect(mocks.rpc).toHaveBeenLastCalledWith("group_kick", { p_user: ANN, p_nickname: "Bob", p_tag: 42 })
    mocks.rpc.mockResolvedValue({ data: "led", error: null })
    expect(await handOverLead(ANN, BOB)).toBe("led")
    expect(mocks.rpc).toHaveBeenLastCalledWith("group_lead", { p_user: ANN, p_nickname: "Bob", p_tag: 42 })
  })

  it.each([
    ["not_in_group", "GROUP_NOT_IN", 404],
    ["not_leader", "GROUP_NOT_LEADER", 403],
    ["missing", "GROUP_MEMBER_NOT_FOUND", 404],
  ])("turn the database's %s into %s", async (word, code, status) => {
    mocks.rpc.mockResolvedValue({ data: word, error: null })
    await refusedWith(removeFromGroup(ANN, BOB), code, status)
    await refusedWith(handOverLead(ANN, BOB), code, status)
  })

  it("throw a word they do not know, and what the database says", async () => {
    mocks.rpc.mockResolvedValue({ data: "led", error: null })
    await expect(removeFromGroup(ANN, BOB)).rejects.toThrow('answered "led"')
    mocks.rpc.mockResolvedValue({ data: "kicked", error: null })
    await expect(handOverLead(ANN, BOB)).rejects.toThrow('answered "kicked"')
    const error = { code: "57014", message: "timeout" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(removeFromGroup(ANN, BOB)).rejects.toBe(error)
    await expect(handOverLead(ANN, BOB)).rejects.toBe(error)
  })
})

describe("readGroupOf", () => {
  it("is the group of the account with the accounts' ids, the oldest first, for the server to seat", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: GROUP_ID, leader: ANN, members: [ANN, BOB_ID] }, error: null })
    expect(await readGroupOf(ANN)).toEqual({ id: GROUP_ID, leader: ANN, members: [ANN, BOB_ID] })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("group_members_of", { p_user: ANN })
  })

  it("is none for an account in no group, for what is not a group of two accounts, and where migration 0027 is not applied", async () => {
    for (const data of [null, "x", {}, { id: "7", leader: ANN, members: [ANN, BOB_ID] }, { id: GROUP_ID, leader: ANN, members: [ANN] }, { id: GROUP_ID, leader: ANN, members: [ANN, "x"] }, { id: GROUP_ID, leader: ANN, members: "x" }]) {
      mocks.rpc.mockResolvedValue({ data, error: null })
      expect(await readGroupOf(ANN)).toBeNull()
    }
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "no function" } })
    expect(await readGroupOf(ANN)).toBeNull()
  })

  it("throws what else the database says", async () => {
    const error = { code: "57014", message: "timeout" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(readGroupOf(ANN)).rejects.toBe(error)
  })
})

describe("groupsNotApplied", () => {
  it("is the friends' test of a function or a table that is not there", () => {
    expect(groupsNotApplied({ code: "PGRST202" })).toBe(true)
    expect(groupsNotApplied({ code: "42883" })).toBe(true)
    expect(groupsNotApplied({ code: "42P01" })).toBe(true)
    expect(groupsNotApplied({ code: "57014" })).toBe(false)
    expect(groupsNotApplied(null)).toBe(false)
  })
})
