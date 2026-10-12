import { createClient, type SanityClient } from "next-sanity"
import type { GameEntry } from "../lib/binding"
import { apiVersion, dataset, isProjectId } from "./env"

type SanityGame = Pick<GameEntry, "sanityProjectId">

const clients = new Map<string, SanityClient>()

/** The game's Sanity project is set (valid project id in the registry). */
export const sanityConfigured = (game: SanityGame) => isProjectId(game.sanityProjectId)

/** Read client (CDN) of the game's Sanity project, null when it has none. */
export function sanityClient(game: SanityGame): SanityClient | null {
  const projectId = game.sanityProjectId
  if (!isProjectId(projectId)) return null
  let client = clients.get(projectId)
  if (!client) clients.set(projectId, (client = createClient({ projectId, dataset, apiVersion, useCdn: true })))
  return client
}
