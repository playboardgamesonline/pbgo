// What a group is made of, for the play zone of the signed-in home (its row of places, `@pbgo/ui/platform/player-slots`, and the menus of its members): the members, who leads, who the visitor is. No React in this file, so that it is tested as it is.

import type { FriendGame, FriendStatus } from "./friends"

/** A member of the visitor's group, drawn like a friend (their picture and the dot of their presence, their name and what they are doing), with who leads and who the visitor is. A member need not be the visitor's friend. */
export type GroupMember = {
  id: string
  nickname: string
  /** The digits that tell two players of one name apart, written after a `#` (PLT-39). */
  tag?: string
  /** Their picture; the initials of their name when there is none. */
  avatarUrl?: string | null
  status: FriendStatus
  /** The game they are in or wait in the lobby of, when they are online and at one. */
  game?: FriendGame
  /** What the line under the name says: how long a member who is playing has been, "In the lobby". */
  activity?: string
  /** Whether they lead the group: the only one who can remove a member and hand the lead over, and who looks for a game or opens a table for it. */
  leader: boolean
  /** Whether they are the visitor themselves. */
  you: boolean
}

/** The visitor's group: its members (the leader first, then in the order they came) and the most it can hold, which the page gives. A group of one is no group: the page gives none. */
export type Group = { members: readonly GroupMember[]; max: number }

/** Whether the visitor leads the group. */
export const youLead = (group: Group): boolean => group.members.some((member) => member.you && member.leader)

/** The members as the row of places draws them: the visitor's group as it is given, the leader first. */
export function orderedMembers(group: Group): GroupMember[] {
  return [...group.members].sort((a, b) => Number(b.leader) - Number(a.leader))
}
