import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { CITY_QUERY_MIN, CitySearchUnavailable, citiesOf, citySearchAvailable, foldName, forgetCities, searchCities, verifyCity } from "./geoapify"

const LYON = { result_type: "city", city: "Lyon", country: "France", country_code: "fr", state: "Auvergne-Rhône-Alpes", place_id: "x" }
const answer = (results: unknown[], status = 200) => new Response(JSON.stringify({ results }), { status })

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("GEOAPIFY_API_KEY", "secretkey1234567890")
  vi.stubEnv("GEOAPIFY_API_URL", "")
  forgetCities()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("citiesOf", () => {
  it("reads the cities of an answer, with their country in capitals and their division", () => {
    expect(citiesOf({ results: [LYON] })).toEqual([{ name: "Lyon", country: "FR", region: "Auvergne-Rhône-Alpes" }])
  })

  it("takes the name when there is no city field, and leaves a division out when there is none", () => {
    expect(citiesOf({ results: [{ result_type: "city", name: "Zürich", country_code: "ch" }] })).toEqual([{ name: "Zürich", country: "CH", region: null }])
  })

  it("leaves out what is not a city of a known country: a street, a missing name, a name too long, a country that is none", () => {
    expect(
      citiesOf({
        results: [
          { ...LYON, result_type: "street" },
          { result_type: "city", country_code: "fr" },
          { ...LYON, city: "a".repeat(101) },
          { ...LYON, country_code: "zz" },
          { ...LYON, country_code: 5 },
          { ...LYON, city: "  " , name: "  " },
          null,
          "Lyon",
        ],
      }),
    ).toEqual([])
  })

  it("keeps a city once, whatever the case, and two of one name in two divisions", () => {
    const found = citiesOf({ results: [LYON, { ...LYON, city: "LYON" }, { ...LYON, state: "Elsewhere" }] })
    expect(found).toHaveLength(2)
  })

  it("is empty for an answer that is not a list", () => {
    for (const body of [null, undefined, "x", 3, {}, { results: "x" }, { results: {} }, []]) expect(citiesOf(body), JSON.stringify(body)).toEqual([])
  })
})

describe("foldName", () => {
  it("drops the accents and the case, and writes a dash, a dot or an apostrophe as a space", () => {
    expect(foldName("Saint-Étienne")).toBe("saint etienne")
    expect(foldName("  L’Hospitalet ")).toBe("l hospitalet")
  })
})

describe("citySearchAvailable", () => {
  it("is on when the key is set, and off without it", () => {
    expect(citySearchAvailable()).toBe(true)
    vi.stubEnv("GEOAPIFY_API_KEY", "")
    expect(citySearchAvailable()).toBe(false)
  })
})

describe("searchCities", () => {
  it("asks Geoapify for the cities that start with what was typed, in one country, in English, eight at most", async () => {
    fetchMock.mockResolvedValue(answer([LYON]))
    expect(await searchCities("  lyo ", { country: "FR" })).toEqual([{ name: "Lyon", country: "FR", region: "Auvergne-Rhône-Alpes" }])
    const url = new URL(fetchMock.mock.calls[0]?.[0] as string)
    expect(url.origin + url.pathname).toBe("https://api.geoapify.com/v1/geocode/autocomplete")
    expect(Object.fromEntries(url.searchParams)).toEqual({ text: "lyo", type: "city", lang: "en", limit: "8", format: "json", apiKey: "secretkey1234567890", filter: "countrycode:fr" })
  })

  it("asks all countries when none is given", async () => {
    fetchMock.mockResolvedValue(answer([]))
    await searchCities("lyo")
    expect(new URL(fetchMock.mock.calls[0]?.[0] as string).searchParams.has("filter")).toBe(false)
  })

  it("asks nothing for fewer letters than it takes to find a city", async () => {
    expect(CITY_QUERY_MIN).toBe(2)
    expect(await searchCities("l")).toEqual([])
    expect(await searchCities("   ")).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("keeps an answer for a while: the same letters spend one credit, not one for each member", async () => {
    fetchMock.mockImplementation(async () => answer([LYON]))
    await searchCities("lyo")
    await searchCities("LYO")
    await searchCities("lyo", { country: "FR" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("says it is unavailable without a key, and asks nothing", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "")
    await expect(searchCities("lyo")).rejects.toBeInstanceOf(CitySearchUnavailable)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("says it is unavailable when Geoapify refuses (the key, the day's credits, too many requests) or fails, without the key in the message", async () => {
    for (const status of [401, 402, 429, 500]) {
      forgetCities()
      fetchMock.mockResolvedValue(answer([], status))
      const failure = await searchCities("lyo").catch((error: unknown) => error)
      expect(failure, String(status)).toBeInstanceOf(CitySearchUnavailable)
      expect((failure as Error).message).not.toContain("secretkey")
    }
  })

  it("says it is unavailable when Geoapify cannot be reached or sends what is not JSON, and keeps nothing of the failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED https://api.geoapify.com/?apiKey=secretkey1234567890"))
    const failure = await searchCities("lyo").catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(CitySearchUnavailable)
    expect((failure as Error).message).not.toContain("secretkey")
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 200 }))
    await expect(searchCities("lyo")).rejects.toBeInstanceOf(CitySearchUnavailable)
    fetchMock.mockResolvedValue(answer([LYON]))
    expect(await searchCities("lyo")).toHaveLength(1)
  })

  it("can point at another server for tests", async () => {
    vi.stubEnv("GEOAPIFY_API_URL", "http://localhost:3299")
    fetchMock.mockResolvedValue(answer([]))
    await searchCities("lyo")
    expect(String(fetchMock.mock.calls[0]?.[0]).startsWith("http://localhost:3299/v1/geocode/autocomplete?")).toBe(true)
  })
})

describe("verifyCity", () => {
  it("is the city Geoapify knows by that name in that country, with Geoapify's spelling and never the client's", async () => {
    fetchMock.mockResolvedValue(answer([LYON]))
    expect(await verifyCity({ name: "lyon", country: "FR" })).toEqual({ name: "Lyon", country: "FR", region: "Auvergne-Rhône-Alpes" })
    const url = new URL(fetchMock.mock.calls[0]?.[0] as string)
    expect(url.searchParams.get("text")).toBe("lyon")
    expect(url.searchParams.get("filter")).toBe("countrycode:fr")
    expect(url.searchParams.get("limit")).toBe("5")
  })

  it("does not mind accents or case, nor a dash for a space", async () => {
    fetchMock.mockResolvedValue(answer([{ ...LYON, city: "Saint-Étienne" }]))
    expect((await verifyCity({ name: "SAINT ETIENNE", country: "FR" }))?.name).toBe("Saint-Étienne")
  })

  it("is null for a place Geoapify does not know by that name, or in that country: it only takes the name it was asked for", async () => {
    fetchMock.mockResolvedValue(answer([{ ...LYON, city: "Lyons" }, { ...LYON, country_code: "be" }]))
    expect(await verifyCity({ name: "Lyon", country: "FR" })).toBeNull()
    fetchMock.mockResolvedValue(answer([]))
    forgetCities()
    expect(await verifyCity({ name: "Nowhereville", country: "FR" })).toBeNull()
  })

  it("is null, asking nothing, for a name with no letter or a country that is none", async () => {
    expect(await verifyCity({ name: "---", country: "FR" })).toBeNull()
    expect(await verifyCity({ name: "Lyon", country: "ZZ" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("says it is unavailable when Geoapify cannot answer: a profile is not given a city that nobody could check", async () => {
    fetchMock.mockResolvedValue(answer([], 429))
    await expect(verifyCity({ name: "Lyon", country: "FR" })).rejects.toBeInstanceOf(CitySearchUnavailable)
  })
})
