// What a group is made of, for `@pbgo/ui/platform/group-panel` (the group tab of the social panel): the members, who leads, who the visitor is, and what the page may do with a group. No React in this file, so that it is tested as it is.

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
  /** Whether they lead the group: the only one who can remove a member and hand the lead over. */
  leader: boolean
  /** Whether they are the visitor themselves. */
  you: boolean
}

/** The visitor's group: its members (the leader first, then in the order they came) and the most it can hold, which the page gives. A group of one is no group: the page gives none. */
export type Group = { members: readonly GroupMember[]; max: number }

/** Whether the visitor leads the group. */
export const youLead = (group: Group): boolean => group.members.some((member) => member.you && member.leader)

/** Whether the group has all the members it can hold. */
export const isFull = (group: Group): boolean => group.members.length >= group.max

/** The line under the name of a group, how many are in it out of how many it takes: "3 of 8". */
export const sizeLine = (group: Group): string => `${group.members.length} of ${group.max}`

/** The members as the pane draws them: the visitor's group as it is given, the leader first. */
export function orderedMembers(group: Group): GroupMember[] {
  return [...group.members].sort((a, b) => Number(b.leader) - Number(a.leader))
}
