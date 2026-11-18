import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ account: null as { id: string; nickname?: string } | null, readPartyTable: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => mocks.account }))
vi.mock("../../../../../server/party", () => ({ readPartyTable: mocks.readPartyTable }))

import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import { setRateLimitStore } from "../../../../../server/rate-limit"
import { MemoryRateLimitStore } from "../../../../../server/rate-limiter"
import { getPartyTable } from "./route"

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const get = () => getPartyTable(new Request("http://localhost/api/hub/groups/table", { headers: { "x-forwarded-for": "1.1.1.1" } }))
const TABLE = { game: "courtisans", code: "ABC234", status: "lobby", seats: 3, seated: 1, you: true, host: true, waited: 4 }

beforeEach(() => {
  mocks.account = null
  mocks.readPartyTable.mockReset()
  mocks.readPartyTable.mockResolvedValue(TABLE)
  setRateLimitStore(new MemoryRateLimitStore())
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("GET /api/hub/groups/table", () => {
  it("answers the table of the group of the signed-in account, whatever the request says of who it is", async () => {
    mocks.account = { id: ANN }
    const response = await get()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ table: TABLE })
    expect(mocks.readPartyTable).toHaveBeenCalledExactlyOnceWith(ANN)
  })

  it("answers no table for a group that has none", async () => {
    mocks.account = { id: ANN }
    mocks.readPartyTable.mockResolvedValue(null)
    expect(await (await get()).json()).toEqual({ table: null })
  })

  it("is for a signed-in visitor: 401 NOT_SIGNED_IN, and the database is not asked", async () => {
    const response = await get()
    expect(response.status).toBe(401)
    expect(((await response.json()) as { error?: string }).error).toBe("NOT_SIGNED_IN")
    expect(mocks.readPartyTable).not.toHaveBeenCalled()
  })

  it("tells the demo account of development that its group has no table: it is made up by the browser and in no database", async () => {
    mocks.account = { id: DEMO_ACCOUNT.id }
    expect(await (await get()).json()).toEqual({ table: null })
    expect(mocks.readPartyTable).not.toHaveBeenCalled()
  })

  it("is limited per IP", async () => {
    mocks.account = { id: ANN }
    let last = 200
    for (let call = 0; call < 241 && last === 200; call++) last = (await get()).status
    expect(last).toBe(429)
  })
})
