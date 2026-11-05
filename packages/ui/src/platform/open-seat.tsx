"use client"

import * as React from "react"
import { Link01Icon, PlusSignIcon, Tick02Icon, UserAdd01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { Avatar, AvatarFallback } from "./avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu"

// A seat that nobody has taken, as a dashed circle with a plus in it, and the plus does something. For a visitor who is not at the table it joins it (`join`: a link to the table's page, or a button that sits the visitor down itself, for a page that opens, joins and
// starts tables: `onJoin`). For one who is at it it opens a small menu to bring someone (`invite`): "Invite a friend", which a page that has friends gives a way to do (`onInvite`: it is disabled without), and "Copy link", which copies the table's address and says so for a
// moment before the menu closes. With neither it is the dashed place alone, which only says that there is room. A table has several of these and they all do the same, so only one of them is a stop for the keyboard (`tabbable`).

type OpenSeatProps = {
  /** Joining: where the plus leads (`href`), or what it does (`onJoin`, which wins: a button that sits the visitor down without leaving the page). */
  join?: { href?: string; onJoin?: () => void }
  /** Inviting, for a visitor who is at the table: the address that "Copy link" copies (a path of this site or a whole address), and what "Invite a friend" does. */
  invite?: { link: string; onInvite?: () => void }
  /** Whether this seat is a stop for the keyboard: one of the free seats of a table is, the others are not. */
  tabbable?: boolean
  /** The size of the circle (`size-10`): a person's picture is `size-8` unless it is given another. */
  className?: string
}

/** The circle: dashed, and a little more there under the pointer of what holds it (`group/seat`). The plus in it is a third of it, and never smaller than it is in the circles of a list (`size-3.5`). */
function Place({ className }: { className?: string }) {
  return (
    <Avatar className={cn("after:hidden", className)}>
      <AvatarFallback className="border border-dashed border-border bg-transparent text-muted-foreground transition-colors duration-fast group-hover/seat:border-foreground/50 group-hover/seat:text-foreground">
        <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-1/3 min-h-3.5 min-w-3.5" aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  )
}

const FOCUS = "group/seat block rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"

function OpenSeat({ join, invite, tabbable = true, className }: OpenSeatProps) {
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  // The menu stays open a moment after the link is copied, to say so, and then closes
  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => {
      setOpen(false)
      setCopied(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [copied])

  if (join?.onJoin) {
    return (
      <button type="button" onClick={join.onJoin} aria-label="Join this table" tabIndex={tabbable ? undefined : -1} className={cn(FOCUS, "cursor-pointer")}>
        <Place className={className} />
      </button>
    )
  }

  if (join?.href) {
    return (
      <a href={join.href} aria-label="Join this table" tabIndex={tabbable ? undefined : -1} className={FOCUS}>
        <Place className={className} />
      </a>
    )
  }

  if (invite) {
    const copy = () => {
      navigator.clipboard?.writeText(new URL(invite.link, window.location.origin).href).then(
        () => setCopied(true),
        () => setOpen(false)
      )
    }
    return (
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setCopied(false)
        }}
      >
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Invite to this table" tabIndex={tabbable ? undefined : -1} className={cn(FOCUS, "cursor-pointer")}>
            <Place className={className} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto">
          <DropdownMenuItem disabled={!invite.onInvite} onSelect={() => invite.onInvite?.()}>
            <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} aria-hidden="true" />
            Invite a friend
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              copy()
            }}
          >
            <HugeiconsIcon icon={copied ? Tick02Icon : Link01Icon} strokeWidth={2} aria-hidden="true" />
            {copied ? "Link copied" : "Copy link"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return <Place className={className} />
}

export { OpenSeat }
export type { OpenSeatProps }
