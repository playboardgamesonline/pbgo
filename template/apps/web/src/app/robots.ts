import { createRobots } from "@pgo/site"
import { SITE_URL } from "@/lib/site"

export default function robots() {
  return createRobots(SITE_URL, ["/api/", "/admin", "/preview"])
}
