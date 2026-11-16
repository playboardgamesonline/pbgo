// What stops a group from playing a game, or from searching at all, as the home's play zone says it (PLT-21): pure, so that it is tested as it is. The server decides all the same (a refusal of its routes is a toast); this is what the page knows in
// advance and can say: a game that the group is too large for is greyed out with the reason, and a search that cannot start says why above its button. A reason that only the server can know (a member too young for a game for adults, a rank gap) is not here: the
// routes refuse it and the page tells it then.

/** How many players a game takes, from its least to its most (`playerRange` of `@pbgo/ui/tables`). */
export type GameLimits = { min: number; max: number }

/**
 * The people the visitor looks for a table with: how many sit together (the visitor, alone, is 1), which of the others are in a game now, by nickname, which the members of a group show each other already, and whether the visitor decides for them: alone, or the leader of the group.
 * In a group only its leader looks for a game or opens a table.
 */
export type PlayGroup = { size: number; inGame: readonly string[]; leads: boolean }

/** The visitor with nobody: a search of their own, which they decide. */
export const ALONE: PlayGroup = { size: 1, inGame: [], leads: true }

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

/** Why the visitor cannot open a table from the zone: they are in a group they do not lead. */
export type TableBlock = { code: "NOT_LEADER" }

/** Whether the visitor can open a table: in a group, only its leader does. Null when they can. */
export function tableBlock(group: Pick<PlayGroup, "leads">): TableBlock | null {
  return group.leads ? null : { code: "NOT_LEADER" }
}

const TABLE_BLOCK_TEXTS: Record<TableBlock["code"], string> = { NOT_LEADER: "Only the leader of your group can start a game." }

/** A table block in a sentence, for the line above the button. */
export function tableBlockText(block: TableBlock): string {
  return TABLE_BLOCK_TEXTS[block.code]
}
