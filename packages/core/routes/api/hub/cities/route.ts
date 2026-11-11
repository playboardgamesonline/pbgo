import { isCountryCode } from "@pbgo/accounts"
import { ApiError, handle } from "../../../../server/api"
import { rateLimit } from "../../../../server/rate-limit"

/**
 * Where the cities come from: the list that ships with the site (`searchCities` of `@pbgo/cities`), which the app hands in. A city is the number GeoNames gave it, its name, its country and, when GeoNames has one for it, its first-level division.
 */
export type CitySearch = (query: string, options: { country?: string; limit?: number }) => readonly { id: number; name: string; country: string; region: string | null }[]

/** How much of what was typed is read: no city has a name this long. */
const QUERY_MAX = 60

/** How many cities an answer holds at most. */
const RESULTS = 8

/**
 * `GET /api/hub/cities?q=<what was typed>&country=<ISO code>` (PLT-139): the cities whose name starts with what a member typed in the city field of their profile, the most populated first, eight at most, as `{ "cities": [{ "id": 2996944, "name": "Lyon", "country": "FR", "region": "Auvergne-Rhône-Alpes" }] }`.
 * `country` keeps the cities of one country (an unknown code is a 400 `INVALID_REQUEST`). The list is in memory on our server: nothing the member types goes anywhere else, nothing of it is kept, and it needs no session, so the answer is cached for a short while.
 * Rate limited per IP.
 */
export const getCities = (search: CitySearch) => {
  const answer = handle(async (request: Request) => {
    await rateLimit(null, request, "cities")
    const params = new URL(request.url).searchParams
    const query = (params.get("q") ?? "").slice(0, QUERY_MAX)
    const asked = params.get("country")
    const country = asked ? asked.toUpperCase() : undefined
    if (country !== undefined && !isCountryCode(country)) throw new ApiError("INVALID_REQUEST")
    // Only what the picker draws, never the rest of the list's rows
    return { cities: search(query, { country, limit: RESULTS }).map((city) => ({ id: city.id, name: city.name, country: city.country, region: city.region })) }
  })
  return async (request: Request): Promise<Response> => {
    const response = await answer(request)
    if (response.ok) response.headers.set("Cache-Control", "public, max-age=60, s-maxage=600")
    return response
  }
}
