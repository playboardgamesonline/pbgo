// What the statistics say of a sign-in with one of Supabase Auth's providers: which provider it was, and whether it made the account. Pure: it reads the user that Supabase Auth hands back, and says nothing of who they are.

/** The providers that sign somebody in, as the counts name them: Twitch only links, so it is none. */
export function signInProviderOf(provider: string): "google" | "discord" | "steam" | null {
  return provider === "google" || provider === "discord" || provider === "steam" ? provider : null
}

/** What `signed_in` of the analytics holds for a sign-in at `/auth/callback`. */
export type ProviderSignIn = { method: "google" | "discord"; new_account: boolean }

type SignedInUser = {
  created_at?: string
  last_sign_in_at?: string
  identities?: ReadonlyArray<{ provider: string; last_sign_in_at?: string }> | null
}

/** A sign-in made the account when it came within a minute of it: an account's first sign-in is the one that makes it. */
const NEW_ACCOUNT_WITHIN_MS = 60_000

/** A date as a number, or `-Infinity` when there is none, so that an identity that never signed in is the oldest. */
const timeOf = (value: string | undefined): number => {
  const time = value ? Date.parse(value) : Number.NaN
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

/**
 * Which provider a user has just signed in with (the identity that signed in last) and whether the sign-in made the account. Null when it is not a sign-in that counts: nobody, an e-mail address, or a service that only links
 * (Twitch), which the callback also brings back.
 */
export function providerSignInOf(user: SignedInUser | null | undefined): ProviderSignIn | null {
  if (!user) return null
  const latest = [...(user.identities ?? [])].sort((a, b) => timeOf(b.last_sign_in_at) - timeOf(a.last_sign_in_at))[0]
  if (latest?.provider !== "google" && latest?.provider !== "discord") return null
  const made = timeOf(user.created_at)
  const signedIn = timeOf(user.last_sign_in_at)
  return { method: latest.provider, new_account: Number.isFinite(made) && Number.isFinite(signedIn) && signedIn - made < NEW_ACCOUNT_WITHIN_MS }
}
