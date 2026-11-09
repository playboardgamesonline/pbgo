// Signing in with an external provider (Steam), the part that is not the provider's protocol (docs/accounts.md). Once a provider has proved who someone is (`ExternalIdentity`: the provider and the account's number
// there, which is public and proves nothing alone), this finds or makes the member of Supabase Auth who holds that identity, keeps their name and picture current, and gives back a one-time token that the route
// spends for a session (`confirmEmail`, the same call as the link of the sign-up's e-mail). The calls to Supabase are given in (`ExternalAdmin`, `ExternalStore`), so that the tests read the decisions.
//
// Supabase Auth knows a member by an address, and an external provider gives none. The member is made with an address that can never receive mail (`EXTERNAL_EMAIL_DOMAIN`) and that nobody can guess (a random identifier), so that
// nobody can have made an account with it beforehand, and the table `external_identities` (migration 0010) says who holds which identity at which provider. The address is never shown (`accountOf`).

import { EXTERNAL_EMAIL_DOMAIN, EXTERNAL_ORIGIN_KEY, externalOriginOf, fallbackNameOf, type ExternalProvider } from "./account"

/** What a provider says of someone: the name they show and, when they have one, their picture. */
export type ExternalProfile = { name: string; avatarUrl: string | null }

/**
 * Who a provider says someone is: the number of their account there, and what they show of themselves (`profile`), which is null when the provider could not say: a call that failed is not a profile, and nothing is written over
 * what the member already has because of it.
 */
export type ExternalIdentity = { provider: ExternalProvider; subject: string; profile: ExternalProfile | null }

/** The user of Supabase Auth, as far as this part reads it. */
export type AdminUser = { id: string; email?: string | null; app_metadata?: Record<string, unknown> }

type AdminResult<T> = PromiseLike<{ data: T; error: unknown }>

/** The calls of Supabase's admin API (`supabase.auth.admin`, the secret key) that a sign-in makes. */
export type ExternalAdmin = {
  createUser(attributes: { email: string; email_confirm: boolean; user_metadata: Record<string, unknown>; app_metadata: Record<string, unknown> }): AdminResult<{ user: AdminUser | null }>
  getUserById(id: string): AdminResult<{ user: AdminUser | null }>
  updateUserById(id: string, attributes: { user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }): AdminResult<unknown>
  deleteUser(id: string): AdminResult<unknown>
  /** A one-time token for the address, as the link of a magic link would carry it, without any e-mail sent. */
  generateLink(email: string): AdminResult<{ hashedToken: string | null }>
}

/** The table of identities (`external_identities`). `userOf` is null when nobody holds the identity; `add` says `taken` when someone does (a sign-in at the same moment won the race). Both throw on a failure of the database. */
export type ExternalStore = {
  userOf(provider: ExternalProvider, subject: string): Promise<string | null>
  add(provider: ExternalProvider, subject: string, userId: string): Promise<"added" | "taken">
}

export type ExternalDeps = { admin: ExternalAdmin; store: ExternalStore; randomId?: () => string }

/** Where a sign-in stopped, for the log: the step, never what it was given. */
export type ExternalStep = "lookup" | "create" | "record" | "read" | "update" | "address" | "token"

/** What a sign-in gives: the member and the token that signs them in, or the step it failed at. */
export type ExternalSignIn = { ok: true; userId: string; tokenHash: string; created: boolean } | { ok: false; step: ExternalStep }

const record = (value: unknown): Record<string, unknown> => (typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {})

/** The address that stands in for none: the provider, a random identifier, and a domain that can never receive mail. */
export function externalEmail(provider: ExternalProvider, id: string): string {
  return `${provider}-${id}@${EXTERNAL_EMAIL_DOMAIN}`
}

/** The external accounts of a user, with the one of this identity set (the name it shows, and the number of the account at the provider). The others are kept. */
function externalOf(user: AdminUser | null, identity: ExternalIdentity, name: string): Record<string, unknown> {
  return { ...record(user?.app_metadata?.external), [identity.provider]: { subject: identity.subject, name } }
}

/**
 * Takes away a member who was made a moment ago and is not needed (the table could not hold them, or another sign-in won). A failure here leaves one unused member and must not hide why the sign-in stopped, so it is swallowed.
 */
async function discard(admin: ExternalAdmin, id: string): Promise<void> {
  try {
    await admin.deleteUser(id)
  } catch {
    // one unused member stays
  }
}

/**
 * Signs an identity in. The member who holds it is found in the table; one who does not exist is made, with its provider as the way they came (`EXTERNAL_ORIGIN_KEY`: not `app_metadata.provider`, which Supabase Auth rewrites as
 * `email` at the first sign-in), its name (the provider's fallback when it could not say one) and its picture; two sign-ins at once for a new identity end with one member (the loser is deleted). A member who exists has their
 * name and picture refreshed when the account was made with this provider, and only then: someone who linked it to an account of their own keeps their own name. Nothing is refreshed when the provider could not say who they are
 * (`profile` null), and a picture is never taken away: Supabase Auth deletes a metadata key that is set to null. The token is for one use. When anything fails the answer is the step it failed at, whatever the reason: the visitor is told that the sign-in did not work, and not more, and nothing here logs what the
 * calls were given, since they hold secrets.
 */
export async function externalSignIn(identity: ExternalIdentity, { admin, store, randomId = () => crypto.randomUUID() }: ExternalDeps): Promise<ExternalSignIn> {
  let step: ExternalStep = "lookup"
  try {
    let userId = await store.userOf(identity.provider, identity.subject)
    let user: AdminUser | null = null
    let created = false

    if (userId === null) {
      step = "create"
      const name = identity.profile?.name ?? fallbackNameOf(identity.provider)
      const picture = identity.profile?.avatarUrl ?? null
      const made = await admin.createUser({
        email: externalEmail(identity.provider, randomId()),
        email_confirm: true,
        user_metadata: { full_name: name, ...(picture ? { avatar_url: picture } : {}) },
        app_metadata: { [EXTERNAL_ORIGIN_KEY]: identity.provider, external: externalOf(null, identity, name) },
      })
      if (made.error || !made.data.user) return { ok: false, step }
      const newcomer: AdminUser = made.data.user
      user = newcomer
      step = "record"
      let added: "added" | "taken"
      try {
        added = await store.add(identity.provider, identity.subject, newcomer.id)
      } catch {
        // The table could not be written: nobody holds the member that was just made, so it goes (the home counts the members of Supabase Auth)
        await discard(admin, newcomer.id)
        return { ok: false, step }
      }
      if (added === "taken") {
        // Another sign-in for the same account was quicker: its member is the one, and this one goes
        await discard(admin, newcomer.id)
        userId = await store.userOf(identity.provider, identity.subject)
        if (userId === null) return { ok: false, step }
        user = null
      } else {
        userId = user.id
        created = true
      }
    }

    if (user === null) {
      step = "read"
      const found = await admin.getUserById(userId)
      if (found.error || !found.data.user) return { ok: false, step }
      user = found.data.user
      const profile = identity.profile
      if (profile) {
        step = "update"
        const own = externalOriginOf(user.app_metadata) === identity.provider
        const updated = await admin.updateUserById(user.id, {
          ...(own ? { user_metadata: { full_name: profile.name, ...(profile.avatarUrl ? { avatar_url: profile.avatarUrl } : {}) } } : {}),
          app_metadata: { external: externalOf(user, identity, profile.name) },
        })
        if (updated.error) return { ok: false, step }
      }
    }

    step = "address"
    if (!user.email) return { ok: false, step }
    step = "token"
    const link = await admin.generateLink(user.email)
    return link.error || !link.data.hashedToken ? { ok: false, step } : { ok: true, userId: user.id, tokenHash: link.data.hashedToken, created }
  } catch {
    return { ok: false, step }
  }
}
