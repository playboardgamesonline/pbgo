import "server-only"
import { cookies } from "next/headers"

/** One player id per game (`<slug>_player`): being at a table of one game says nothing about the others. */
const cookieName = (slug: string) => `${slug.replace(/[^a-z0-9]/gi, "_")}_player`

export async function getPlayerId(slug: string): Promise<string | null> {
  return (await cookies()).get(cookieName(slug))?.value ?? null
}

export async function getOrCreatePlayerId(slug: string): Promise<string> {
  const store = await cookies()
  const name = cookieName(slug)
  const existing = store.get(name)?.value
  if (existing) return existing
  const id = crypto.randomUUID()
  // path "/": the game's API lives under /api/<slug>, outside the game's pages
  store.set(name, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 })
  return id
}
