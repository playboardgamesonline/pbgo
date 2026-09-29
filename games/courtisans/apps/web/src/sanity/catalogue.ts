import "server-only"
import { client } from "./client"
import { CATALOGUE_QUERY } from "./queries"

export async function getCatalogue() {
  return client.fetch(CATALOGUE_QUERY, {}, { next: { revalidate: 60, tags: ["catalogue"] } })
}
