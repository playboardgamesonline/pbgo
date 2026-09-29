import "server-only"
import { client } from "@pgo/core/sanity/client"
import { CATALOG_QUERY } from "./queries"

export async function getCatalog() {
  if (!client) throw new Error("Sanity non configuré")
  return client.fetch(CATALOG_QUERY, {}, { next: { revalidate: 60, tags: ["catalog"] } })
}
