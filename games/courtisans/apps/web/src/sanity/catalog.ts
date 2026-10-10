import "server-only"
import { client } from "@pbgo/core/sanity/client"
import { CATALOG_QUERY } from "./queries"

export async function getCatalog() {
  if (!client) throw new Error("Sanity is not configured")
  return client.fetch(CATALOG_QUERY, {}, { next: { revalidate: 60, tags: ["catalog"] } })
}
