import { beforeEach, describe, expect, it, vi } from "vitest"

const LYON = { name: "Lyon", country: "FR", region: "Auvergne-Rhône-Alpes" }
const mocks = vi.hoisted(() => ({ search: vi.fn(async (_query: string, _options: { country?: string }): Promise<unknown[]> => []) }))

vi.mock("server-only", () => ({}))
vi.mock("../../../../server/player", () => ({ getPlayerId: async () => null }))
vi.mock("../../../../server/geoapify", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../../server/geoapify")>()), searchCities: mocks.search }))

import { CitySearchUnavailable } from "../../../../server/geoapify"
import { setRateLimitStore } from "../../../../server/rate-limit"
import { MemoryRateLimitStore } from "../../../../server/rate-limiter"
import { GET } from "./route"

const ask = (query: string, ip = "1.1.1.1") => GET(new Request(`http://localhost/api/hub/cities${query}`, { headers: { "x-forwarded-for": ip } }))
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error

beforeEach(() => {
  mocks.search.mockReset()
  mocks.search.mockResolvedValue([LYON])
  setRateLimitStore(new MemoryRateLimitStore())
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("GET /api/hub/cities", () => {
  it("answers the cities Geoapify finds for what was typed", async () => {
    const response = await ask("?q=lyo")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ cities: [LYON] })
    expect(mocks.search).toHaveBeenCalledExactlyOnceWith("lyo", { country: undefined })
  })

  it("keeps the cities of one country, whatever the case of the code", async () => {
    await ask("?q=lyo&country=fr")
    expect(mocks.search).toHaveBeenCalledWith("lyo", { country: "FR" })
    await ask("?q=lyo&country=")
    expect(mocks.search).toHaveBeenLastCalledWith("lyo", { country: undefined })
  })

  it("refuses a country that is no country", async () => {
    for (const country of ["ZZ", "FRA", "1", "%00"]) {
      const response = await ask(`?q=lyo&country=${country}`)
      expect(response.status, country).toBe(400)
      expect(await errorOf(response)).toBe("INVALID_REQUEST")
    }
    expect(mocks.search).not.toHaveBeenCalled()
  })

  it("reads no more than a city's name can be", async () => {
    await ask(`?q=${"a".repeat(500)}`)
    expect(mocks.search.mock.calls[0]?.[0]).toHaveLength(60)
  })

  it("can be cached for a short while: it needs no session, and holds nothing of a person", async () => {
    expect((await ask("?q=lyo")).headers.get("cache-control")).toBe("public, max-age=60, s-maxage=600")
  })

  it("says Geoapify cannot answer as 503, never cached, with the cause in the log and nothing of it in the answer", async () => {
    mocks.search.mockRejectedValue(new CitySearchUnavailable("Geoapify answered 429"))
    const response = await ask("?q=lyo")
    expect(response.status).toBe(503)
    expect(await errorOf(response)).toBe("CITIES_UNAVAILABLE")
    expect(response.headers.get("cache-control")).toBeNull()
    expect(console.error).toHaveBeenCalled()
  })

  it("answers with an error when it fails in some other way", async () => {
    mocks.search.mockRejectedValue(new Error("boom"))
    const response = await ask("?q=lyo")
    expect(response.status).toBe(500)
    expect(response.headers.get("cache-control")).toBeNull()
  })

  it("is not cached when it refuses", async () => {
    expect((await ask("?q=lyo&country=ZZ")).headers.get("cache-control")).toBeNull()
  })

  it("is limited per IP, with room for a member who types", async () => {
    for (let i = 0; i < 150; i++) expect((await ask("?q=ly", "2.2.2.2")).status).toBe(200)
    const refused = await ask("?q=ly", "2.2.2.2")
    expect(refused.status).toBe(429)
    expect(await errorOf(refused)).toBe("RATE_LIMITED")
    expect((await ask("?q=ly", "3.3.3.3")).status).toBe(200)
  })
})
