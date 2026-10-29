"use client"

import * as React from "react"
import { Link01Icon, Search01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { initials, rosterOf, type Friend, type FriendStatus } from "../friends"
import { fold } from "../match-options"
import { cn } from "../utils"
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "./avatar"
import { Badge } from "./badge"
import { Button } from "./button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group"

// The friends of a signed-in visitor, as a list for a page or a panel: game by game (the picture of the game, its name and how many friends are in it, those who wait in its
// lobby and those who play it in one list), then those who are in no game by status, a search among them, and the way to add a friend or to invite one. It is drawn from the friends it is given and decides nothing about them: where they come from (the platform schema, PLT-23)
// and what a press does are the page's. A status is a shape, a colour and a word, never the colour alone: a green disc (active), a blue disc with a play knocked out of
// it (playing), an orange-yellow moon (inactive), a red disc with a bar knocked out of it (do not disturb), a thick grey ring (offline). Only the dot is coloured
// (`--presence-online`, `--presence-playing`, `--presence-inactive`, `--presence-dnd`, the hues of the platform besides destructive): the line under the name is quiet text. The short way to the same friends, on every page of the hub, is the navbar's: `FriendsBar` (the games
// they are in) and `SocialPanel`, which holds this list as its first tab (`FriendsRoster`).

export type { Friend, FriendGame, FriendStatus, FriendTable } from "../friends"

/**
 * The shapes of the dots that are not a plain disc: a disc with a play knocked out of it and another with a bar knocked out of it (even-odd, so that what is
 * under the dot shows through: its own `bg-background`, never the picture, which the dot only half covers), and a moon, the disc of the dot with a bite taken
 * out of its upper left, thick, with its horns up and to the left, the way Discord draws its idle moon.
 */
const PLAY_DISC = "M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24ZM8.6 5.6v12.8L18.8 12 8.6 5.6Z"
const DND_DISC = "M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24ZM5.2 9.6H18.8A1.4 1.4 0 0 1 20.2 11V13A1.4 1.4 0 0 1 18.8 14.4H5.2A1.4 1.4 0 0 1 3.8 13V11A1.4 1.4 0 0 1 5.2 9.6Z"
const MOON = "M12.542 1.013A11 11 0 1 1 1.013 12.542 8.2 8.2 0 1 0 12.542 1.013Z"

/**
 * The dot on the corner of a picture, five shapes so that a colour is never alone: a green disc for a friend who is online (active), a blue disc with a play knocked
 * out of it for one in a game, an orange-yellow moon for one who is inactive, a red disc with a bar knocked out of it for one who does not want to be disturbed, and
 * a thick grey ring for one who is away. Its size follows the picture's and is small (8px on a small picture, 10px on a medium one, 12px on a large one, 16px on an extra large one): it stands in the bottom
 * right corner of the picture, so a smaller dot recedes towards that corner, and a ring of the colour of the page, 3px (2px on a small picture), cuts it out of the picture. The outline
 * of the offline ring is a quarter of the dot (2px of 8, 3px of 10 and of 12), like Discord's invisible, and not a hairline.
 */
function PresenceDot({ status }: { status: FriendStatus }) {
  return (
    <AvatarBadge
      data-status={status}
      className={cn(
        "p-0 ring-3 group-data-[size=sm]/avatar:ring-2 group-data-[size=xl]/avatar:ring-4",
        status === "online" && "bg-presence-online",
        status === "playing" && "bg-(color:--cutout) text-presence-playing",
        status === "inactive" && "bg-(color:--cutout) text-presence-inactive",
        status === "dnd" && "bg-(color:--cutout) text-presence-dnd",
        status === "offline" && "border-3 border-muted-foreground bg-(color:--cutout) group-data-[size=sm]/avatar:border-2 group-data-[size=xl]/avatar:border-4",
      )}
    >
      {status === "playing" && (
        <span aria-hidden="true" className="block size-full">
          <svg viewBox="0 0 24 24" className="size-full" fill="currentColor" fillRule="evenodd">
            <path d={PLAY_DISC} />
          </svg>
        </span>
      )}
      {status === "inactive" && (
        <span aria-hidden="true" className="block size-full">
          <svg viewBox="0 0 24 24" className="size-full" fill="currentColor">
            <path d={MOON} />
          </svg>
        </span>
      )}
      {status === "dnd" && (
        <span aria-hidden="true" className="block size-full">
          <svg viewBox="0 0 24 24" className="size-full" fill="currentColor" fillRule="evenodd">
            <path d={DND_DISC} />
          </svg>
        </span>
      )}
    </AvatarBadge>
  )
}

/** The picture of a game, or the initial of its name on a tile. Rounded like the rest (`rounded-md` at this size) and never a circle: only the picture of a person is round. */
function GameIcon({ name, src, className }: { name: string; src?: string; className?: string }) {
  return (
    <Avatar className={cn("size-6 rounded-md after:hidden", className)}>
      {src && <AvatarImage src={src} alt="" className="rounded-md" />}
      <AvatarFallback className="rounded-md text-xs">{initials(name).slice(0, 1)}</AvatarFallback>
    </Avatar>
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
  // A friend who plays can be joined, so can one who waits at a table that has room; one who is online anywhere else can be invited
  const joinable = friend.status === "playing" || (friend.status === "online" && friend.table !== undefined && friend.table.size < friend.table.max)
  const act = joinable ? onJoin : friend.status === "online" ? onInvite : undefined
  // The game is said by the group the friend is in, so the line says only what they are doing
  const line = friend.activity
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
          {joinable ? "Join" : "Invite"}
        </Button>
      )}
    </li>
  )
}

/**
 * The list of the friends with the search above it, game by game (`rosterOf`): each game that some friends are in is headed by its picture, its name and how many
 * are in it, with all of them under it, those who wait in its lobby and those who play it, and then the friends who are in no game come by status (online,
 * inactive, do not disturb, away; an empty group is not drawn), each headed by its word and its count. A row has the picture and the dot of the friend's presence,
 * their name and what they are doing. It scrolls its list, without a scrollbar, so a parent gives it a height. With no friends it says so. A row is a button when the
 * list can open a conversation (`onOpen`).
 */
function FriendsRoster({
  friends,
  gameIcon,
  onInvite,
  onJoin,
  onOpen,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  friends: readonly Friend[]
  /** The picture of a game, from its slug; the initial of its name is drawn where there is none or it does not load. */
  gameIcon?: (slug: string) => string | undefined
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
          rosterOf(shown).map((group) => {
            const name = group.kind === "game" ? group.game.name : group.label
            return (
              <section key={group.key} aria-label={name} data-game={group.kind === "game" ? group.game.slug : undefined} className="mb-3 scroll-mt-1 last:mb-0">
                <h3 className="flex items-center gap-2 px-2.5 pb-1 text-sm text-foreground">
                  {group.kind === "game" && <GameIcon name={group.game.name} src={gameIcon?.(group.game.slug)} className="size-5" />}
                  <span className="truncate">{name}</span>
                  <span className="text-muted-foreground tabular-nums">{group.friends.length}</span>
                </h3>
                <ul className="flex flex-col">
                  {group.friends.map((friend) => (
                    <FriendRow key={friend.id} friend={friend} onInvite={onInvite} onJoin={onJoin} onOpen={onOpen} />
                  ))}
                </ul>
              </section>
            )
          })
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
  gameIcon,
  onAddFriend,
  onInvite,
  onJoin,
  onShareLink,
  shareLabel = "Invite a friend",
  className,
  ...props
}: Omit<React.ComponentProps<"aside">, "children"> & {
  friends: readonly Friend[]
  /** The picture of a game, from its slug, for the heads of the list. */
  gameIcon?: (slug: string) => string | undefined
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
      className={cn("flex h-full min-h-0 flex-col gap-4 rounded-4xl border glass p-4 shadow-surface backdrop-blur-xl", className)}
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

      <FriendsRoster friends={friends} gameIcon={gameIcon} onInvite={onInvite} onJoin={onJoin} />

      {onShareLink && (
        <Button type="button" variant="outline" size="lg" className="w-full" onClick={onShareLink}>
          <HugeiconsIcon icon={Link01Icon} strokeWidth={2} data-icon="inline-start" />
          {shareLabel}
        </Button>
      )}
    </aside>
  )
}

export { FriendsPanel, FriendsRoster, GameIcon, PresenceDot }
