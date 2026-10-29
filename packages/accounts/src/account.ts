// What the hub knows of a signed-in visitor, made of what their provider says of them: the user of Supabase Auth, as Google or Discord fill it in.
// Pure and without any import, so that the browser, the server, the proxy and the tests read it the same way (docs/accounts.md).

/** The providers a visitor can sign in with. They are enabled in the Supabase project (Authentication › Providers). */
export const PROVIDERS = ["google", "discord"] as const

export type Provider = (typeof PROVIDERS)[number]

/** The name of each provider, as a button says it. */
export const PROVIDER_NAMES: Record<Provider, string> = { google: "Google", discord: "Discord" }

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

/**
 * The account of a user. Google puts the name in `full_name` (and `name`) and the picture in `avatar_url` (and `picture`); Discord puts the name the
 * user chose, which is not their login, in `custom_claims.global_name`, then their login in `user_name`. The first of those that is a text wins.
 */
export function accountOf(user: AuthUser): Account {
  const claims = user.user_metadata ?? {}
  const custom = claims.custom_claims
  const globalName = typeof custom === "object" && custom !== null ? text((custom as Record<string, unknown>).global_name) : null
  const email = text(user.email)
  return {
    id: user.id,
    nickname: globalName ?? text(claims.full_name) ?? text(claims.name) ?? text(claims.user_name) ?? text(email?.split("@")[0]) ?? "Player",
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
