"use client"

import { FriendsPanel, type Friend } from "@pbgo/ui/platform/friends-panel"
import { useCopied } from "@/lib/use-copied"

/**
 * The friends of the visitor listed in full, on the page of their friends: the panel, with its search and its sections, and the same button as the bar's that
 * copies the address of the sign-in. What a friend's buttons do needs the friends to exist (PLT-23): only the demo account of development (`preview`) has some,
 * and they do nothing. It fills the height of its parent.
 */
export function FriendsList({ friends, preview, className }: { friends: readonly Friend[]; preview: boolean; className?: string }) {
  const [copied, copy] = useCopied()
  const nothing = () => {}
  return (
    <FriendsPanel
      friends={friends}
      className={className}
      onShareLink={copy}
      shareLabel={copied ? "Link copied" : "Invite a friend"}
      onInvite={preview ? nothing : undefined}
      onJoin={preview ? nothing : undefined}
    />
  )
}
