import "server-only"
import type { Person } from "../lib/friends"
import { isMissingFunction, isMissingTable } from "./db-error"
import { readProfiles } from "./profiles"
import { readPlayerTotals } from "./standings"
import { supabaseAdmin } from "./supabase"

// The friends of a member as their own profile lists them (the Friends zone and the list it opens): who they are, how many games each finished, how many of them they won and the place they came at on average, never anything of a table or of where they are (the friends' panel has that,
// `social_state`). The games and the wins are read from the tables with the server's key, like the totals of a member's games (`./standings`); the average place is the database's own (`friend_places`, migration 0029): it is an average over every seat of every friend, which is not for the server
// to page through. The accounts' ids stay here.

/**
 * A friend as a profile lists them: their handle and picture, how many games they finished over every game, the share they won in whole percent (null with no game) and the place they came at on average (one decimal, 1 is first; null where no game of theirs ranked anybody). All three are
 * null for a friend who keeps their games private: a friend is somebody else, as far as the games go.
 */
export type RosterFriend = Person & { gamesPlayed: number | null; winRate: number | null; averagePlace: number | null }

/** A user of the database is a uuid. The development demo account (`id: "demo"`, in no database) is not one: it has no friends there. */
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The friends who played the most first, then by name: the order of the profile's zone, and of the list it opens. */
export const mostPlayedFirst = (a: RosterFriend, b: RosterFriend): number =>
  (b.gamesPlayed ?? -1) - (a.gamesPlayed ?? -1) || a.nickname.localeCompare(b.nickname, "en", { sensitivity: "base" }) || a.tag - b.tag

/**
 * The friends of this member, the ones who played the most first. A friend whose account is closed (`account_deletions`, PLT-36) is in nobody's list until it is reopened, and one that has no profile cannot be named, so neither is listed. Without the friends (migration 0017 is not
 * applied) there is nobody. Throws what else the database says, but for the average place, which is the least of what the list says: where it cannot be read the list is drawn without it.
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
  const [profiles, closed, totals, places] = await Promise.all([readProfiles(ids), closedAmong(ids), readPlayerTotals(ids), placesOf(userId)])
  return ids
    .flatMap((id): RosterFriend[] => {
      const profile = profiles.get(id)
      if (!profile || closed.has(id)) return []
      const friend = { nickname: profile.nickname, tag: profile.tag, avatarUrl: profile.avatarUrl }
      if (profile.hideHistory) return [{ ...friend, gamesPlayed: null, winRate: null, averagePlace: null }]
      const played = totals.get(id)?.played ?? 0
      const wins = totals.get(id)?.wins ?? 0
      return [{ ...friend, gamesPlayed: played, winRate: played > 0 ? Math.round((wins / played) * 100) : null, averagePlace: places.get(id) ?? null }]
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

/**
 * The place each friend of this member came at on average, by the friend's account id (`friend_places`, migration 0029): a friend with no ranked game is not in the map. Where the function is not there (the migration is not applied) or cannot answer, the map is empty and the cause is in the log:
 * the list is drawn with a dash for the place.
 */
async function placesOf(userId: string): Promise<Map<string, number>> {
  const places = new Map<string, number>()
  const { data, error } = await supabaseAdmin().rpc("friend_places", { p_user: userId })
  if (error) {
    if (!isMissingFunction(error)) console.error("The average places of the friends of a member could not be read", error.message)
    return places
  }
  for (const row of (Array.isArray(data) ? data : []) as Record<string, unknown>[]) {
    const place = Number(row.avg_place)
    if (typeof row.friend_id === "string" && Number.isFinite(place) && place >= 1) places.set(row.friend_id, place)
  }
  return places
}
