import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  account: null as { id: string; nickname?: string } | null,
  leaveGroup: vi.fn(),
  removeFromGroup: vi.fn(),
  handOverLead: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => mocks.account }))
vi.mock("../../../../server/player", () => ({ getPlayerId: async () => null }))
vi.mock("../../../../server/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../server/groups")>()),
  leaveGroup: mocks.leaveGroup,
  removeFromGroup: mocks.removeFromGroup,
  handOverLead: mocks.handOverLead,
}))

import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import { CORE_ERROR_MESSAGES } from "../../../../lib/api"
import { GROUP_ACTIONS, type GroupAction } from "../../../../lib/groups"
import { ApiError } from "../../../../server/api"
import { setRateLimitStore } from "../../../../server/rate-limit"
import { MemoryRateLimitStore } from "../../../../server/rate-limiter"
import { postGroup } from "./route"

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const post = (action: GroupAction, body: unknown, headers: Record<string, string> = {}) =>
  postGroup(action)(new Request(`http://localhost/api/hub/groups/${action}`, { method: "POST", headers: { "x-forwarded-for": "1.1.1.1", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }))
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error
const BOB = { nickname: "Bob", tag: 42 }

beforeEach(() => {
  mocks.account = null
  for (const mock of [mocks.leaveGroup, mocks.removeFromGroup, mocks.handOverLead]) mock.mockReset()
  mocks.leaveGroup.mockResolvedValue("left")
  mocks.removeFromGroup.mockResolvedValue("kicked")
  mocks.handOverLead.mockResolvedValue("led")
  setRateLimitStore(new MemoryRateLimitStore())
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("POST /api/hub/groups/leave", () => {
  it("leaves the group of the signed-in account, whatever the request says of who it is", async () => {
    mocks.account = { id: ANN, nickname: "Ann" }
    const response = await post("leave", { userId: "someone-else" })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, result: "left" })
    expect(mocks.leaveGroup).toHaveBeenCalledExactlyOnceWith(ANN)
  })

  it("takes no handle: an empty body is enough", async () => {
    mocks.account = { id: ANN }
    expect((await post("leave", {})).status).toBe(200)
    expect(mocks.leaveGroup).toHaveBeenCalledOnce()
  })

  it("refuses a body that is not JSON", async () => {
    mocks.account = { id: ANN }
    expect(await errorOf(await post("leave", "not json"))).toBe("INVALID_REQUEST")
    expect(mocks.leaveGroup).not.toHaveBeenCalled()
  })

  it("says that groups are not available where migration 0027 is not applied", async () => {
    mocks.account = { id: ANN }
    mocks.leaveGroup.mockRejectedValue({ code: "PGRST202" })
    const response = await post("leave", {})
    expect(response.status).toBe(503)
    expect(await errorOf(response)).toBe("GROUPS_UNAVAILABLE")
  })

  it("is told it is done by the demo account of development, and writes nothing", async () => {
    mocks.account = DEMO_ACCOUNT
    expect(await (await post("leave", {})).json()).toEqual({ ok: true, result: "left" })
    expect(mocks.leaveGroup).not.toHaveBeenCalled()
  })
})

describe.each([
  ["kick", "kicked", mocks.removeFromGroup],
  ["lead", "led", mocks.handOverLead],
] as const)("POST /api/hub/groups/%s", (action, result, work) => {
  it("works on the member of the handle, as the signed-in account", async () => {
    mocks.account = { id: ANN, nickname: "Ann" }
    const response = await post(action, BOB)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, result })
    expect(work).toHaveBeenCalledExactlyOnceWith(ANN, BOB)
  })

  it.each([
    ["no handle", {}],
    ["a tag that is not one", { nickname: "Bob", tag: 0 }],
    ["a nickname that is not one", { nickname: "", tag: 42 }],
    ["a tag that is not a number", { nickname: "Bob", tag: "x" }],
    ["a body that is not an object", "[1]"],
  ])("refuses %s with 400 GROUP_INVALID, and writes nothing", async (_name, body) => {
    mocks.account = { id: ANN }
    const response = await post(action, body)
    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("GROUP_INVALID")
    expect(work).not.toHaveBeenCalled()
  })

  it.each([
    ["GROUP_NOT_IN", 404],
    ["GROUP_NOT_LEADER", 403],
    ["GROUP_MEMBER_NOT_FOUND", 404],
  ])("passes the refusal %s on, with %i", async (code, status) => {
    mocks.account = { id: ANN }
    work.mockRejectedValue(new ApiError(code, status))
    const response = await post(action, BOB)
    expect(response.status).toBe(status)
    expect(await errorOf(response)).toBe(code)
  })

  it("says that groups are not available where migration 0027 is not applied", async () => {
    mocks.account = { id: ANN }
    work.mockRejectedValue({ code: "42883" })
    const response = await post(action, BOB)
    expect(response.status).toBe(503)
    expect(await errorOf(response)).toBe("GROUPS_UNAVAILABLE")
  })

  it("is told it is done by the demo account of development, and writes nothing", async () => {
    mocks.account = DEMO_ACCOUNT
    expect(await (await post(action, BOB)).json()).toEqual({ ok: true, result })
    expect(work).not.toHaveBeenCalled()
  })
})

describe("every action", () => {
  it.each(GROUP_ACTIONS)("%s: refuses a request from another site, a visitor who is not signed in, and too many presses", async (action) => {
    expect(await errorOf(await post(action, BOB, { origin: "https://evil.example" }))).toBe("CROSS_ORIGIN")
    const guest = await post(action, BOB)
    expect(guest.status).toBe(401)
    expect(await errorOf(guest)).toBe("NOT_SIGNED_IN")
    mocks.account = { id: ANN }
    let last = 200
    for (let i = 0; i < 80; i++) last = (await post(action, BOB, { "x-forwarded-for": "2.2.2.2" })).status
    expect(last).toBe(429)
  })

  it("checks the origin and the session before it reads the body or the handle", async () => {
    expect(await errorOf(await post("kick", "not json", { origin: "https://evil.example" }))).toBe("CROSS_ORIGIN")
    expect(await errorOf(await post("kick", {}))).toBe("NOT_SIGNED_IN")
  })

  it("has a message for each refusal", () => {
    for (const code of ["GROUP_INVALID", "GROUP_NOT_IN", "GROUP_NOT_LEADER", "GROUP_MEMBER_NOT_FOUND", "GROUPS_UNAVAILABLE"]) {
      expect(CORE_ERROR_MESSAGES[code], code).toBeTruthy()
    }
  })
})
