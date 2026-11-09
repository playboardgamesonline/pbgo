// Sign-in with Steam, the pure part (docs/accounts.md). Steam does not speak OAuth: it is an OpenID 2.0 provider, which Supabase Auth has no place for, so the hub does the dance itself. The visitor is sent to
// Steam with `steamLoginUrl`; Steam sends them back to `/auth/steam/callback` with a signed assertion; the server checks it here (`checkAssertion`), then asks Steam whether the signature is its own
// (`verificationParams`, `isValidVerification`), and only then believes the SteamID64 it holds. Nothing here calls the network or the database: the route does, and the tests read the decisions.

import { fallbackNameOf } from "./account"
import { cleanDisplayName } from "./signup"

/** Steam's OpenID endpoint: where the visitor is sent, and where the assertion is checked. */
export const STEAM_LOGIN_URL = "https://steamcommunity.com/openid/login"

/** The cookie that ties a way back to the browser that left (`newState`): without it, a stranger could have the visitor come back as the stranger's own Steam account. */
export const STEAM_STATE_COOKIE = "pbgo-steam-state"

/** How long the visitor has at Steam, in seconds: the time to type a password and a code from the phone. */
export const STEAM_STATE_MAX_AGE = 600

/** How old an assertion may be, in milliseconds. Steam refuses to confirm one twice; this keeps a stale one out all the same. */
export const NONCE_MAX_AGE_MS = 5 * 60_000

const OPENID_NS = "http://specs.openid.net/auth/2.0"
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select"
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/

/** What the signature has to cover, or a field could be changed on the way without Steam's signature noticing. */
const SIGNED_REQUIRED = ["op_endpoint", "claimed_id", "identity", "return_to", "response_nonce", "assoc_handle"] as const

/** A fresh value for the state cookie: 128 random bits, in base64url. */
export function newState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** The shape of a state: what `newState` writes, and nothing a stranger could use to slip anything into the way back. */
export const STATE_PATTERN = /^[A-Za-z0-9_-]{22}$/

/** Whether two secrets are equal, in a time that does not tell how many characters matched. */
export function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return difference === 0
}

/** Where Steam sends the visitor back: this site's callback, with the page to go on to and the state, both inside what Steam signs. */
export function steamReturnTo(origin: string, { next, state }: { next: string; state: string }): string {
  return `${origin}/auth/steam/callback?next=${encodeURIComponent(next)}&state=${state}`
}

/** The address to send the visitor to: Steam's login, which asks for no particular account (`identifier_select`) and answers at `returnTo`, for the site at `realm`. */
export function steamLoginUrl({ returnTo, realm }: { returnTo: string; realm: string }): string {
  const url = new URL(STEAM_LOGIN_URL)
  url.searchParams.set("openid.ns", OPENID_NS)
  url.searchParams.set("openid.mode", "checkid_setup")
  url.searchParams.set("openid.return_to", returnTo)
  url.searchParams.set("openid.realm", realm)
  url.searchParams.set("openid.identity", IDENTIFIER_SELECT)
  url.searchParams.set("openid.claimed_id", IDENTIFIER_SELECT)
  return url.toString()
}

/** The OpenID fields of the way back (`openid.*`), or null when there are none. Only these are ever sent on to Steam. */
export function assertionOf(params: { forEach(callback: (value: string, key: string) => void): void }): Record<string, string> | null {
  const assertion: Record<string, string> = {}
  params.forEach((value, key) => {
    if (key.startsWith("openid.")) assertion[key] = value
  })
  return Object.keys(assertion).length > 0 ? assertion : null
}

export type AssertionProblem = "namespace" | "mode" | "endpoint" | "return-to" | "claimed-id" | "identity" | "unsigned" | "nonce"

export type AssertionCheck = { ok: true; steamId: string } | { ok: false; problem: AssertionProblem }

/** The time an OpenID response nonce starts with (`2026-11-09T10:11:12Z` and then anything), in milliseconds; null when it does not start with one. */
export function nonceTime(nonce: string | undefined): number | null {
  const match = nonce === undefined ? null : /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})Z/.exec(nonce)
  const time = match ? Date.parse(`${match[1]}Z`) : Number.NaN
  return Number.isNaN(time) ? null : time
}

/**
 * What can be checked without Steam: the response is Steam's positive answer (`id_res`) for the account it names, to this site's callback and no other, that the signature covers every field that matters, and that it is
 * not old. The SteamID64 comes out of the claimed identifier, which has one shape only. This is not the proof: the signature is Steam's to confirm (`verificationParams`).
 */
export function checkAssertion(assertion: Record<string, string>, { returnTo, now }: { returnTo: string; now: number }): AssertionCheck {
  if (assertion["openid.ns"] !== OPENID_NS) return { ok: false, problem: "namespace" }
  if (assertion["openid.mode"] !== "id_res") return { ok: false, problem: "mode" }
  if (assertion["openid.op_endpoint"] !== STEAM_LOGIN_URL) return { ok: false, problem: "endpoint" }
  if (assertion["openid.return_to"] !== returnTo) return { ok: false, problem: "return-to" }
  const claimed = CLAIMED_ID.exec(assertion["openid.claimed_id"] ?? "")
  if (!claimed) return { ok: false, problem: "claimed-id" }
  if (assertion["openid.identity"] !== assertion["openid.claimed_id"]) return { ok: false, problem: "identity" }
  const signed = (assertion["openid.signed"] ?? "").split(",")
  if (!assertion["openid.sig"] || !SIGNED_REQUIRED.every((field) => signed.includes(field))) return { ok: false, problem: "unsigned" }
  const time = nonceTime(assertion["openid.response_nonce"])
  if (time === null || Math.abs(now - time) > NONCE_MAX_AGE_MS) return { ok: false, problem: "nonce" }
  return { ok: true, steamId: claimed[1]! }
}

/** The question for Steam: the same fields it signed, with the mode changed to `check_authentication`. */
export function verificationParams(assertion: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams(assertion)
  params.set("openid.mode", "check_authentication")
  return params
}

/**
 * Whether Steam's answer says the assertion is its own: OpenID's key-value form (`key:value` lines), with the namespace and one `is_valid`, which is `true`. Steam answers a forged assertion with `ns:http://specs.openid.net/auth/2.0` and
 * `is_valid:false` (seen on 2026-11-09). Anything else says no: a line that is not `key:value`, a key twice, a missing namespace, an error page, a body that holds `is_valid:true` among other things.
 */
export function isValidVerification(body: string): boolean {
  const fields = new Map<string, string>()
  for (const line of body.split(/\r?\n/)) {
    if (line === "") continue
    const colon = line.indexOf(":")
    if (colon < 1) return false
    const key = line.slice(0, colon)
    if (fields.has(key)) return false
    fields.set(key, line.slice(colon + 1))
  }
  return fields.get("ns") === OPENID_NS && fields.get("is_valid") === "true"
}

/** What the hub keeps of a Steam profile: a name and a picture. */
export type SteamProfile = { name: string; avatarUrl: string | null }

/** The name given to a Steam account whose profile has no name to keep (once it is cleaned): the one of an account whose profile could not be read at all (`fallbackNameOf`). */
export const STEAM_FALLBACK_NAME = fallbackNameOf("steam")

/** The characters that reorder or hide what is around them (the bidirectional overrides and isolates): no name keeps them, besides the control characters that `cleanDisplayName` takes out. */
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/gu

/** Steam's own hosts for the pictures of its players: nothing else is ever stored as a picture. */
const AVATAR_HOST = /(^|\.)(steamstatic\.com|akamaihd\.net)$/

/** The longest name kept, in characters: Steam's own limit is 32. */
const NAME_MAX = 40

/**
 * The profile out of the answer of `ISteamUser/GetPlayerSummaries` (`{ response: { players: [{ personaname, avatarfull, … }] } }`): the name the player shows and their large picture, if it is on one of Steam's hosts.
 * Null when the answer holds no player. The name and the picture of a profile are public on Steam, whatever its privacy settings.
 */
export function steamProfileOf(answer: unknown): SteamProfile | null {
  const players = (answer as { response?: { players?: unknown } } | null)?.response?.players
  const player = Array.isArray(players) ? (players[0] as { personaname?: unknown; avatarfull?: unknown } | undefined) : undefined
  if (!player) return null
  // Steam lets a player put anything in a name: a control character would be refused by the database (a NUL) or draw nothing, an override would turn the names around it
  const name = typeof player.personaname === "string" ? Array.from(cleanDisplayName(player.personaname.replace(BIDI_CONTROLS, ""))).slice(0, NAME_MAX).join("").trim() : ""
  let avatarUrl: string | null = null
  if (typeof player.avatarfull === "string") {
    try {
      const url = new URL(player.avatarfull)
      if (url.protocol === "https:" && AVATAR_HOST.test(url.hostname)) avatarUrl = url.toString()
    } catch {
      // not an address: no picture
    }
  }
  return { name: name || STEAM_FALLBACK_NAME, avatarUrl }
}

/** How long Steam may take to answer, in milliseconds: a visitor who has just logged in does not wait longer. */
const STEAM_TIMEOUT_MS = 5000

/**
 * Asks Steam whether the assertion is its own (OpenID's `check_authentication`): the same fields it signed, posted back to its endpoint. Steam answers once per assertion. False for anything but a yes: a no, an error, a page that
 * is not an answer, Steam down. Nothing here logs the assertion.
 */
export async function steamConfirms(assertion: Record<string, string>, doFetch: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await doFetch(STEAM_LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verificationParams(assertion),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(STEAM_TIMEOUT_MS),
    })
    return response.ok && isValidVerification(await response.text())
  } catch {
    return false
  }
}

/** Where the profile of a player is read: Steam's Web API, which needs a key. */
const PLAYER_SUMMARIES = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/"

/**
 * The name and the picture of a player (`steamProfileOf`), asked of Steam's Web API with the site's key. Null when Steam has no player under that number or does not answer: the sign-in then goes on without a name rather than fail. The key
 * is in the address Steam wants, so the address is never logged, and the answer is not kept by any cache.
 */
export async function fetchSteamProfile(steamId: string, apiKey: string, doFetch: typeof fetch = fetch): Promise<SteamProfile | null> {
  try {
    const url = new URL(PLAYER_SUMMARIES)
    url.searchParams.set("key", apiKey)
    url.searchParams.set("steamids", steamId)
    const response = await doFetch(url, { cache: "no-store", signal: AbortSignal.timeout(STEAM_TIMEOUT_MS) })
    return response.ok ? steamProfileOf(await response.json()) : null
  } catch {
    return null
  }
}
