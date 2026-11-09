// What the hub knows of a signed-in visitor, made of what their provider says of them: the user of Supabase Auth, as Google, Twitch or Discord fill it in (or as the hub makes it for Steam: `./external`),
// and the language they chose. Pure, so that the browser, the server, the proxy and the tests read it the same way (docs/accounts.md).

import { countryOf } from "./details"
import { languageOf, type PlatformLanguage } from "./language"
import { secondStepDevicesOf, type AuthFactor, type SecondStepDevice } from "./mfa"
import { nicknameOf, preferencesOf, type Preferences } from "./preferences"

/** The providers that Supabase Auth signs a visitor in with (OAuth), in the order of the buttons. They are enabled in the Supabase project (Authentication › Providers). */
export const PROVIDERS = ["google", "discord", "twitch"] as const

export type Provider = (typeof PROVIDERS)[number]

/** The providers whose sign-in the hub does itself, in `/auth/<provider>` (they are no OAuth provider of Supabase Auth, and give no e-mail address): Steam, which speaks OpenID 2.0. */
export const EXTERNAL_PROVIDERS = ["steam"] as const

export type ExternalProvider = (typeof EXTERNAL_PROVIDERS)[number]

/** Any service an account can come from or be linked to. */
export type AnyProvider = Provider | ExternalProvider

/** The name of each provider, as a button says it. */
export const PROVIDER_NAMES: Record<AnyProvider, string> = { google: "Google", discord: "Discord", twitch: "Twitch", steam: "Steam" }

/**
 * What the sign-in and the sign-up offer, in the order of the buttons. Twitch is not one of them: it is only linked to an account, for the member's public profile, and makes none.
 * A provider shows once the project (or, for an external one, the server) has it switched on (`signInProviders`).
 */
export const SIGN_IN_PROVIDERS: readonly AnyProvider[] = ["google", "discord", "steam"]

/** Whether a provider is signed in to by the hub's own routes rather than by Supabase Auth. */
export function isExternalProvider(provider: string): provider is ExternalProvider {
  return EXTERNAL_PROVIDERS.some((candidate) => candidate === provider)
}

/**
 * The domain of the e-mail address that Supabase Auth is given for an account that comes from an external provider, which has none and whom Supabase would not know without one. `.invalid` is reserved for names that can never
 * exist: no mail can reach such an address, nobody can sign up with it, and `accountOf` never shows it.
 */
export const EXTERNAL_EMAIL_DOMAIN = "external.pbgo.invalid"

/** Whether an address is one of those that stand in for none (`EXTERNAL_EMAIL_DOMAIN`). */
export function isExternalEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.trim().toLowerCase().endsWith(`@${EXTERNAL_EMAIL_DOMAIN}`)
}

/**
 * The key of `app_metadata` that says which external provider an account was made with (`./external`). `provider` and `providers` cannot say it: Supabase Auth rewrites them from the identities of the user every time a one-time
 * token is spent (`UpdateAppMetaDataProviders` in supabase/auth, `verify.go`), and an account made by the hub holds the identity of its stand-in address only, so they read `email` from the first sign-in on. A key of ours is never rewritten.
 */
export const EXTERNAL_ORIGIN_KEY = "pbgo_origin"

/** The external provider an account was made with (`EXTERNAL_ORIGIN_KEY`), or null: an account of Supabase Auth's providers, of an e-mail address, or anything that is not one of ours. */
export function externalOriginOf(appMetadata: Record<string, unknown> | null | undefined): ExternalProvider | null {
  return EXTERNAL_PROVIDERS.find((provider) => provider === appMetadata?.[EXTERNAL_ORIGIN_KEY]) ?? null
}

/** The name given to an account whose provider could not say one: no call to its profile answered, or its answer had no name left once it was cleaned. */
export const fallbackNameOf = (provider: AnyProvider): string => `${PROVIDER_NAMES[provider]} player`

/** A way into the account: one of the providers, or the e-mail address and the password (`email`), with what that identity says of itself (its address, else its name) to tell it from another, when it says anything. */
export type LinkedService = { provider: AnyProvider | "email"; detail: string | null }

/** A signed-in visitor, as far as the hub draws them: a name, a picture, the way they came in. */
export type Account = {
  id: string
  /** What they are called: the name they chose for themselves (`nicknameOf`), else the name their provider gives, else the start of their e-mail, else "Player". */
  nickname: string
  email: string | null
  /** The picture their provider gives, if it gives one. */
  avatarUrl: string | null
  /** The provider they signed in with; null for the demo account of development. */
  provider: AnyProvider | null
  /** When the account was made, as Supabase Auth dates it (an ISO date); null when it is not known. */
  createdAt: string | null
  /** The language they chose, which their account keeps (`languageOf`); null until they choose one, and for the demo account of development, which keeps nothing. */
  language: PlatformLanguage | null
  /** Their preferences (`preferencesOf`): what they set, else the default of each. */
  preferences: Preferences
  /** The country or region they recorded, an ISO 3166-1 alpha-2 code (`countryOf`); null until they record one. Never a permission: the member can write their own metadata. */
  country: string | null
  /** The ways into their account that they hold now, in the order Supabase Auth lists them: what the page of their settings shows as linked, and what it can still be asked to link. */
  linked: LinkedService[]
  /** The authenticator apps that give them the second step at sign-in (`secondStepDevicesOf`: the verified TOTP factors of Supabase Auth, PLT-129): none until they set one up, and for the demo account of development, which holds none. */
  secondStep: SecondStepDevice[]
}

/** The part of Supabase Auth's user that an account is made of: what the browser and the server both hold of a session. */
export type AuthUser = {
  id: string
  email?: string | null
  created_at?: string | null
  /**
   * What the server keeps on the account: `provider`, which Supabase Auth keeps in step with the identities of the user (the first of them), `pbgo_origin`, the external provider an account was made with (`EXTERNAL_ORIGIN_KEY`: `provider` says `email` for
   * one), and `external`, the accounts of the external providers linked to it (`{ steam: { subject, name } }`, `./external`).
   */
  app_metadata?: { provider?: string; external?: unknown } & Record<string, unknown>
  user_metadata?: Record<string, unknown>
  /** The identities of the user, one for each way they can sign in (`provider`: `email`, `google`…), with what each says of itself (`identity_data`). Present on a user the server asks for, not on every session. */
  identities?: readonly { provider?: string; identity_data?: Record<string, unknown> | null }[] | null
  /** The factors of the second step that the user has set up (`mfa.enroll`), verified or not. Present on a user the server asks for, and on a session the Auth server issued. */
  factors?: readonly AuthFactor[] | null
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null)

/**
 * The ways into an account that the user holds: an identity of a provider of ours, or of the e-mail address, with its address else its name, then the external providers linked to it (`app_metadata.external`), with the name
 * they gave. An identity of any other provider is not one we draw, and neither is the e-mail address that stands in for none (`isExternalEmail`).
 */
function linkedOf(user: AuthUser): LinkedService[] {
  const identities = (user.identities ?? []).flatMap((identity): LinkedService[] => {
    const provider = identity.provider === "email" ? "email" : PROVIDERS.find((candidate) => candidate === identity.provider)
    if (!provider) return []
    const data = identity.identity_data ?? {}
    if (provider === "email" && isExternalEmail(text(data.email))) return []
    return [{ provider, detail: text(data.email) ?? text(data.full_name) ?? text(data.name) ?? text(data.user_name) ?? null }]
  })
  const external = user.app_metadata?.external
  const linked = typeof external === "object" && external !== null ? (external as Record<string, unknown>) : {}
  return [
    ...identities,
    ...EXTERNAL_PROVIDERS.flatMap((provider): LinkedService[] => {
      const entry = linked[provider]
      return typeof entry === "object" && entry !== null ? [{ provider, detail: text((entry as Record<string, unknown>).name) }] : []
    }),
  ]
}

/**
 * The account of a user. The name is the one the member chose for themselves, if they did (`nicknameOf`: a key of ours, which a provider never rewrites), else what their provider says. Google puts the name in `full_name` (and
 * `name`) and the picture in `avatar_url` (and `picture`); Twitch puts the login in `full_name` (and `name`), the name shown on its channel in `nickname`, which is not read, and the picture in `avatar_url`; Discord puts the name
 * the user chose, which is not their login, in `custom_claims.global_name`, then their login in `user_name`. The first of those that is a text wins, then the start of the e-mail address, then "Player".
 */
export function accountOf(user: AuthUser): Account {
  const claims = user.user_metadata ?? {}
  const custom = claims.custom_claims
  const globalName = typeof custom === "object" && custom !== null ? text((custom as Record<string, unknown>).global_name) : null
  // An account that comes from an external provider has no address of its own: the one that stands in for it is not shown, and gives no name
  const email = isExternalEmail(user.email) ? null : text(user.email)
  const handle = email ? text(email.split("@")[0]) : null
  return {
    id: user.id,
    nickname: nicknameOf(user) ?? globalName ?? text(claims.full_name) ?? text(claims.name) ?? text(claims.user_name) ?? handle ?? "Player",
    email,
    avatarUrl: text(claims.avatar_url) ?? text(claims.picture),
    // The provider an account was made with: an external one has its own key, since Supabase Auth reads such an account as an e-mail one (`EXTERNAL_ORIGIN_KEY`)
    provider: externalOriginOf(user.app_metadata) ?? PROVIDERS.find((provider) => provider === user.app_metadata?.provider) ?? null,
    createdAt: text(user.created_at),
    language: languageOf(user),
    preferences: preferencesOf(user),
    country: countryOf(user),
    linked: linkedOf(user),
    secondStep: secondStepDevicesOf(user.factors),
  }
}

/**
 * The e-mail address a visitor typed in the username field, or null when it is not one. Supabase Auth knows a visitor by their address alone, so a username
 * has nowhere to be looked up until the profiles exist (PLT-39): the sign-in with a password asks for the address till then.
 */
export function emailOf(identifier: string): string | null {
  const text = identifier.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : null
}

/** The letters an avatar shows when it has no picture: the first letter of up to two words of the name, upper case ("Oré Louvel" → "OL", "oré" → "O"). */
export function initialsOf(nickname: string): string {
  const letters = nickname
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
  return letters.join("").toLocaleUpperCase() || "?"
}
