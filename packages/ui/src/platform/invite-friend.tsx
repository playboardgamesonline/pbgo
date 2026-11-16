"use client"

import * as React from "react"
import { Link01Icon, Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { initials, statusLine, suggestionsOf, type Friend } from "../friends"
import { cn } from "../utils"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog"
import { PresenceDot } from "./friends-panel"
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group"
import { Spinner } from "./spinner"

// The window that picks the friend a visitor invites, to their table (PLT-109: opened by "Invite a friend" in the menu of a free seat) or to their group (PLT-23: opened by the button of the group tab of the social panel). A search field, then the friends, the connected ones first as suggestions (the ones who are free, then the ones who
// are playing, with what each is doing: the game they are in), then the others, who are away: they are listed too, and the invitation waits for them. A press on a row sends the invitation and nothing else: the row says "Sending…", then "Invited" with a tick,
// and stays in the list, so that the visitor can invite more than one friend to a table with several seats or to a group; the window is left by its close button or Escape. The window says what it is for in its title and under it (`title`, `description`). It decides nothing: `onInvite` does the sending and answers `false` (or a promise of it) when the
// invitation was refused, which puts the row back. A row that has been sent is not sent twice while it says "Invited".

type InviteFriendListProps = {
  friends: readonly Friend[]
  /** What a press on a friend does: send the invitation. Answers `false` (or a promise of it) for one that was refused. */
  onInvite: (friend: Friend) => void | boolean | Promise<boolean | void>
  /** The friends who were invited already (by id), shown as "Invited". */
  invited?: ReadonlySet<string>
  /** At most this many friends are listed, the connected ones first, and a line says how many the search will find: for a list in a small panel. None: all of them. */
  limit?: number
  /** The words of the button of a row and of its done state: "Invite" and "Invited" unless the page says more ("Add" and "Added", for a table that does not exist yet). */
  labels?: { action: string; done: string }
  className?: string
}

type RowState = "sending" | "sent"

const INVITE_LABELS = { action: "Invite", done: "Invited" }

function InviteRow({ friend, state, labels, onPress }: { friend: Friend; state?: RowState; labels: { action: string; done: string }; onPress: () => void }) {
  const line = statusLine(friend)
  return (
    <li data-slot="invite-friend" data-status={friend.status} data-state={state}>
      <button
        type="button"
        disabled={state !== undefined}
        aria-label={state === "sent" ? `${friend.nickname} is ${labels.done.toLowerCase()}` : `${labels.action} ${friend.nickname}`}
        onClick={onPress}
        className="group/invite flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <Avatar>
          {friend.avatarUrl && <AvatarImage src={friend.avatarUrl} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback>{initials(friend.nickname)}</AvatarFallback>
          <PresenceDot status={friend.status} />
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="ph-mask block truncate text-sm text-foreground">
            {friend.nickname}
            {friend.tag && <span className="text-muted-foreground">#{friend.tag}</span>}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{line}</span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-lg px-3 py-1 text-xs",
            state === undefined ? "bg-secondary text-secondary-foreground group-hover/invite:bg-foreground group-hover/invite:text-background" : "text-muted-foreground",
          )}
        >
          {state === "sending" && <Spinner className="size-3" />}
          {state === "sent" && <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-3.5" />}
          {state === "sending" ? "Sending…" : state === "sent" ? labels.done : labels.action}
        </span>
      </button>
    </li>
  )
}

/** What the picker lists, with its search: it is the content of the window, and is drawn on its own by the design docs. */
function InviteFriendList({ friends, onInvite, invited, limit, labels = INVITE_LABELS, className }: InviteFriendListProps) {
  const [query, setQuery] = React.useState("")
  const [rows, setRows] = React.useState<Record<string, RowState>>({})
  const found = suggestionsOf(friends, query)
  // With a limit the connected friends come first and the away ones fill what is left; the search finds the rest
  const room = limit === undefined ? Infinity : Math.max(0, limit)
  const online = found.online.slice(0, room)
  const offline = found.offline.slice(0, Math.max(0, room - online.length))
  const hidden = found.online.length + found.offline.length - online.length - offline.length
  const stateOf = (friend: Friend): RowState | undefined => rows[friend.id] ?? (invited?.has(friend.id) ? "sent" : undefined)

  const press = async (friend: Friend) => {
    if (stateOf(friend)) return
    setRows((all) => ({ ...all, [friend.id]: "sending" }))
    const done = await Promise.resolve(onInvite(friend)).catch(() => false)
    setRows((all) => {
      const { [friend.id]: _, ...rest } = all
      return done === false ? rest : { ...rest, [friend.id]: "sent" }
    })
  }

  const section = (label: string, list: readonly Friend[]) =>
    list.length > 0 && (
      <section aria-label={label} className="flex flex-col gap-1">
        <h3 className="px-2 text-xs text-muted-foreground">{label}</h3>
        <ul className="flex flex-col">
          {list.map((friend) => (
            <InviteRow key={friend.id} friend={friend} state={stateOf(friend)} labels={labels} onPress={() => void press(friend)} />
          ))}
        </ul>
      </section>
    )

  return (
    <div data-slot="invite-friend-list" className={cn("flex min-h-0 flex-col gap-4", className)}>
      <InputGroup>
        <InputGroupAddon>
          <HugeiconsIcon icon={Search01Icon} strokeWidth={2} aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput type="search" aria-label="Search your friends" placeholder="Search your friends" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />
      </InputGroup>
      <div className="flex max-h-80 min-h-0 flex-col gap-4 overflow-y-auto">
        {section("Online", online)}
        {section("Offline", offline)}
        {hidden > 0 && (
          <p data-slot="invite-friend-more" className="px-2 text-center text-xs text-muted-foreground">
            Search to see {hidden} more.
          </p>
        )}
        {online.length + offline.length === 0 && (
          <p data-slot="invite-friend-empty" className="px-2 py-6 text-center text-sm text-muted-foreground">
            {friends.length === 0 ? "You have no friends yet. Add one from the friends tab of the panel." : "No friend matches this search."}
          </p>
        )}
      </div>
    </div>
  )
}

type InviteFriendHeaderProps = {
  /** What the window is called: "Invite a friend" unless it says more (the group it is for, for instance). */
  title?: string
  /** What the window says under its title; the table it is for, for instance. */
  description?: React.ReactNode
}

/** The head of the window: its title and what it says under it. It needs the context of a dialog, which gives the title its name for a screen reader. */
function InviteFriendHeader({ title = "Invite a friend", description = "Friends who are online come first. One press sends the invitation." }: InviteFriendHeaderProps) {
  return (
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
  )
}

type InviteFriendDialogProps = InviteFriendListProps &
  InviteFriendHeaderProps & {
    open: boolean
    onOpenChange: (open: boolean) => void
  }

/** The window of "Invite a friend": the picker in a dialog. The list is drawn anew each time it opens, so that the search and the rows start clean. */
function InviteFriendDialog({ open, onOpenChange, title, description, ...list }: InviteFriendDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} data-slot="invite-friend-dialog">
        <InviteFriendHeader title={title} description={description} />
        <InviteFriendList {...list} />
      </DialogContent>
    </Dialog>
  )
}

type FriendPickerProps = InviteFriendListProps & {
  /** The way to bring somebody who is not a friend yet: a "Copy link" row under the list, which says so for a moment once it is copied. None: no row. */
  link?: { onCopy: () => void; copied?: boolean }
}

/**
 * The picker as a panel, for the free place of a row of players (`PlayerSlots`): the friends right away, with no menu in front of them (the connected ones first, the others after, a limit and a search) and, under them, "Copy link". It is the content of a `Popover`, which
 * brings the friend list to the press on a place instead of a menu that leads to a window.
 */
function FriendPicker({ link, className, ...list }: FriendPickerProps) {
  return (
    <div data-slot="friend-picker" className={cn("flex min-h-0 flex-col gap-3", className)}>
      <InviteFriendList {...list} />
      {link && (
        <button
          type="button"
          onClick={link.onCopy}
          className="flex items-center gap-3 rounded-xl border-t px-2 py-2.5 text-left text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <HugeiconsIcon icon={link.copied ? Tick02Icon : Link01Icon} strokeWidth={2} aria-hidden="true" className="size-4 text-muted-foreground" />
          {link.copied ? "Link copied" : "Copy link"}
        </button>
      )}
    </div>
  )
}

export { FriendPicker, InviteFriendDialog, InviteFriendHeader, InviteFriendList }
export type { FriendPickerProps, InviteFriendDialogProps, InviteFriendHeaderProps, InviteFriendListProps }
