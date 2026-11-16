import "server-only"
import type { Account } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { mostPlayedFirst, readFriendRoster, type RosterFriend } from "@pbgo/core/server/friend-roster"
import { DEMO_FRIEND_GAMES, DEMO_FRIENDS } from "./demo-data"

export type { RosterFriend as ProfileFriend }

// The friends that the Friends block of a member's own profile lists (`/me/profile`): who they are and how many games each finished, the ones who played the most first. Never another member's: a profile that somebody else opens has no list of friends. The friends are the database's
// (`@pbgo/core/server/friend-roster`); the demo account of development is in no database, so its friends are the made-up ones of the social panel (`demo-data.ts`).

/**
 * The friends of this member as their profile lists them, or null when they cannot be read (the cause is in the log): the block is then left out, since "no friends" would be a thing the page does not know.
 */
export async function ownFriends(account: Pick<Account, "id">): Promise<RosterFriend[] | null> {
  if (isDemoAccount(account)) return DEMO_FRIENDS.map((friend) => ({ nickname: friend.nickname, tag: Number(friend.tag), avatarUrl: friend.avatarUrl ?? null, gamesPlayed: DEMO_FRIEND_GAMES[friend.nickname] ?? 0 })).sort(mostPlayedFirst)
  try {
    return await readFriendRoster(account.id)
  } catch (error) {
    console.error("The friends of a member could not be read", error instanceof Error ? error.message : error)
    return null
  }
}
