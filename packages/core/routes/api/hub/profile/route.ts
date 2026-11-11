import { parseProfileEdit } from "@pbgo/accounts"
import { DEMO_TAG, isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import { ApiError, assertSameOrigin, handle, readJson } from "../../../../server/api"
import { CitySearchUnavailable, verifyCity } from "../../../../server/geoapify"
import { ensureProfile, profilesNotApplied, saveProfile, type ProfileChange } from "../../../../server/profiles"
import { rateLimit } from "../../../../server/rate-limit"

/**
 * Which of some slugs the hub's catalog does not list, and whether it could be read in full: where the games a member may pick as favourites come from. The app hands it in (core cannot read the hub's catalog, which depends on core). Any game of the catalog
 * counts, live or not yet. `complete` is false when the platform's Sanity project did not answer and only the live games are known: a slug it does not list may still be a game then.
 */
export type CatalogCheck = (slugs: readonly string[]) => Promise<{ unknown: readonly string[]; complete: boolean }>

/**
 * `POST /api/hub/profile`: a signed-in member changes what their profile says (PLT-39). The body holds the fields to change and nothing else, any of `{ "nickname": "Alex", "tag": 42, "pronouns": "they/them", "country": "FR", "city": { "name": "Lyon", "country": "FR" }, "favoriteGames": ["flip-7"], "bio": "…" }`: a
 * field that is missing stays as it is, and `null` takes away the pronouns, the country, the favourite games and the bio. The request must come from this site. Every field is checked here (`parseProfileEdit`, and the favourite games against the catalog, `catalog`) and by
 * the database, which makes the change whole or not at all (`set_profile`). 409 `PROFILE_TAKEN` when another member has the nickname and tag (case ignored), 400 `PROFILE_INVALID` for a field a profile cannot hold, 400 `PROFILE_GAME_UNKNOWN` for a favourite that is not a game
 * of the catalog (503 `PROFILE_UNAVAILABLE` while the catalog cannot be read in full and cannot say). The city is a name and its country, and never free text: the server asks Geoapify whether such a city exists (`verifyCity`: 400 `PROFILE_CITY_UNKNOWN` when it does not, 503 `PROFILE_UNAVAILABLE` when
 * Geoapify cannot answer) and keeps Geoapify's own spelling of it, never the client's. A city comes with its country, which becomes the profile's (a request that says another country is invalid). `null` takes the city away. The demo account writes nothing, and asks nothing of Geoapify. The answer is `{ "saved": true }` and the fields that were kept, as they were cleaned.
 */
export const postProfile = (catalog: CatalogCheck) =>
  handle(async (request: Request) => {
    assertSameOrigin(request)
    await rateLimit(null, request, "profile")
    const account = await getAccount()
    if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
    const parsed = parseProfileEdit(await readJson<unknown>(request))
    if (!parsed.ok) throw new ApiError("PROFILE_INVALID")
    const { edit } = parsed
    // A city comes with its country, which becomes the profile's: a request that says another country is wrong
    if (edit.city) {
      if (edit.country !== undefined && edit.country !== edit.city.country) throw new ApiError("PROFILE_INVALID")
      edit.country = edit.city.country
    }
    if (isDemoAccount(account)) return { saved: true, ...edit }
    // Only the games of the catalog can be a favourite: the page draws their covers, and the table cannot tell (a slug is a text)
    if (edit.favoriteGames && edit.favoriteGames.length > 0) {
      const { unknown, complete } = await catalog(edit.favoriteGames)
      if (unknown.length > 0) throw complete ? new ApiError("PROFILE_GAME_UNKNOWN") : new ApiError("PROFILE_UNAVAILABLE", 503)
    }

    // Only a city that Geoapify knows: the client could send any text, and the profile keeps Geoapify's spelling of the city, not the client's
    if (edit.city) {
      try {
        const found = await verifyCity(edit.city)
        if (!found) throw new ApiError("PROFILE_CITY_UNKNOWN")
        edit.city = { name: found.name, country: found.country }
      } catch (error) {
        if (!(error instanceof CitySearchUnavailable)) throw error
        console.error("A city could not be checked:", error.message)
        throw new ApiError("PROFILE_UNAVAILABLE", 503)
      }
    }

    const change = async (): Promise<ProfileChange> => {
      try {
        return await saveProfile(account.id, edit)
      } catch (error) {
        // A database that has not got the profiles yet cannot keep them: the member is told it is not available, not that something broke
        if (profilesNotApplied(error)) throw new ApiError("PROFILE_UNAVAILABLE", 503)
        throw error
      }
    }
    let answer = await change()
    // An account whose profile was never made (the database makes it with the account, so this is the rare case) gets it now, and the change is asked again
    if (answer === "missing" && (await ensureProfile(account))) answer = await change()
    if (answer === "taken") throw new ApiError("PROFILE_TAKEN", 409)
    if (answer === "invalid") throw new ApiError("PROFILE_INVALID")
    if (answer === "missing") throw new ApiError("PROFILE_UNAVAILABLE", 503)
    return { saved: true, ...edit }
  })

/**
 * `GET /api/hub/profile`: the signed-in member's own handle, `{ "nickname": "Alex", "tag": 42 }`, for the account menu and the panel head (the session has no tag). 401 when not signed in. `"tag": null` where the database has no profile or cannot be read. Never cached.
 */
export const GET = handle(async (request: Request) => {
  await rateLimit(null, request, "profileRead")
  const account = await getAccount()
  if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
  if (isDemoAccount(account)) return { nickname: account.nickname, tag: DEMO_TAG }
  try {
    const record = await ensureProfile(account)
    return record ? { nickname: record.nickname, tag: record.tag } : { nickname: account.nickname, tag: null }
  } catch (error) {
    console.error("The profile of a member could not be read for their menu", error instanceof Error ? error.message : error)
    return { nickname: account.nickname, tag: null }
  }
})
