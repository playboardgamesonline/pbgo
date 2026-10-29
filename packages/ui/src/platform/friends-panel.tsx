"use client"

import * as React from "react"
import { Link01Icon, Search01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { activityLine, initials, sectionsOf, type Friend, type FriendStatus } from "../friends"
import { fold } from "../match-options"
import { cn } from "../utils"
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "./avatar"
import { Badge } from "./badge"
import { Button } from "./button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group"

// The friends of a signed-in visitor, as a list for a page or a panel: who is playing and where, who is online, who is not, a search among them, and the way to
// add a friend or to invite one. It is drawn from the friends it is given and decides nothing about them: where they come from (the platform schema, PLT-23)
// and what a press does are the page's. Monochrome like the rest of the platform, so a status is a shape and a brightness (a dot that pulses, a solid dot, a
// hollow one) and always a word too, never a colour alone. The short way to the same friends, on every page of the hub, is the navbar's: `FriendsBar` (the games
// they are in) and `SocialPanel`, which holds this list as its first tab (`FriendsRoster`).

export type { Friend, FriendGame, FriendStatus, FriendTable } from "../friends"

/** The dot on the corner of a picture: it pulses for a friend in a game, is solid for one who is online, and hollow for one who is away. */
function PresenceDot({ status }: { status: FriendStatus }) {
  return (
    <AvatarBadge
      data-status={status}
      className={cn(
        "bg-foreground",
        status === "playing" && "animate-pulse",
        status === "offline" && "border border-muted-foreground bg-background",
      )}
    />
  )
}

function FriendRow({
  friend,
  onInvite,
  onJoin,
  onOpen,
}: {
  friend: Friend
  onInvite?: (friend: Friend) => void
  onJoin?: (friend: Friend) => void
  onOpen?: (friend: Friend) => void
}) {
  const act = friend.status === "playing" ? onJoin : friend.status === "online" ? onInvite : undefined
  const line = activityLine(friend)
  const who = (
    <>
      <Avatar>
        {friend.avatarUrl && <AvatarImage src={friend.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        <AvatarFallback>{initials(friend.nickname)}</AvatarFallback>
        <PresenceDot status={friend.status} />
      </Avatar>
      <div className="min-w-0 flex-1 text-left">
        <p className={cn("truncate text-sm", friend.status !== "offline" && "text-foreground")}>
          {friend.nickname}
          {friend.tag && <span className="text-muted-foreground">#{friend.tag}</span>}
        </p>
        {line && <p className="truncate text-xs text-muted-foreground">{line}</p>}
      </div>
    </>
  )
  return (
    <li
      data-slot="friend"
      data-status={friend.status}
      className={cn(
        "group/friend flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors duration-fast hover:bg-muted/50 focus-within:bg-muted/50",
        friend.status === "offline" && "text-muted-foreground",
      )}
    >
      {onOpen ? (
        <button
          type="button"
          title={`Message ${friend.nickname}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          onClick={() => onOpen(friend)}
        >
          {who}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{who}</div>
      )}
      {act && (
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="shrink-0 opacity-0 group-hover/friend:opacity-100 focus-visible:opacity-100 group-focus-within/friend:opacity-100 [@media(hover:none)]:opacity-100"
          onClick={() => act(friend)}
        >
          {friend.status === "playing" ? "Join" : "Invite"}
        </Button>
      )}
    </li>
  )
}

/**
 * The list of the friends with the search above it: the three sections (in a game, online, offline: an empty one is not drawn, each headed by its word and how
 * many are in it), a row each with the picture and the dot of their presence, their name and what they are doing. It scrolls its list, without a scrollbar, so a
 * parent gives it a height. With no friends it says so. A row is a button when the list can open a conversation (`onOpen`).
 */
function FriendsRoster({
  friends,
  onInvite,
  onJoin,
  onOpen,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  friends: readonly Friend[]
  /** What the button of a friend who is online does. */
  onInvite?: (friend: Friend) => void
  /** What the button of a friend who is in a game does. */
  onJoin?: (friend: Friend) => void
  /** What a press on a friend does: open the conversation with them. */
  onOpen?: (friend: Friend) => void
}) {
  const [query, setQuery] = React.useState("")
  const needle = fold(query).trim()
  const shown = needle === "" ? friends : friends.filter((friend) => fold(`${friend.nickname}#${friend.tag ?? ""}`).includes(needle))

  return (
    <div data-slot="friends-roster" className={cn("flex min-h-0 flex-1 flex-col gap-4", className)} {...props}>
      {friends.length > 0 && (
        <InputGroup>
          <InputGroupAddon>
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
          </InputGroupAddon>
          <InputGroupInput type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search friends" />
        </InputGroup>
      )}

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {friends.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-4 py-10 text-center">
            <p className="text-sm text-foreground">No friends yet</p>
            <p className="text-sm text-muted-foreground">Add friends to see when they are online and to invite them to your table.</p>
          </div>
        ) : shown.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No friend matches.</p>
        ) : (
          sectionsOf(shown).map(({ status, label, friends: section }) => (
            <section key={status} aria-label={label} className="mb-3 last:mb-0">
              <h3 className="px-2.5 pb-1 text-sm text-foreground">
                {label} <span className="text-muted-foreground">{section.length}</span>
              </h3>
              <ul className="flex flex-col">
                {section.map((friend) => (
                  <FriendRow key={friend.id} friend={friend} onInvite={onInvite} onJoin={onJoin} onOpen={onOpen} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  )
}

/**
 * The friends of a visitor, as a panel for a page: a header with the count of those online and the button to add one, the list with its search
 * (`FriendsRoster`), and a button to invite a friend that has no account yet. It fills the height of its parent, so a page gives it a height and a width.
 */
function FriendsPanel({
  friends,
  onAddFriend,
  onInvite,
  onJoin,
  onShareLink,
  shareLabel = "Invite a friend",
  className,
  ...props
}: Omit<React.ComponentProps<"aside">, "children"> & {
  friends: readonly Friend[]
  /** The header's button: add a friend by their nickname. Not drawn without it. */
  onAddFriend?: () => void
  /** What the button of a friend who is online does. */
  onInvite?: (friend: Friend) => void
  /** What the button of a friend who is in a game does. */
  onJoin?: (friend: Friend) => void
  /** What the footer's button does: copy a link that brings a friend here. Not drawn without it. */
  onShareLink?: () => void
  /** What the footer's button says: "Invite a friend", then, for a moment after it was pressed, what it did. */
  shareLabel?: string
}) {
  const online = friends.filter((friend) => friend.status !== "offline").length

  return (
    <aside
      data-slot="friends-panel"
      aria-label="Friends"
      className={cn("flex h-full min-h-0 flex-col gap-4 rounded-3xl border bg-card/60 p-4 shadow-surface backdrop-blur-xl", className)}
      {...props}
    >
      <header className="flex items-center gap-2 px-1">
        <h2 className="font-heading text-lg">Friends</h2>
        {friends.length > 0 && <Badge variant="secondary">{online} online</Badge>}
        {onAddFriend && (
          <Button type="button" size="icon-sm" variant="ghost" className="ml-auto" aria-label="Add a friend" title="Add a friend" onClick={onAddFriend}>
            <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} />
          </Button>
        )}
      </header>

      <FriendsRoster friends={friends} onInvite={onInvite} onJoin={onJoin} />

      {onShareLink && (
        <Button type="button" variant="outline" size="lg" className="w-full" onClick={onShareLink}>
          <HugeiconsIcon icon={Link01Icon} strokeWidth={2} data-icon="inline-start" />
          {shareLabel}
        </Button>
      )}
    </aside>
  )
}

export { FriendsPanel, FriendsRoster, PresenceDot }
