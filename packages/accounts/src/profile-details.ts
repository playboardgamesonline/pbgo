// What a member says of themselves on their profile, beyond their name (migration 0018): the pronouns they go by, the country they are in, up to five favourite games and a short bio. Every visitor of the profile sees what is filled in, so none of it is private
// (the account's own country and its date of birth, which the age check reads, are another thing and stay in the settings). Pure, with no database in it, so that the form, the route, the pages and the tests read the rules the same way; the table checks them again
// (`profiles_*_check`), and `set_profile` is the one writer.

import { checkCountry, countryName, isCountryCode } from "./details"
import { tagOfRequest } from "./profile"
import { checkNickname } from "./settings"

/**
 * The pronouns a member can show beside their name: a fixed list, never free text. `value` is what the database keeps (`profiles.pronouns`, a key that no wording change can break) and `label` is what the pages write. A member who shows none has no pronouns
 * (null) and nothing is drawn.
 */
export const PRONOUNS = [
  { value: "he/him", label: "he/him" },
  { value: "she/her", label: "she/her" },
  { value: "they/them", label: "they/them" },
  { value: "he/they", label: "he/they" },
  { value: "she/they", label: "she/they" },
  { value: "any", label: "any pronouns" },
  { value: "ask", label: "ask me" },
] as const

export type Pronouns = (typeof PRONOUNS)[number]["value"]

const PRONOUN_KEYS: ReadonlySet<string> = new Set(PRONOUNS.map((pronouns) => pronouns.value))

/** Whether a value is a key of the list of pronouns. */
export const isPronouns = (value: unknown): value is Pronouns => typeof value === "string" && PRONOUN_KEYS.has(value)

/** The words a page writes for a member's pronouns ("they/them", "ask me"). */
export const pronounsLabel = (pronouns: Pronouns): string => PRONOUNS.find((entry) => entry.value === pronouns)?.label ?? pronouns

/** How many characters a bio has at most, as a person counts them (an emoji is one): the table checks the same 200. */
export const BIO_MAX = 200

/** How many line breaks a bio may hold: it is a few words, not a page. */
export const BIO_LINE_BREAKS_MAX = 3

// Every control character but the line break, and the two Unicode separators that browsers draw as one: a bio is text with a few `\n`, and the table refuses the rest (`profiles_bio_check`)
const BIO_CONTROLS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/gu

const lineBreaksIn = (text: string): number => text.split("\n").length - 1

/**
 * A bio as a profile keeps it: every kind of line break written `\n` (the two separators of Unicode count as one), no other control character, nothing around the text. What is left may be empty. It never changes the length of what a member means to say, so it
 * is safe to run on every keystroke, and what it returns is what the table accepts as it is.
 */
export function cleanBio(text: string): string {
  return text.replace(/\r\n?|[\u2028\u2029]/gu, "\n").replace(BIO_CONTROLS, "").trim()
}

/** How many characters a bio has left, which is the counter of its field: counted as `checkBio` counts, on the text as it will be kept, so it is negative exactly when the bio is refused for its length. */
export function bioCharactersLeft(text: string): number {
  return BIO_MAX - Array.from(cleanBio(text)).length
}

/** A bio as the member typed it, judged: the text kept (null when there is none: an empty field clears the bio), or what is wrong with it, in a sentence they can act on. Never HTML: the pages draw it as text. */
export function checkBio(text: string): { ok: true; bio: string | null } | { ok: false; problem: string } {
  const bio = cleanBio(text)
  if (bio === "") return { ok: true, bio: null }
  if (Array.from(bio).length > BIO_MAX) return { ok: false, problem: `Use ${BIO_MAX} characters at most.` }
  if (lineBreaksIn(bio) > BIO_LINE_BREAKS_MAX) return { ok: false, problem: `Use ${BIO_LINE_BREAKS_MAX} line breaks at most.` }
  return { ok: true, bio }
}

/** How many favourite games a member can have. */
export const FAVORITES_MAX = 5

/** What a game's slug is (lowercase letters and digits, words joined by single dashes, 48 characters at most: the longest an expansion's is), which the table checks too. Whether it is a game of the catalog is for the server to say. */
export const isGameSlug = (value: unknown): value is string => typeof value === "string" && value.length <= 48 && /^[a-z0-9]+(-[a-z0-9]+)*$/u.test(value)

/** A list of favourite games as a request says it: slugs, `FAVORITES_MAX` at most, none twice, in the order the member put them. Null for anything else. */
export function favoriteGamesOf(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > FAVORITES_MAX) return null
  const slugs: string[] = []
  for (const slug of value) {
    if (!isGameSlug(slug) || slugs.includes(slug)) return null
    slugs.push(slug)
  }
  return slugs
}

/** The city a member says they live in: a city of the list that ships with the site (`@pbgo/cities`), kept as its GeoNames number, its name and its country, which is the profile's own country (the table checks it). Never free text. */
export type ProfileCity = { id: number; name: string; country: string }

/** The words a page writes for a city, with its country: "Lyon, France". */
export const cityText = (city: ProfileCity): string => `${city.name}, ${countryName(city.country)}`

/** What a profile says of its member beyond their name. Empty by default: a member who fills nothing in shows nothing. */
export type ProfileDetails = {
  pronouns: Pronouns | null
  /** An ISO 3166-1 alpha-2 code (`FR`); the name is made from it (`countryName`). */
  country: string | null
  /** Their city, in that country. */
  city: ProfileCity | null
  /** The slugs of the games, in the order the member put them. A slug that is not a game of the catalog any more is for the page to leave out. */
  favoriteGames: string[]
  /** Plain text, `BIO_MAX` characters at most. */
  bio: string | null
}

/** A profile that says nothing. */
export const noProfileDetails = (): ProfileDetails => ({ pronouns: null, country: null, city: null, favoriteGames: [], bio: null })

/** Whether a profile says anything of its member beyond their name. */
export const hasProfileDetails = (details: ProfileDetails): boolean => details.pronouns !== null || details.country !== null || details.city !== null || details.favoriteGames.length > 0 || details.bio !== null

// The city of a row: its three columns, and only when the city is in the country the profile says (a city of another country is never drawn)
function cityOfRow(row: Record<string, unknown>, country: string | null): ProfileCity | null {
  const { city_id: id, city_name: name, city_country: cityCountry } = row
  if (typeof id !== "number" || !Number.isInteger(id) || id < 1 || typeof name !== "string" || name === "" || Array.from(name).length > 100) return null
  return isCountryCode(cityCountry) && cityCountry === country ? { id, name, country: cityCountry } : null
}

/** The details a row of the database says (`pronouns`, `country`, `city_*`, `favorite_games`, `bio`), read as safely as anything that comes from outside: the table checks all of it, and this is only never to draw what it does not hold. A row without them (a migration is not applied) says nothing. */
export function detailsOf(row: Record<string, unknown> | null | undefined): ProfileDetails {
  if (!row) return noProfileDetails()
  const slugs = Array.isArray(row.favorite_games) ? [...new Set(row.favorite_games.filter(isGameSlug))].slice(0, FAVORITES_MAX) : []
  const bio = typeof row.bio === "string" ? checkBio(row.bio) : null
  const country = isCountryCode(row.country) ? row.country : null
  return {
    pronouns: isPronouns(row.pronouns) ? row.pronouns : null,
    country,
    city: cityOfRow(row, country),
    favoriteGames: slugs,
    bio: bio?.ok ? bio.bio : null,
  }
}

/**
 * What a member changes of their profile, only the fields that are there: a field that is missing is left as it is, `null` takes away the pronouns, the country or the bio, and an empty list takes away the favourite games. A client that sends one field
 * never rewrites the others.
 */
export type ProfileEdit = {
  nickname?: string
  tag?: number
  pronouns?: Pronouns | null
  country?: string | null
  /** The city, with its name and its country as the list of cities says them (the server looks the city up: see `ParsedProfileEdit`). `null` takes it away. */
  city?: ProfileCity | null
  favoriteGames?: string[]
  bio?: string | null
}

/** What a request body asks for, before the server has looked a city up: the same as `ProfileEdit`, with the city as the GeoNames number the client sends (a client never says a city's name or country, the list does). */
export type ParsedProfileEdit = Omit<ProfileEdit, "city"> & { cityId?: number | null }

const isThere = (body: Record<string, unknown>, key: keyof ProfileEdit): boolean => Object.hasOwn(body, key) && body[key] !== undefined

/**
 * The change that a request body asks for (`POST /api/hub/profile`), judged: the fields it holds, cleaned as the profile keeps them (the nickname as `checkNickname` makes it, the country in capitals, the bio as `cleanBio` makes it), or `ok: false` for a body that is not
 * an object, that has no field of a profile, or that has a field a profile cannot hold. An empty text clears the pronouns and the country, as `null` does. A key this does not know is left out: a client cannot say whose profile it is, the session does. Whether the
 * favourite games are games of the catalog is not judged here: only the server can say.
 */
export function parseProfileEdit(body: unknown): { ok: true; edit: ParsedProfileEdit } | { ok: false } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false }
  const input = body as Record<string, unknown>
  const edit: ParsedProfileEdit = {}
  if (isThere(input, "nickname")) {
    const checked = typeof input.nickname === "string" ? checkNickname(input.nickname) : null
    if (!checked?.ok) return { ok: false }
    edit.nickname = checked.nickname
  }
  if (isThere(input, "tag")) {
    const tag = tagOfRequest(input.tag)
    if (tag === null) return { ok: false }
    edit.tag = tag
  }
  if (isThere(input, "pronouns")) {
    const { pronouns } = input
    if (pronouns === null || pronouns === "") edit.pronouns = null
    else if (isPronouns(pronouns)) edit.pronouns = pronouns
    else return { ok: false }
  }
  if (isThere(input, "country")) {
    const checked = input.country === null ? { ok: true as const, country: null } : typeof input.country === "string" ? checkCountry(input.country) : null
    if (!checked?.ok) return { ok: false }
    edit.country = checked.country
  }
  if (isThere(input, "city")) {
    const { city } = input
    if (city === null) edit.cityId = null
    else if (typeof city === "number" && Number.isInteger(city) && city >= 1 && city <= 2_147_483_647) edit.cityId = city
    else return { ok: false }
  }
  if (isThere(input, "favoriteGames")) {
    const slugs = input.favoriteGames === null ? [] : favoriteGamesOf(input.favoriteGames)
    if (slugs === null) return { ok: false }
    edit.favoriteGames = slugs
  }
  if (isThere(input, "bio")) {
    const checked = input.bio === null ? { ok: true as const, bio: null } : typeof input.bio === "string" ? checkBio(input.bio) : null
    if (!checked?.ok) return { ok: false }
    edit.bio = checked.bio
  }
  return Object.keys(edit).length === 0 ? { ok: false } : { ok: true, edit }
}
