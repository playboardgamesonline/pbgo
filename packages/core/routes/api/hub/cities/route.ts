import { isCountryCode } from "@pbgo/accounts"
import { ApiError, handle } from "../../../../server/api"
import { CitySearchUnavailable, searchCities } from "../../../../server/geoapify"
import { rateLimit } from "../../../../server/rate-limit"

/** How much of what was typed is read: no city has a name this long. */
const QUERY_MAX = 60

const answer = handle(async (request: Request) => {
  await rateLimit(null, request, "cities")
  const params = new URL(request.url).searchParams
  const query = (params.get("q") ?? "").slice(0, QUERY_MAX)
  const asked = params.get("country")
  const country = asked ? asked.toUpperCase() : undefined
  if (country !== undefined && !isCountryCode(country)) throw new ApiError("INVALID_REQUEST")
  try {
    return { cities: await searchCities(query, { country }) }
  } catch (error) {
    if (!(error instanceof CitySearchUnavailable)) throw error
    // The message holds no key: it says what Geoapify did, for the logs
    console.error("The search of a city is not available:", error.message)
    throw new ApiError("CITIES_UNAVAILABLE", 503)
  }
})

/**
 * `GET /api/hub/cities?q=<what was typed>&country=<ISO code>` (PLT-139): the cities whose name starts with what a member typed in the city field of their profile, eight at most, as `{ "cities": [{ "name": "Lyon", "country": "FR", "region": "Auvergne-Rhône-Alpes" }] }`.
 * They are found at Geoapify (`server/geoapify.ts`): our server asks, with the key it holds, so a browser never talks to Geoapify and Geoapify gets the first letters and our server's address, never a member. Fewer than two letters give an empty list and ask nothing.
 * `country` keeps the cities of one country (an unknown code is a 400 `INVALID_REQUEST`). 503 `CITIES_UNAVAILABLE` when Geoapify cannot answer (no key, the day's credits spent, a failure). It needs no session, so a good answer is cached for a short while, and an answer that is not good never is.
 * Rate limited per IP.
 */
export async function GET(request: Request): Promise<Response> {
  const response = await answer(request)
  if (response.ok) response.headers.set("Cache-Control", "public, max-age=60, s-maxage=600")
  return response
}
