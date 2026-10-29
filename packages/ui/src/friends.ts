// What the friends of a signed-in visitor are made of, for `@pbgo/ui/platform/friends-panel` (their list) and `friends-bar` (the pills of the navbar): the friend,
// the sections they are listed in, the games and the tables they are at, and what is drawn from a name. No React in this file, so that it is tested as it is.

/** What a friend is doing: in a game (they can be joined), online (they can be invited), inactive (online, but not there), do not disturb (online, and does not want to be asked) or away. */
export type FriendStatus = "playing" | "online" | "inactive" | "dnd" | "offline"

/** The game a friend is in, or is waiting to play in its lobby. */
export type FriendGame = { slug: string; name: string }

/** The table a friend is at: its code, how many players it has and how many it takes. */
export type FriendTable = { code: string; size: number; max: number }

export type Friend = {
  id: string
  nickname: string
  /** The digits that tell two players of one name apart, written after a `#` (PLT-39). */
  tag?: string
  /** Their picture; the initials of their name when there is none. */
  avatarUrl?: string | null
  status: FriendStatus
  /** The game they are in (`playing`) or waiting in the lobby of (`online`). Left out for a friend who is on the hub and in no game, or who is away. */
  game?: FriendGame
  /** The table they are at, in its lobby or playing. */
  table?: FriendTable
  /** What the line under the name says: how long a friend who is playing has been, "In the lobby", when a friend who is away was last seen. */
  activity?: string
}

/** The sections of a list of friends, in the order they are drawn, with the word each is headed by. */
const SECTIONS: readonly { status: FriendStatus; label: string }[] = [
  { status: "playing", label: "In a game" },
  { status: "online", label: "Online" },
  { status: "inactive", label: "Inactive" },
  { status: "dnd", label: "Do not disturb" },
  { status: "offline", label: "Offline" },
]

/** The friends in their sections, in order, each with the word it is headed by; a section nobody is in is left out, and the friends of one keep their order. */
export function sectionsOf(friends: readonly Friend[]): { status: FriendStatus; label: string; friends: Friend[] }[] {
  return SECTIONS.map(({ status, label }) => ({ status, label, friends: friends.filter((friend) => friend.status === status) })).filter(
    (section) => section.friends.length > 0,
  )
}

/** The friends who are connected to one game: those who wait in its lobby (`online`) and those who are playing it, and how many that makes. */
export type GameFriends = { game: FriendGame; online: Friend[]; playing: Friend[]; count: number }

/**
 * The games the friends are in right now, one entry per game, the most crowded first and then by name (a friend who is inactive, or who does not want to be disturbed, in its lobby is there too). A friend who is away, or who is in no game, is in none:
 * the pills of the navbar are the games, and the list of the friends is the page of them.
 */
export function gamesOf(friends: readonly Friend[]): GameFriends[] {
  const games = new Map<string, GameFriends>()
  for (const friend of friends) {
    if (!friend.game || friend.status === "offline") continue
    const entry = games.get(friend.game.slug) ?? { game: friend.game, online: [], playing: [], count: 0 }
    ;(friend.status === "playing" ? entry.playing : entry.online).push(friend)
    entry.count += 1
    games.set(friend.game.slug, entry)
  }
  return [...games.values()].sort((a, b) => b.count - a.count || a.game.name.localeCompare(b.game.name))
}

/**
 * A list of friends cut into the tables they are at: the ones who share a table come together under it, tables in the order of their first friend, and the ones at
 * no table stand together last, with no table.
 */
export function tablesOf(friends: readonly Friend[]): { table: FriendTable | null; friends: Friend[] }[] {
  const tables = new Map<string, { table: FriendTable; friends: Friend[] }>()
  const alone: Friend[] = []
  for (const friend of friends) {
    if (!friend.table) {
      alone.push(friend)
      continue
    }
    const group = tables.get(friend.table.code) ?? { table: friend.table, friends: [] }
    group.friends.push(friend)
    tables.set(friend.table.code, group)
  }
  return [...tables.values(), ...(alone.length > 0 ? [{ table: null, friends: alone }] : [])]
}

/** The line under a friend's name when the game is not already said by where the friend is listed: the game, then what they are doing. */
export function activityLine(friend: Friend): string | undefined {
  return [friend.game?.name, friend.activity].filter(Boolean).join(" · ") || undefined
}

/** The letters of an avatar with no picture: up to two initials of the name, in capitals; "?" for a name with nothing in it. */
export function initials(nickname: string): string {
  return (
    nickname
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => Array.from(word)[0] ?? "")
      .join("")
      .toLocaleUpperCase() || "?"
  )
}
