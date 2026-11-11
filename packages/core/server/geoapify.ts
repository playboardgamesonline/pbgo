import "server-only"
import { isCountryCode } from "@pbgo/accounts"

// The cities a member can say they live in, found at Geoapify (https://www.geoapify.com, PLT-139, `docs/accounts.md`, "Profiles"). Our server asks: a visitor's browser never talks to Geoapify, so Geoapify gets the first letters of a city
// and our server's address, and never a member, an account or a browser. The key stays here (`GEOAPIFY_API_KEY`, the switch of the City field too: `citySearchAvailable`). Geoapify's data is OpenStreetMap's, and the free plan asks for both to be
// credited near the field (the window does, and the Terms). Server only.

/** A city as a profile keeps it: its name as Geoapify writes it and its country (an ISO 3166-1 alpha-2 code in capitals). */
export type CityResult = { name: string; country: string; region: string | null }

/** Geoapify cannot answer: no key, a refusal (the key, the plan's credits, too many requests), a failure, a reply that is not one, or too slow. The route tells the member it is not available right now. */
export class CitySearchUnavailable extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = "CitySearchUnavailable"
  }
}

/** Whether the search of a city is on: the key of Geoapify is set. Without it nothing is asked of anybody and the window draws no City field. */
export const citySearchAvailable = (): boolean => Boolean(process.env.GEOAPIFY_API_KEY)

/** How few letters are searched: one letter would spend a credit on every city of the world. */
export const CITY_QUERY_MIN = 2

/** How many cities a search gives, at most, and how long Geoapify has to answer (milliseconds). */
const RESULTS = 8
const TIMEOUT_MS = 4000

/** How long an answer is kept in memory on this server, and how many: the same first letters are typed by many members, and every request spends a credit of the day's allowance. */
const KEEP_MS = 10 * 60_000
const KEEP_MAX = 500

const kept = new Map<string, { at: number; cities: CityResult[] }>()

/** A name as two spellings of it are compared: no accents, no case, a dash a dot or an apostrophe is a space. */
export function foldName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[-.'’]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** The cities of an answer of Geoapify (`format=json`: `results`), as far as it is one: only places that Geoapify calls a city, with a name and a country code, none twice. Anything else is left out. */
export function citiesOf(body: unknown): CityResult[] {
  const list = typeof body === "object" && body !== null ? (body as { results?: unknown }).results : null
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const cities: CityResult[] = []
  for (const item of list as unknown[]) {
    if (typeof item !== "object" || item === null) continue
    const { result_type: type, city, name, country_code: code, state } = item as Record<string, unknown>
    const written = typeof city === "string" && city !== "" ? city : name
    const country = typeof code === "string" ? code.toUpperCase() : ""
    if (type !== "city" || typeof written !== "string" || written.trim() === "" || written.length > 100 || !isCountryCode(country)) continue
    const key = `${foldName(written)}|${country}|${typeof state === "string" ? state : ""}`
    if (seen.has(key)) continue
    seen.add(key)
    cities.push({ name: written.trim(), country, region: typeof state === "string" && state !== "" ? state : null })
  }
  return cities
}

async function ask(text: string, country: string | undefined, limit: number): Promise<CityResult[]> {
  const key = process.env.GEOAPIFY_API_KEY
  if (!key) throw new CitySearchUnavailable("no key")
  const cacheKey = `${country ?? ""}|${limit}|${text.toLowerCase()}`
  const found = kept.get(cacheKey)
  if (found && Date.now() - found.at < KEEP_MS) return found.cities
  const params = new URLSearchParams({ text, type: "city", lang: "en", limit: String(limit), format: "json", apiKey: key })
  if (country) params.set("filter", `countrycode:${country.toLowerCase()}`)
  let cities: CityResult[]
  try {
    const response = await fetch(`${process.env.GEOAPIFY_API_URL || "https://api.geoapify.com"}/v1/geocode/autocomplete?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" })
    // Never the address of the request in the message: it holds the key
    if (!response.ok) throw new CitySearchUnavailable(`Geoapify answered ${response.status}`)
    cities = citiesOf(await response.json())
  } catch (error) {
    throw error instanceof CitySearchUnavailable ? error : new CitySearchUnavailable("Geoapify could not be reached or answered with something else than a list")
  }
  if (kept.size >= KEEP_MAX) kept.delete(kept.keys().next().value as string)
  kept.set(cacheKey, { at: Date.now(), cities })
  return cities
}

/**
 * The cities whose name starts with what a member typed (`GET /api/hub/cities`), eight at most, as Geoapify ranks them, in one country when `country` is given. Nothing for fewer than `CITY_QUERY_MIN` letters, and nothing is asked of Geoapify then.
 * Throws `CitySearchUnavailable` when Geoapify cannot answer.
 */
export async function searchCities(query: string, options: { country?: string } = {}): Promise<CityResult[]> {
  const text = query.trim()
  if (Array.from(text).length < CITY_QUERY_MIN) return []
  return ask(text, options.country, RESULTS)
}

/**
 * The city that this name and this country are, as Geoapify writes it, or null when Geoapify does not know such a city: what keeps a profile from holding a place that nobody checked, since a client could send any text. It asks Geoapify for the name in that country and
 * takes the city whose name is the same (accents and case aside); the profile keeps Geoapify's own spelling, never the client's. Throws `CitySearchUnavailable` when Geoapify cannot answer.
 */
export async function verifyCity(city: { name: string; country: string }): Promise<CityResult | null> {
  const wanted = foldName(city.name)
  if (wanted === "" || !isCountryCode(city.country)) return null
  const found = await ask(city.name.trim(), city.country, 5)
  return found.find((candidate) => candidate.country === city.country && foldName(candidate.name) === wanted) ?? null
}

/** Forgets what is kept in memory (for the tests). */
export const forgetCities = (): void => kept.clear()
