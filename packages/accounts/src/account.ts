// What the hub knows of a signed-in visitor, made of what their provider says of them: the user of Supabase Auth, as Facebook, Google, Twitch or Discord fill it in,
// and the language they chose. Pure, so that the browser, the server, the proxy and the tests read it the same way (docs/accounts.md).

import { languageOf, type PlatformLanguage } from "./language"

/** The providers a visitor can sign in with, in the order of the buttons. They are enabled in the Supabase project (Authentication › Providers). */
export const PROVIDERS = ["facebook", "google", "twitch", "discord"] as const

export type Provider = (typeof PROVIDERS)[number]

/** The name of each provider, as a button says it. */
export const PROVIDER_NAMES: Record<Provider, string> = { facebook: "Facebook", google: "Google", twitch: "Twitch", discord: "Discord" }

/** A signed-in visitor, as far as the hub draws them: a name, a picture, the way they came in. */
export type Account = {
  id: string
  /** What they are called: the name their provider gives, else the start of their e-mail, else "Player". */
  nickname: string
  email: string | null
  /** The picture their provider gives, if it gives one. */
  avatarUrl: string | null
  /** The provider they signed in with; null for the demo account of development. */
  provider: Provider | null
  /** When the account was made, as Supabase Auth dates it (an ISO date); null when it is not known. */
  createdAt: string | null
  /** The language they chose, which their account keeps (`languageOf`); null until they choose one, and for the demo account of development, which keeps nothing. */
  language: PlatformLanguage | null
}

/** The part of Supabase Auth's user that an account is made of: what the browser and the server both hold of a session. */
export type AuthUser = {
  id: string
  email?: string | null
  created_at?: string | null
  app_metadata?: { provider?: string } & Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null)

/**
 * The account of a user. Google and Facebook put the name in `full_name` (and `name`) and the picture in `avatar_url` (and `picture`); Twitch puts the login in
 * `full_name` (and `name`), the name shown on its channel in `nickname`, which is not read, and the picture in `avatar_url`; Discord puts the name the user chose,
 * which is not their login, in `custom_claims.global_name`, then their login in `user_name`. The first of those that is a text wins, then the start of the e-mail
 * address, then "Player".
 */
export function accountOf(user: AuthUser): Account {
  const claims = user.user_metadata ?? {}
  const custom = claims.custom_claims
  const globalName = typeof custom === "object" && custom !== null ? text((custom as Record<string, unknown>).global_name) : null
  const email = text(user.email)
  const handle = email ? text(email.split("@")[0]) : null
  return {
    id: user.id,
    nickname: globalName ?? text(claims.full_name) ?? text(claims.name) ?? text(claims.user_name) ?? handle ?? "Player",
    email,
    avatarUrl: text(claims.avatar_url) ?? text(claims.picture),
    provider: PROVIDERS.find((provider) => provider === user.app_metadata?.provider) ?? null,
    createdAt: text(user.created_at),
    language: languageOf(user),
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
