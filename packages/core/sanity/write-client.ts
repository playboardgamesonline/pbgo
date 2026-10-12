import "server-only"
import { createClient, type SanityClient } from "next-sanity"
import type { GameEntry } from "../lib/binding"
import { apiVersion, dataset, isProjectId, writeTokenName } from "./env"

export { writeTokenName }

type SanityGame = Pick<GameEntry, "slug" | "sanityProjectId">

const clients = new Map<string, SanityClient>()

/** Write client of the game's Sanity project (admin), null without a project id or a write token. */
export function writeClient(game: SanityGame): SanityClient | null {
  const token = process.env[writeTokenName(game.slug)]
  if (!isProjectId(game.sanityProjectId) || !token) return null
  const key = `${game.sanityProjectId}:${token}`
  let client = clients.get(key)
  if (!client) clients.set(key, (client = createClient({ projectId: game.sanityProjectId, dataset, apiVersion, token, useCdn: false })))
  return client
}

/** The admin can save to Sanity. */
export const sanityWritable = (game: SanityGame) => !!writeClient(game)
