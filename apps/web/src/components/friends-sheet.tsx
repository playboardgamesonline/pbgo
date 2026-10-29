"use client"

import { useEffect, useState } from "react"
import { UserMultiple02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@pbgo/ui/platform/button"
import { FriendsPanel, type Friend } from "@pbgo/ui/platform/friends-panel"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@pbgo/ui/platform/sheet"
import { cn } from "@pbgo/ui/utils"

// The friends of a signed-in visitor on the pages of their account: the panel at the side of a desktop (`FriendsSidebar`) and the same panel in a sheet on
// a screen that has no room for it (`FriendsSheet`). What a friend's buttons do needs the friends to exist (PLT-23): until then a real account has no
// friends, hence no such buttons, and only the demo account of development (`preview`) shows them, which do nothing, to see the panel as it will be.
// The one thing that works is the footer's button: it copies the address of the hub, which a friend can sign in on.

function useCopied(): [boolean, () => void] {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  return [
    copied,
    () => {
      navigator.clipboard?.writeText(`${window.location.origin}/login`).then(() => setCopied(true), () => {})
    },
  ]
}

/** The panel, with its buttons. Fills the height of its parent. */
export function FriendsSidebar({ friends, preview, className }: { friends: readonly Friend[]; preview: boolean; className?: string }) {
  const [copied, copy] = useCopied()
  const nothing = () => {}
  return (
    <FriendsPanel
      friends={friends}
      className={className}
      onShareLink={copy}
      shareLabel={copied ? "Link copied" : "Invite a friend"}
      onAddFriend={preview ? nothing : undefined}
      onInvite={preview ? nothing : undefined}
      onJoin={preview ? nothing : undefined}
    />
  )
}

/** A button that opens the friends in a sheet from the right: the panel is the same, so a phone has everything a desktop has, one press away. */
export function FriendsSheet({ friends, preview, className }: { friends: readonly Friend[]; preview: boolean; className?: string }) {
  const online = friends.filter((friend) => friend.status !== "offline").length
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="lg" className={cn("shrink-0", className)}>
          <HugeiconsIcon icon={UserMultiple02Icon} strokeWidth={2} data-icon="inline-start" />
          Friends
          {online > 0 && <span className="text-muted-foreground">{online} online</span>}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm p-3">
        <SheetHeader className="sr-only">
          <SheetTitle>Friends</SheetTitle>
          <SheetDescription>Your friends, and what they are doing.</SheetDescription>
        </SheetHeader>
        <FriendsSidebar friends={friends} preview={preview} className="border-0 bg-transparent p-1 shadow-none backdrop-blur-none [&>header]:pr-11" />
      </SheetContent>
    </Sheet>
  )
}
