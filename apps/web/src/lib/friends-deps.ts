import "server-only"
import { getCatalog } from "@pbgo/catalog/server"
import type { FriendsDeps } from "@pbgo/core/routes/api/hub/friends/route"

/** What the friends' routes need of the app, which core cannot read: the name the hub gives each game, the catalog's, so that a friend at a game is told by its name (the tables only exist for games the catalog lists). */
export const friendsDeps: FriendsDeps = {
  gameNames: async () => new Map((await getCatalog()).entries.map((entry) => [entry.slug, entry.game.name] as const)),
}
