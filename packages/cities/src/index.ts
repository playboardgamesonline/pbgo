import data from "../data/cities.json"

// The cities a member can say they live in (PLT-139, `docs/accounts.md`, "Profiles"): the places of 5000 inhabitants and more, and the capitals, of GeoNames (https://www.geonames.org, CC BY 4.0: the credit is in the Terms and in
// the README of this package), a static list that is searched in memory. A member only ever picks a city of this list, so a profile never holds a place that nobody checked, and what a member types never leaves our server.
// Server only: the list weighs 2.4 MB and is loaded the first time it is asked for, so it never goes into a browser bundle.

/** A city of the list. `id` is its GeoNames number, which is what a profile keeps; `region` is its first-level division when GeoNames has one for it (Auvergne-Rhône-Alpes for Lyon). */
export type City = { id: number; name: string; country: string; region: string | null; population: number }

type Row = [id: number, name: string, country: string, region: number, population: number]

const { regions, cities } = data as unknown as { regions: string[]; cities: Row[] }

/** How many results a search gives, at most, whatever it is asked. */
export const CITIES_MAX = 20

/** How many results a search gives when it is not told. */
export const CITIES_DEFAULT = 8

/** A name as the search compares it: no accents, lower case, and a dash, a dot or an apostrophe is a space, so that "saint etienne" finds Saint-Étienne and "st louis" finds St. Louis. */
export function foldName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[-.'’]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

let folded: string[] | undefined
let byId: Map<number, number> | undefined

const foldedNames = (): string[] => (folded ??= cities.map((row) => foldName(row[1])))

const cityOf = (row: Row): City => ({ id: row[0], name: row[1], country: row[2], region: row[3] >= 0 ? (regions[row[3]] ?? null) : null, population: row[4] })

/**
 * The cities whose name starts with what was typed (accents and case do not matter), the most populated first, at most `limit` (`CITIES_DEFAULT`, never more than `CITIES_MAX`). `country` (an ISO code, `FR`) keeps the cities of that country alone. Nothing for a text with no letter in it.
 */
export function searchCities(query: string, options: { country?: string; limit?: number } = {}): City[] {
  const needle = foldName(query)
  if (needle === "") return []
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? CITIES_DEFAULT), 1), CITIES_MAX)
  const names = foldedNames()
  const found: City[] = []
  // The list is sorted by population, so the first matches are the most populated
  for (let index = 0; index < cities.length && found.length < limit; index++) {
    const row = cities[index]
    if (row === undefined || (options.country !== undefined && row[2] !== options.country)) continue
    if (names[index]?.startsWith(needle)) found.push(cityOf(row))
  }
  return found
}

/** The city that goes by this GeoNames number, or null: a number that is not one of the list is no city of ours. */
export function cityById(id: number): City | null {
  if (!Number.isInteger(id)) return null
  byId ??= new Map(cities.map((row, index) => [row[0], index]))
  const index = byId.get(id)
  const row = index === undefined ? undefined : cities[index]
  return row === undefined ? null : cityOf(row)
}

/** How many cities the list holds. */
export const cityCount = (): number => cities.length
