"use client"

import { FriendsPanel, type Friend, type FriendMenuHandlers } from "@pbgo/ui/platform/friends-panel"
import { useCopied } from "@/lib/use-copied"

/**
 * The friends of the visitor listed in full, on the page of their friends: the panel, with its search and its sections, and the same button as the bar's that copies the address of the sign-in. What a friend's menu does is the page's (`onViewProfile`, `onRemove`, `onBlock`), and so is what
 * the Invite and Join buttons of a row do about the visitor's group (`onInvite`, `onJoin`, PLT-23): a button whose handler is missing is not drawn. It fills the height of its parent.
 */
export function FriendsList({ friends, className, onInvite, onJoin, ...menu }: { friends: readonly Friend[]; className?: string; onInvite?: (friend: Friend) => void; onJoin?: (friend: Friend) => void } & FriendMenuHandlers) {
  const [copied, copy] = useCopied()
  return <FriendsPanel friends={friends} className={className} onShareLink={copy} shareLabel={copied ? "Link copied" : "Invite a friend"} onInvite={onInvite} onJoin={onJoin} {...menu} />
}
