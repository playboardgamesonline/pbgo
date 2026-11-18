// What stops a group from playing a game, or from searching at all, as the home's play zone says it (PLT-21): pure, so that it is tested as it is. The server decides all the same (a refusal of its routes is a toast); this is what the page knows in
// advance and can say: a game that the group is too large for is greyed out with the reason, a search that cannot start says why beside its button, and so does a game that cannot be started for the group (PLT-141). A reason that only the server can know (a member
// too young for a game for adults, a rank gap) is not here: the routes refuse it and the page tells it then.

/** How many players a game takes, from its least to its most (`playerRange` of `@pbgo/ui/tables`). */
export type GameLimits = { min: number; max: number }

/**
 * The people the visitor looks for a table with: how many sit together (the visitor, alone, is 1), which of the others are in a game now and which are offline, by nickname, which the members of a group show each other already, and whether the visitor decides for them: alone, or the leader
 * of the group. In a group only its leader looks for a game or opens a table.
 */
export type PlayGroup = { size: number; inGame: readonly string[]; offline: readonly string[]; leads: boolean }

/** The visitor with nobody: a search of their own, which they decide. */
export const ALONE: PlayGroup = { size: 1, inGame: [], offline: [], leads: true }

/** Why a game cannot be played by the group, as a code and the figures it is made of; `gameRefusalText` words it. */
export type GameRefusal = { code: "GROUP_TOO_LARGE"; players: number; max: number }

/** Whether a game can be played by the group: it cannot when more people sit together than it takes. Null when it can. */
export function gameRefusal(group: Pick<PlayGroup, "size">, limits: GameLimits): GameRefusal | null {
  return group.size > limits.max ? { code: "GROUP_TOO_LARGE", players: group.size, max: limits.max } : null
}

/** A refusal in a sentence, for the hover of a game and for the line above the button. */
export function gameRefusalText(refusal: GameRefusal): string {
  return `Your group has ${refusal.players} players and this game takes ${refusal.max} at most.`
}

/** Why the visitor cannot search at all, whatever the game: they are in a group they do not lead, one of its members is in a game, or a group cannot search together (a group is only a way to open a table for its members). */
export type SearchBlock = { code: "NOT_LEADER" } | { code: "MEMBER_IN_GAME"; names: readonly string[] } | { code: "GROUP_SEARCH" }

/** Whether the visitor can look for a table: only the leader of a group does, a member who is in a game stops it, and so does a group of two or more, which does not search together. Null when they can. */
export function searchBlock(group: PlayGroup): SearchBlock | null {
  if (!group.leads) return { code: "NOT_LEADER" }
  if (group.inGame.length > 0) return { code: "MEMBER_IN_GAME", names: group.inGame }
  if (group.size > 1) return { code: "GROUP_SEARCH" }
  return null
}

/** Names in a sentence: "Ann", "Ann and Bob", "Ann, Bob and Cat". */
function listOf(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/** A block in a sentence, for the line above the button. */
export function searchBlockText(block: SearchBlock): string {
  if (block.code === "NOT_LEADER") return "Only the leader of your group can find a game."
  if (block.code === "MEMBER_IN_GAME") return `${listOf(block.names)} ${block.names.length === 1 ? "is" : "are"} in a game.`
  return "A group can't search together. Leave the group to search alone."
}

/** Why the visitor cannot start a game for the group from the zone (Custom, PLT-141): they are in a group they do not lead, the group is smaller than the game needs, a member is in a game, or a member is offline. */
export type TableBlock =
  | { code: "NOT_LEADER" }
  | { code: "GROUP_TOO_SMALL"; players: number; min: number }
  | { code: "MEMBER_IN_GAME"; names: readonly string[] }
  | { code: "MEMBER_OFFLINE"; names: readonly string[] }

/**
 * Whether the visitor can start a game for the group: in a group only its leader does; the group is the table, so it must be at least what the game needs (`limits`, the game's: none while no game is picked); and everybody must be there to sit down by themselves, so a member
 * who is in a game or is offline stops it. The reasons come in that order. Null when they can.
 */
export function tableBlock(group: PlayGroup, limits: GameLimits | null): TableBlock | null {
  if (!group.leads) return { code: "NOT_LEADER" }
  if (limits && group.size < limits.min) return { code: "GROUP_TOO_SMALL", players: group.size, min: limits.min }
  if (group.inGame.length > 0) return { code: "MEMBER_IN_GAME", names: group.inGame }
  if (group.offline.length > 0) return { code: "MEMBER_OFFLINE", names: group.offline }
  return null
}

/** A table block in a sentence, for the line beside the button. */
export function tableBlockText(block: TableBlock): string {
  switch (block.code) {
    case "NOT_LEADER":
      return "Only the leader of your group can start a game."
    case "GROUP_TOO_SMALL":
      return `This game needs at least ${block.min} players. Invite ${block.min - block.players === 1 ? "a friend" : "friends"} first.`
    case "MEMBER_IN_GAME":
      return `${listOf(block.names)} ${block.names.length === 1 ? "is" : "are"} in a game.`
    case "MEMBER_OFFLINE":
      return `${listOf(block.names)} ${block.names.length === 1 ? "is" : "are"} offline.`
  }
}
