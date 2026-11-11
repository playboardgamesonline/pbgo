import { parseProfileEdit, type ProfileCity, type ProfileEdit } from "@pbgo/accounts"
import { DEMO_TAG, isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import { ApiError, assertSameOrigin, handle, readJson } from "../../../../server/api"
import { ensureProfile, profilesNotApplied, saveProfile, type ProfileChange } from "../../../../server/profiles"
import { rateLimit } from "../../../../server/rate-limit"

/**
 * Which of some slugs the hub's catalog does not list, and whether it could be read in full: where the games a member may pick as favourites come from. The app hands it in (core cannot read the hub's catalog, which depends on core). Any game of the catalog
 * counts, live or not yet. `complete` is false when the platform's Sanity project did not answer and only the live games are known: a slug it does not list may still be a game then.
 */
export type CatalogCheck = (slugs: readonly string[]) => Promise<{ unknown: readonly string[]; complete: boolean }>

/** Where a city comes from, by the number a client sends: the list that ships with the site (`cityById` of `@pbgo/cities`), which the app hands in. Null for a number that is not a city of the list. */
export type CityLookup = (id: number) => ProfileCity | null

/**
 * `POST /api/hub/profile`: a signed-in member changes what their profile says (PLT-39). The body holds the fields to change and nothing else, any of `{ "nickname": "Alex", "tag": 42, "pronouns": "they/them", "country": "FR", "city": 2996944, "favoriteGames": ["flip-7"], "bio": "…" }`: a
 * field that is missing stays as it is, and `null` takes away the pronouns, the country, the favourite games and the bio. The request must come from this site. Every field is checked here (`parseProfileEdit`, and the favourite games against the catalog, `catalog`) and by
 * the database, which makes the change whole or not at all (`set_profile`). 409 `PROFILE_TAKEN` when another member has the nickname and tag (case ignored), 400 `PROFILE_INVALID` for a field a profile cannot hold, 400 `PROFILE_GAME_UNKNOWN` for a favourite that is not a game
 * of the catalog (503 `PROFILE_UNAVAILABLE` while the catalog cannot be read in full and cannot say). The city is the GeoNames number of a city of the list (`cityOf`: 400 `PROFILE_CITY_UNKNOWN` for any other, which is never free text): the server takes its name and its country from the list, never from the client, and a city
 * comes with its country, which becomes the profile's (a request that says another country is invalid). `null` takes the city away. The demo account writes nothing. The answer is `{ "saved": true }` and the fields that were kept, as they were cleaned.
 */
export const postProfile = (catalog: CatalogCheck, cityOf: CityLookup) =>
  handle(async (request: Request) => {
    assertSameOrigin(request)
    await rateLimit(null, request, "profile")
    const account = await getAccount()
    if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
    const parsed = parseProfileEdit(await readJson<unknown>(request))
    if (!parsed.ok) throw new ApiError("PROFILE_INVALID")
    const { cityId, ...rest } = parsed.edit
    const edit: ProfileEdit = { ...rest }
    if (cityId === null) edit.city = null
    else if (cityId !== undefined) {
      const found = cityOf(cityId)
      if (!found) throw new ApiError("PROFILE_CITY_UNKNOWN")
      // Only the three things a profile keeps of a city, as the list says them
      const city: ProfileCity = { id: found.id, name: found.name, country: found.country }
      if (edit.country !== undefined && edit.country !== city.country) throw new ApiError("PROFILE_INVALID")
      edit.city = city
      edit.country = city.country
    }
    if (isDemoAccount(account)) return { saved: true, ...edit }
    // Only the games of the catalog can be a favourite: the page draws their covers, and the table cannot tell (a slug is a text)
    if (edit.favoriteGames && edit.favoriteGames.length > 0) {
      const { unknown, complete } = await catalog(edit.favoriteGames)
      if (unknown.length > 0) throw complete ? new ApiError("PROFILE_GAME_UNKNOWN") : new ApiError("PROFILE_UNAVAILABLE", 503)
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
