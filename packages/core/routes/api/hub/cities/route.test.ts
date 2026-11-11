import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("../../../../server/player", () => ({ getPlayerId: async () => null }))

import { setRateLimitStore } from "../../../../server/rate-limit"
import { MemoryRateLimitStore } from "../../../../server/rate-limiter"
import { getCities } from "./route"

const LYON = { id: 2996944, name: "Lyon", country: "FR", region: "Auvergne-Rhône-Alpes", population: 520774 }
const search = vi.fn((_query: string, _options: { country?: string; limit?: number }) => [LYON])
const GET = getCities(search)

const ask = (query: string, ip = "1.1.1.1") => GET(new Request(`http://localhost/api/hub/cities${query}`, { headers: { "x-forwarded-for": ip } }))

beforeEach(() => {
  search.mockClear()
  setRateLimitStore(new MemoryRateLimitStore())
})

describe("GET /api/hub/cities", () => {
  it("answers the cities that start with what was typed, with only what the picker draws", async () => {
    const response = await ask("?q=lyo")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ cities: [{ id: 2996944, name: "Lyon", country: "FR", region: "Auvergne-Rhône-Alpes" }] })
    expect(search).toHaveBeenCalledExactlyOnceWith("lyo", { country: undefined, limit: 8 })
  })

  it("keeps the cities of one country, whatever the case of the code", async () => {
    await ask("?q=lyo&country=fr")
    expect(search).toHaveBeenCalledWith("lyo", { country: "FR", limit: 8 })
    await ask("?q=lyo&country=")
    expect(search).toHaveBeenLastCalledWith("lyo", { country: undefined, limit: 8 })
  })

  it("refuses a country that is no country", async () => {
    for (const country of ["ZZ", "FRA", "1", "%00"]) {
      const response = await ask(`?q=lyo&country=${country}`)
      expect(response.status, country).toBe(400)
      expect(((await response.json()) as { error: string }).error).toBe("INVALID_REQUEST")
    }
    expect(search).not.toHaveBeenCalled()
  })

  it("reads no more than a city's name can be, and nothing when nothing was typed", async () => {
    await ask(`?q=${"a".repeat(500)}`)
    expect(search.mock.calls[0]?.[0]).toHaveLength(60)
    await ask("")
    expect(search).toHaveBeenLastCalledWith("", { country: undefined, limit: 8 })
  })

  it("can be cached for a short while: it needs no session, and holds nothing of a person", async () => {
    const response = await ask("?q=lyo")
    expect(response.headers.get("cache-control")).toBe("public, max-age=60, s-maxage=600")
  })

  it("is not cached when it refuses", async () => {
    expect((await ask("?q=lyo&country=ZZ")).headers.get("cache-control")).toBeNull()
  })

  it("is limited per IP, with room for a member who types", async () => {
    for (let i = 0; i < 150; i++) expect((await ask("?q=l", "2.2.2.2")).status).toBe(200)
    const refused = await ask("?q=l", "2.2.2.2")
    expect(refused.status).toBe(429)
    expect(((await refused.json()) as { error: string }).error).toBe("RATE_LIMITED")
    expect((await ask("?q=l", "3.3.3.3")).status).toBe(200)
  })
})
