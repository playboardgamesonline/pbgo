// What the hub knows of a signed-in visitor, made of what their provider says of them: the user of Supabase Auth, as Facebook, Google, Apple or Discord fill it in.
// Pure and without any import, so that the browser, the server, the proxy and the tests read it the same way (docs/accounts.md).

/** The providers a visitor can sign in with, in the order of the buttons. They are enabled in the Supabase project (Authentication › Providers). */
export const PROVIDERS = ["facebook", "google", "apple", "discord"] as const

export type Provider = (typeof PROVIDERS)[number]

/** The name of each provider, as a button says it. */
export const PROVIDER_NAMES: Record<Provider, string> = { facebook: "Facebook", google: "Google", apple: "Apple", discord: "Discord" }

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

/** What Apple's "Hide My Email" hands out in place of an address (`k3x9q2@privaterelay.appleid.com`): the start of it says nothing of the person, so it is not a name. */
const PRIVATE_RELAY = /@privaterelay\.appleid\.com$/i

/**
 * The account of a user. Google and Facebook put the name in `full_name` (and `name`) and the picture in `avatar_url` (and `picture`); Discord puts the name the
 * user chose, which is not their login, in `custom_claims.global_name`, then their login in `user_name`; Apple's sign-in on the web gives neither a name nor a
 * picture (it hands the name to its own scripts and apps, once), and its address may be a relay one. The first of those that is a text wins, then the start of a
 * real e-mail address, then "Player".
 */
export function accountOf(user: AuthUser): Account {
  const claims = user.user_metadata ?? {}
  const custom = claims.custom_claims
  const globalName = typeof custom === "object" && custom !== null ? text((custom as Record<string, unknown>).global_name) : null
  const email = text(user.email)
  const handle = email && !PRIVATE_RELAY.test(email) ? text(email.split("@")[0]) : null
  return {
    id: user.id,
    nickname: globalName ?? text(claims.full_name) ?? text(claims.name) ?? text(claims.user_name) ?? handle ?? "Player",
    email,
    avatarUrl: text(claims.avatar_url) ?? text(claims.picture),
    provider: PROVIDERS.find((provider) => provider === user.app_metadata?.provider) ?? null,
    createdAt: text(user.created_at),
  }
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
