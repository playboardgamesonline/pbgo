// What the friends of a signed-in visitor are made of, for `@pbgo/ui/platform/friends-panel` (their list) and `friends-bar` (the pills of the navbar): the friend,
// the sections they are listed in, the games and the tables they are at, and what is drawn from a name. No React in this file, so that it is tested as it is.

/** What a friend is doing: in a game (they can be joined), online (they can be invited), inactive (online, but not there), do not disturb (online, and does not want to be asked) or away. */
export type FriendStatus = "playing" | "online" | "inactive" | "dnd" | "offline"

/** The game a friend is in, or is waiting to play in its lobby. */
export type FriendGame = { slug: string; name: string }

/** The table a friend is at: its code, how many players it has and how many it takes. */
export type FriendTable = { code: string; size: number; max: number }

/** Where a friend stands as to groups: in the visitor's own group, or in another one. Left out for a friend who is in none. */
export type FriendGroup = "yours" | "other"

/** What waits for a friend's answer: the visitor invited them to their group, or asked to join theirs. Left out when nothing does. */
export type FriendPending = "invited" | "requested"

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
  /** Whether they are in a group, and whose: a friend in the visitor's own group is not invited, and one in another group can be asked to let the visitor in. */
  group?: FriendGroup
  /** What waits for their answer. */
  pending?: FriendPending
}

/** What the button of a friend's row (and the entry of their menu) does about groups: invite them to the visitor's group, or ask to join theirs. `pending` is a request that waits: the button says so and is off. */
export type GroupAction = { kind: "invite" | "join"; label: string; title: string; pending: boolean }

/**
 * The one thing a visitor can do about groups with a friend, or none: a friend who is in the visitor's group has nothing; one who is in another group can be asked to let the visitor in ("Join"); one who is connected and in none can be invited ("Invite"). A friend who is away
 * is invited from the picker of the group (the invitation waits for them), not from the row. A request that waits is "Invited" or "Requested", off, so that it is not sent twice.
 */
export function groupActionOf(friend: Friend): GroupAction | null {
  if (friend.group === "yours") return null
  if (friend.group === "other") {
    const pending = friend.pending === "requested"
    return { kind: "join", label: pending ? "Requested" : "Join", title: pending ? "Waiting for their answer" : "Ask to join their group", pending }
  }
  if (friend.status === "offline") return null
  const pending = friend.pending === "invited"
  return { kind: "invite", label: pending ? "Invited" : "Invite", title: pending ? "Waiting for their answer" : "Invite to your group", pending }
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

/** A group of the roster of friends: a game with the friends who are in it, or friends in no game with the status that they share. */
export type RosterGroup =
  | { kind: "game"; key: string; game: FriendGame; friends: Friend[] }
  | { kind: "status"; key: string; status: FriendStatus; label: string; friends: Friend[] }

/**
 * The roster of friends, game by game: first each game that some of them are in, the most crowded first and then by name, with all of its friends in one list,
 * those who wait in its lobby (online, inactive, do not disturb) mixed with those who play it, who come first; then, by status, the friends who are in no game,
 * and those who are away last. A friend is in one group only, and an empty group is not made.
 */
export function rosterOf(friends: readonly Friend[]): RosterGroup[] {
  const placed = new Set<string>()
  const groups: RosterGroup[] = gamesOf(friends).map(({ game, playing, online }) => {
    const members = [...playing, ...online]
    for (const friend of members) placed.add(friend.id)
    return { kind: "game", key: `game:${game.slug}`, game, friends: members }
  })
  for (const section of sectionsOf(friends.filter((friend) => !placed.has(friend.id)))) {
    groups.push({ kind: "status", key: `status:${section.status}`, status: section.status, label: section.label, friends: section.friends })
  }
  return groups
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

/** What a friend's row says of their group, in the quiet line under their name: "In your group" for a friend in the visitor's own, "In a group" for one in another. Nothing for a friend who is in none. */
export function groupWord(friend: Pick<Friend, "group">): string | undefined {
  return friend.group === "yours" ? "In your group" : friend.group === "other" ? "In a group" : undefined
}

/** The word of a friend's presence, when nothing says more: "Online", "In a game", "Inactive", "Do not disturb", "Offline". */
export function presenceWord(friend: Friend): string {
  return friend.status === "offline" ? "Offline" : friend.status === "playing" ? "In a game" : friend.status === "inactive" ? "Inactive" : friend.status === "dnd" ? "Do not disturb" : "Online"
}

/** What a friend is doing, in one line, for a chat or a card: the game and what they do there, or the word of their presence. */
export function statusLine(friend: Friend): string {
  return activityLine(friend) ?? presenceWord(friend)
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

/**
 * The friends who are connected, in the order the dock's bar draws them: those who are playing, then those who wait online, inactive ones and those who do not want to be disturbed, each group in the order the friends came in (the server's, by name).
 * A friend who is away is not in it.
 */
export function connectedOf(friends: readonly Friend[]): Friend[] {
  return sectionsOf(friends.filter((friend) => friend.status !== "offline")).flatMap((section) => section.friends)
}

/** The friends who match what was typed in a search (nickname, tag, or `nickname#tag`, whatever the case): all of them for nothing but spaces. */
export function matchingFriends(friends: readonly Friend[], query: string): Friend[] {
  const wanted = query.trim().replace(/^@/, "").toLocaleLowerCase()
  if (wanted === "") return [...friends]
  return friends.filter((friend) => `${friend.nickname}#${friend.tag ?? ""}`.toLocaleLowerCase().includes(wanted))
}

/**
 * The friends a visitor may invite, as the picker lists them: the connected ones first, as suggestions (those who are free first, then those who do not want to be disturbed, then those who are playing, since a game in progress keeps them), then those who are away, each list narrowed by `query`. A friend who is
 * not connected is listed too: the invitation waits for them, and is seen when they come back (it expires).
 */
export function suggestionsOf(friends: readonly Friend[], query = ""): { online: Friend[]; offline: Friend[] } {
  const found = matchingFriends(friends, query)
  const free: FriendStatus[] = ["online", "inactive", "dnd", "playing"]
  const online = connectedOf(found).sort((a, b) => free.indexOf(a.status) - free.indexOf(b.status))
  return { online, offline: found.filter((friend) => friend.status === "offline") }
}
