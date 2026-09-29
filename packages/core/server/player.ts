import "server-only"
import { cookies } from "next/headers"
import { SLUG } from "@pgo/binding"

const COOKIE = `${SLUG.replace(/[^a-z0-9]/gi, "_")}_player`

export async function getPlayerId(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null
}

export async function getOrCreatePlayerId(): Promise<string> {
  const store = await cookies()
  const existing = store.get(COOKIE)?.value
  if (existing) return existing
  const id = crypto.randomUUID()
  store.set(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 })
  return id
}
