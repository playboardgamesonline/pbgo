import "server-only"
import type { Person } from "../lib/friends"
import { isMissingTable } from "./db-error"
import { readProfiles } from "./profiles"
import { readGamesPlayed } from "./standings"
import { supabaseAdmin } from "./supabase"

// The friends of a member as their own profile lists them (the roster of its Friends block): who they are and how many games each finished, never anything of a table or of where they are (the friends' panel has that, `social_state`). Read from the tables with the server's key, like the
// totals of a member's games (`./standings`): nothing is computed over the other players, so no function of the database stands behind it. The accounts' ids stay here.

/** A friend as a profile lists them: their handle and picture, and how many games they finished, over every game. `gamesPlayed` is null for a friend who keeps their games private: a friend is somebody else, as far as the games go. */
export type RosterFriend = Person & { gamesPlayed: number | null }

/** A user of the database is a uuid. The development demo account (`id: "demo"`, in no database) is not one: it has no friends there. */
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The friends who played the most first, then by name: the order of the profile's block, and of the list it opens. */
export const mostPlayedFirst = (a: RosterFriend, b: RosterFriend): number =>
  (b.gamesPlayed ?? -1) - (a.gamesPlayed ?? -1) || a.nickname.localeCompare(b.nickname, "en", { sensitivity: "base" }) || a.tag - b.tag

/**
 * The friends of this member, the ones who played the most first. A friend whose account is closed (`account_deletions`, PLT-36) is in nobody's list until it is reopened, and one that has no profile cannot be named, so neither is listed. Without the friends (migration 0017 is not
 * applied) there is nobody. Throws what else the database says.
 */
export async function readFriendRoster(userId: string): Promise<RosterFriend[]> {
  if (!USER_ID.test(userId)) return []
  const db = supabaseAdmin()
  // A friendship is one row with the lower id first: the member is on one side or the other
  const [asFirst, asSecond] = await Promise.all([db.from("friendships").select("user_b").eq("user_a", userId), db.from("friendships").select("user_a").eq("user_b", userId)])
  for (const read of [asFirst, asSecond]) {
    if (read.error) {
      if (isMissingTable(read.error)) return []
      throw read.error
    }
  }
  const ids = [...((asFirst.data ?? []) as { user_b: string }[]).map((row) => String(row.user_b)), ...((asSecond.data ?? []) as { user_a: string }[]).map((row) => String(row.user_a))]
  if (ids.length === 0) return []
  const [profiles, closed, played] = await Promise.all([readProfiles(ids), closedAmong(ids), readGamesPlayed(ids)])
  return ids
    .flatMap((id): RosterFriend[] => {
      const profile = profiles.get(id)
      if (!profile || closed.has(id)) return []
      return [{ nickname: profile.nickname, tag: profile.tag, avatarUrl: profile.avatarUrl, gamesPlayed: profile.hideHistory ? null : (played.get(id) ?? 0) }]
    })
    .sort(mostPlayedFirst)
}

/** Which of these accounts are closed: their owner asked to delete them and has a week to change their mind. Where the table is not there (migration 0011 is not applied) none is. */
async function closedAmong(ids: readonly string[]): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin().from("account_deletions").select("user_id").in("user_id", [...ids])
  if (error) {
    if (isMissingTable(error)) return new Set()
    throw error
  }
  return new Set(((data ?? []) as { user_id: string }[]).map((row) => String(row.user_id)))
}
