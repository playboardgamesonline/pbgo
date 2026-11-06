import "server-only"
import { cookies } from "next/headers"
import { isPlayerSecret, newPlayerSecret, playerIdOf } from "./player-id"

/** One identity per game (`<slug>_player`): being at a table of one game says nothing about the others. */
const cookieName = (slug: string) => `${slug.replace(/[^a-z0-9]/gi, "_")}_player`

/**
 * Who is asking, as the tables know them: the player id of the secret in the game's cookie (`player-id.ts`), null when the browser has
 * none. A cookie whose value is not a secret made by this server is no cookie at all, so a player id, or the UUID that the cookie
 * held before the id and the secret were told apart, identifies nobody. Never the secret itself: callers get the public half.
 */
export async function getPlayerId(slug: string): Promise<string | null> {
  const secret = (await cookies()).get(cookieName(slug))?.value
  return secret && isPlayerSecret(secret) ? playerIdOf(slug, secret) : null
}

/** `getPlayerId`, and a browser with no secret yet is given one: only a route handler can write a cookie, so create and join are the ones to call this. */
export async function getOrCreatePlayerId(slug: string): Promise<string> {
  const store = await cookies()
  const name = cookieName(slug)
  const existing = store.get(name)?.value
  if (existing && isPlayerSecret(existing)) return playerIdOf(slug, existing)
  const secret = newPlayerSecret()
  // path "/": the game's API lives under /api/<slug>, outside the game's pages
  store.set(name, secret, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 })
  return playerIdOf(slug, secret)
}
