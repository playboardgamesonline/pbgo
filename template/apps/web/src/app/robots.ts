import { createRobots } from "@pbgo/site"
import { INDEXABLE, SITE_URL } from "@/lib/site"

export default function robots() {
  return createRobots(SITE_URL, ["/api/", "/admin", "/preview"], INDEXABLE)
}
