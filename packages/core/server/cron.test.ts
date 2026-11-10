import { assertNoPersonalData } from "@pbgo/analytics/privacy"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const purge = vi.hoisted(() => ({
  scheduled: [] as Array<() => unknown>,
  track: vi.fn<(event: string, distinctId: string, properties: object) => Promise<void>>(async () => {}),
  expired: vi.fn(async (_options?: { dryRun?: boolean }) => ({
    dryRun: false,
    cutoffs: { tables: "2026-10-07T03:17:00.000Z", feedback: "2025-11-06T03:17:00.000Z" },
    tables: 2,
    feedback: 1,
    screenshots: 1,
    accounts: 0,
    errors: [] as string[],
  })),
}))

vi.mock("server-only", () => ({}))
vi.mock("next/server", () => ({ after: (callback: () => unknown) => void purge.scheduled.push(callback) }))
vi.mock("@pbgo/analytics/server", () => ({ track: purge.track }))
vi.mock("./retention", () => ({ purgeExpired: purge.expired }))

import { GET } from "../routes/api/cron/purge/route"
import { MIN_SECRET_LENGTH } from "./admin-session"
import { cronAuthorized } from "./cron"

const SECRET = "c".repeat(48)
const call = (headers: Record<string, string> = {}, query = "") => GET(new Request(`http://localhost/api/cron/purge${query}`, { headers }))
const bearer = (secret = SECRET) => ({ authorization: `Bearer ${secret}` })

/** What was counted in PostHog once the response has left. */
function counted() {
  purge.scheduled.splice(0).forEach((callback) => callback())
  const sent = purge.track.mock.calls.map(([event, distinctId, properties]) => ({ event, distinctId, properties }))
  purge.track.mockClear()
  return sent
}

beforeEach(() => {
  purge.scheduled.length = 0
  purge.track.mockClear()
  purge.expired.mockClear()
  vi.stubEnv("CRON_SECRET", SECRET)
  vi.spyOn(console, "info").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("cronAuthorized", () => {
  it("accepts the secret Vercel Cron sends as a bearer token", () => {
    expect(cronAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true)
  })

  it("refuses a wrong token, a missing header and anything that is not exactly the bearer form", () => {
    for (const header of [null, "", SECRET, "Bearer", "Bearer ", `Bearer ${SECRET}x`, `Bearer ${SECRET.slice(1)}`, `bearer ${SECRET}`, `Bearer  ${SECRET}`, `Bearer ${SECRET} `, `Basic ${SECRET}`]) {
      expect(cronAuthorized(header, SECRET), JSON.stringify(header)).toBe(false)
    }
  })

  it("authorizes nobody when the secret is missing, empty or too short, whatever the header says", () => {
    const short = "c".repeat(MIN_SECRET_LENGTH - 1)
    for (const secret of [undefined, "", short]) {
      for (const header of [null, "Bearer ", `Bearer ${secret}`, "Bearer undefined"]) expect(cronAuthorized(header, secret), `${JSON.stringify(secret)} / ${JSON.stringify(header)}`).toBe(false)
    }
    expect(cronAuthorized(`Bearer ${"c".repeat(MIN_SECRET_LENGTH)}`, "c".repeat(MIN_SECRET_LENGTH))).toBe(true)
  })
})

describe("GET /api/cron/purge", () => {
  it("answers 401 without running anything when the token is missing or wrong", async () => {
    for (const headers of [{}, bearer("wrong"), { authorization: SECRET }]) {
      const response = await call(headers)
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: "ACCESS_DENIED" })
    }
    expect(purge.expired).not.toHaveBeenCalled()
  })

  it("answers 401 when the deployment has no CRON_SECRET, even for a request that sends a token", async () => {
    vi.stubEnv("CRON_SECRET", "")
    const response = await call(bearer(""))
    expect(response.status).toBe(401)
    expect(purge.expired).not.toHaveBeenCalled()
  })

  it("runs the clean-up for Vercel Cron and returns what it did", async () => {
    const response = await call(bearer())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ dryRun: false, tables: 2, feedback: 1, screenshots: 1, errors: [] })
    expect(purge.expired).toHaveBeenCalledWith({ dryRun: false })
  })

  it("only counts with ?dry=1", async () => {
    await call(bearer(), "?dry=1")
    expect(purge.expired).toHaveBeenLastCalledWith({ dryRun: true })
    for (const query of ["?dry=0", "?dry=true", "?dry=", "?dryRun=1"]) {
      await call(bearer(), query)
      expect(purge.expired, query).toHaveBeenLastCalledWith({ dryRun: false })
    }
  })

  it("answers 500 PURGE_FAILED when a job failed, so that the run shows as failed in Vercel", async () => {
    purge.expired.mockResolvedValueOnce({ dryRun: false, cutoffs: { tables: "a", feedback: "b" }, tables: 0, feedback: 0, screenshots: 0, accounts: 0, errors: ["feedback: storage is down"] })
    const response = await call(bearer())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "PURGE_FAILED" })
    expect(console.error).toHaveBeenCalled()
  })

  it("counts each account the clean-up deleted, for nobody: how many, never whose", async () => {
    purge.expired.mockResolvedValueOnce({ dryRun: false, cutoffs: { tables: "a", feedback: "b" }, tables: 0, feedback: 0, screenshots: 0, accounts: 3, errors: [] })
    await call(bearer())
    const sent = counted()
    expect(sent.map((entry) => [entry.event, entry.properties])).toEqual(Array(3).fill(["account_deletion", { step: "purged" }]))
    expect(new Set(sent.map((entry) => entry.distinctId)).size).toBe(3)
    for (const entry of sent) assertNoPersonalData(entry.properties)
  })

  it("counts none for a dry run, which deletes nothing, nor for a run with no account to delete", async () => {
    purge.expired.mockResolvedValueOnce({ dryRun: true, cutoffs: { tables: "a", feedback: "b" }, tables: 0, feedback: 0, screenshots: 0, accounts: 5, errors: [] })
    await call(bearer(), "?dry=1")
    await call(bearer())
    expect(counted()).toEqual([])
  })

  it("still counts the accounts that were deleted when another job of the same run failed", async () => {
    purge.expired.mockResolvedValueOnce({ dryRun: false, cutoffs: { tables: "a", feedback: "b" }, tables: 0, feedback: 0, screenshots: 0, accounts: 2, errors: ["feedback: storage is down"] })
    const response = await call(bearer())
    expect(response.status).toBe(500)
    expect(counted()).toHaveLength(2)
  })

  it("answers 500 SERVER_ERROR when the clean-up itself throws", async () => {
    purge.expired.mockRejectedValueOnce(new Error("boom"))
    const response = await call(bearer())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "SERVER_ERROR" })
  })
})
