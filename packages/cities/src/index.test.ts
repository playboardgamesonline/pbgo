import { describe, expect, it } from "vitest"
import { CITIES_DEFAULT, CITIES_MAX, cityById, cityCount, foldName, searchCities } from "./index"

describe("foldName", () => {
  it("drops the accents and the case, and writes a dash, a dot or an apostrophe as a space", () => {
    expect(foldName("Saint-Étienne")).toBe("saint etienne")
    expect(foldName("St. Louis")).toBe("st louis")
    expect(foldName("  L’Hospitalet de Llobregat ")).toBe("l hospitalet de llobregat")
    expect(foldName("Zürich")).toBe("zurich")
    expect(foldName("---")).toBe("")
  })
})

describe("searchCities", () => {
  it("finds a city by the start of its name, the most populated first", () => {
    const found = searchCities("lyo")
    expect(found[0]).toMatchObject({ name: "Lyon", country: "FR" })
    expect(found.every((city) => foldName(city.name).startsWith("lyo"))).toBe(true)
    for (let i = 1; i < found.length; i++) expect(found[i - 1]?.population ?? 0).toBeGreaterThanOrEqual(found[i]?.population ?? 0)
  })

  it("does not mind the accents or the case, in the list or in what is typed", () => {
    expect(searchCities("ZURICH")[0]?.name).toBe("Zürich")
    expect(searchCities("Zürich")[0]?.name).toBe("Zürich")
    expect(searchCities("saint etienne", { country: "FR" })[0]?.name).toBe("Saint-Étienne")
    expect(searchCities("Saint-Etienne", { country: "FR" })[0]?.name).toBe("Saint-Étienne")
  })

  it("keeps the cities of one country when it is asked to", () => {
    const found = searchCities("paris", { country: "FR" })
    expect(found[0]).toMatchObject({ name: "Paris", country: "FR" })
    expect(found.every((city) => city.country === "FR")).toBe(true)
    expect(searchCities("paris", { country: "US" }).every((city) => city.country === "US")).toBe(true)
    expect(searchCities("lyon", { country: "BE" })).toEqual([])
  })

  it("gives eight results at most, and never more than twenty whatever it is asked", () => {
    expect(CITIES_DEFAULT).toBe(8)
    expect(searchCities("s")).toHaveLength(8)
    expect(searchCities("s", { limit: 3 })).toHaveLength(3)
    expect(searchCities("s", { limit: 500 })).toHaveLength(CITIES_MAX)
    expect(searchCities("s", { limit: 0 })).toHaveLength(1)
  })

  it("says where a city is, with its division when GeoNames has one", () => {
    expect(searchCities("lyon", { country: "FR" })[0]).toMatchObject({ id: 2996944, region: "Auvergne-Rhône-Alpes" })
  })

  it("finds nothing for a text with no letter in it, or for a place that is not on the list", () => {
    expect(searchCities("")).toEqual([])
    expect(searchCities("   ")).toEqual([])
    expect(searchCities("---")).toEqual([])
    expect(searchCities("zzzzzzzz")).toEqual([])
  })

  it("is a prefix search: the middle of a name is not found", () => {
    expect(searchCities("yon", { country: "FR" }).some((city) => city.name === "Lyon")).toBe(false)
  })
})

describe("cityById", () => {
  it("answers the city that goes by a GeoNames number", () => {
    expect(cityById(2996944)).toMatchObject({ id: 2996944, name: "Lyon", country: "FR" })
    expect(cityById(2988507)).toMatchObject({ name: "Paris", country: "FR" })
  })

  it("answers null for a number that is not on the list, and for what is not a number", () => {
    expect(cityById(1)).toBeNull()
    expect(cityById(-5)).toBeNull()
    expect(cityById(2996944.5)).toBeNull()
    expect(cityById(Number.NaN)).toBeNull()
  })

  it("knows every city it finds", () => {
    for (const city of searchCities("m", { limit: 20 })) expect(cityById(city.id)).toEqual(city)
  })
})

describe("the list", () => {
  it("holds tens of thousands of places, each with an id of its own and a country code", () => {
    expect(cityCount()).toBeGreaterThan(50_000)
    const found = searchCities("a", { limit: 20 })
    expect(new Set(found.map((city) => city.id)).size).toBe(found.length)
    for (const city of found) expect(city.country).toMatch(/^[A-Z]{2}$/)
  })
})
