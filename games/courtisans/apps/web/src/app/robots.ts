import { createRobots } from "@pbgo/site"
import { INDEXABLE, GAME_URL } from "@/lib/site"

export default function robots() {
  return createRobots(GAME_URL, ["/api/", "/admin", "/preview"], INDEXABLE)
}
