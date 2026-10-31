"use client"

import * as React from "react"
import { ArrowUp01Icon, Edit02Icon, Link01Icon, Search01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { initials, presenceWord, rosterOf, type Friend, type FriendStatus } from "../friends"
import { DURATION, EASE_STANDARD } from "../motion"
import { fold } from "../match-options"
import { cn } from "../utils"
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "./avatar"
import { Badge } from "./badge"
import { Button } from "./button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group"
import { MovingCard, useMovingCard, type MovingCardControl } from "./moving-card"

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

/**
 * How far the card stands from the row. A row is 17px inside its panel (its border, 1px, and its padding, 16px) and the card overlaps the panel a little, as the Riot Client's does: its edge is at
 * the edge of what the panel holds (16px in), so that it covers the border and the padding of the panel and none of its rows.
 */
const CARD_OFFSET = 1

/**
 * What the card of a friend says, which opens to the left of the panel when the pointer rests on their row and moves from one friend to the next (`MovingCard`), as the Riot Client's does:
 * their picture, big, with the dot of their presence, their name and tag, the game they are in, what they are doing there, and the note that is kept on them, where the page keeps one
 * (`onNote`: the button is not drawn without it). It will say more one day, how far the game they are in has got: the card grows to what it holds.
 */
function FriendCard({ friend, gameIcon, onNote }: { friend: Friend; gameIcon?: (slug: string) => string | undefined; onNote?: (friend: Friend) => void }) {
  const line = friend.status === "offline" && friend.activity ? `Offline · ${friend.activity}` : (friend.activity ?? presenceWord(friend))
  return (
    <>
      <Avatar size="xl">
        {friend.avatarUrl && <AvatarImage src={friend.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        <AvatarFallback>{initials(friend.nickname)}</AvatarFallback>
        <PresenceDot status={friend.status} />
      </Avatar>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate text-lg leading-tight font-strong text-foreground">
          {friend.nickname}
          {friend.tag && <span className="text-muted-foreground">#{friend.tag}</span>}
        </p>
        {friend.game && (
          <p className="flex items-center gap-2 text-sm text-foreground">
            <GameIcon name={friend.game.name} src={gameIcon?.(friend.game.slug)} className="size-5" />
            <span className="truncate">{friend.game.name}</span>
          </p>
        )}
        <p className="truncate text-sm text-muted-foreground">{line}</p>
      </div>
      {onNote && (
        <Button type="button" variant="secondary" size="lg" className="w-full justify-start" onClick={() => onNote(friend)}>
          <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} data-icon="inline-start" />
          Add a note
        </Button>
      )}
    </>
  )
}

function FriendRow({
  friend,
  card,
  onInvite,
  onJoin,
  onOpen,
}: {
  friend: Friend
  /** The card of the list, which this row shows its friend in under the pointer. */
  card: MovingCardControl
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
        card.target?.key === friend.id && "bg-muted/50",
      )}
      // A touch has no hover: a press opens the conversation, and the card is for the pointer and the keyboard
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") card.show(friend.id, event.currentTarget)
      }}
      onPointerLeave={card.hide}
      onFocus={(event) => {
        if (event.target.matches(":focus-visible")) card.show(friend.id, event.currentTarget, true)
      }}
      onBlur={card.hide}
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
 * list can open a conversation (`onOpen`). The head of a game is a button that folds its friends away and unfolds them (a chevron, which is there under the pointer, and
 * whenever the game is folded): the games that are folded are the page's to keep (`folded`, `onFoldedChange`) or the list's own while the page says nothing, and a search shows
 * what it finds whether its game is folded or not. Under the pointer a friend has a card, to the left of the list: one card for the whole list, which moves from a friend to the next (`MovingCard`, `FriendCard`).
 */
function FriendsRoster({
  friends,
  gameIcon,
  folded,
  onFoldedChange,
  onInvite,
  onJoin,
  onNote,
  onOpen,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  friends: readonly Friend[]
  /** The picture of a game, from its slug; the initial of its name is drawn where there is none or it does not load. */
  gameIcon?: (slug: string) => string | undefined
  /** The groups that are folded, by their key (`game:<slug>`). Without it the list keeps them itself, for as long as it is shown. */
  folded?: ReadonlySet<string>
  /** What the head of a game does with the groups that are folded once one is pressed. */
  onFoldedChange?: (folded: ReadonlySet<string>) => void
  /** What the button of a friend who is online does. */
  onInvite?: (friend: Friend) => void
  /** What the button of a friend who is in a game does. */
  onJoin?: (friend: Friend) => void
  /** What the button of the note on a friend, in their card, does. Not drawn without it. */
  onNote?: (friend: Friend) => void
  /** What a press on a friend does: open the conversation with them. */
  onOpen?: (friend: Friend) => void
}) {
  const [query, setQuery] = React.useState("")
  const needle = fold(query).trim()
  // One card for the whole list: it moves from a friend to the next, and says what is about the one under the pointer
  const list = React.useRef<HTMLDivElement>(null)
  const card = useMovingCard((node) => list.current?.contains(node) ?? false)
  const onCard = friends.find((friend) => friend.id === card.target?.key)
  const lastOnCard = React.useRef<Friend | null>(null)
  if (onCard) lastOnCard.current = onCard
  const cardFriend = onCard ?? lastOnCard.current
  const [own, setOwn] = React.useState<ReadonlySet<string>>(() => new Set())
  const folds = folded ?? own
  const fadeOut = useReducedMotion() ? { duration: 0 } : { duration: DURATION.base, ease: EASE_STANDARD }
  const id = React.useId()
  const toggle = (key: string) => {
    const next = new Set(folds)
    if (!next.delete(key)) next.add(key)
    ;(onFoldedChange ?? setOwn)(next)
  }
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

      <div ref={list} className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            // A search shows what it finds, in a game that is folded too
            const open = needle !== "" || !folds.has(group.key)
            const list = (
              <ul className="flex flex-col">
                {group.friends.map((friend) => (
                  <FriendRow key={friend.id} friend={friend} card={card} onInvite={onInvite} onJoin={onJoin} onOpen={onOpen} />
                ))}
              </ul>
            )
            return (
              <section key={group.key} aria-label={name} className="mb-3 last:mb-0">
                {group.kind === "game" ? (
                  <>
                    <h3 className="text-sm">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`${id}-${group.key}`}
                        onClick={() => toggle(group.key)}
                        className="group/head flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-muted-foreground outline-none transition-colors duration-fast hover:bg-muted/50 hover:text-foreground focus-visible:bg-muted/50 focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
                      >
                        <GameIcon name={group.game.name} src={gameIcon?.(group.game.slug)} className="size-5" />
                        <span className="truncate">{name}</span>
                        <span className="text-muted-foreground/60 tabular-nums">{group.friends.length}</span>
                        <HugeiconsIcon
                          icon={ArrowUp01Icon}
                          strokeWidth={2}
                          aria-hidden="true"
                          className={cn(
                            "ml-auto size-4 shrink-0 transition-[opacity,rotate] duration-base ease-standard",
                            open ? "opacity-0 group-hover/head:opacity-100 group-focus-visible/head:opacity-100" : "rotate-180 opacity-100",
                          )}
                        />
                      </button>
                    </h3>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          key="friends"
                          id={`${id}-${group.key}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={fadeOut}
                          className="overflow-hidden"
                        >
                          {list}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  <>
                    <h3 className="flex items-center gap-2 px-2.5 pb-1 text-sm text-muted-foreground">
                      <span className="truncate">{name}</span>
                      <span className="text-muted-foreground/60 tabular-nums">{group.friends.length}</span>
                    </h3>
                    {list}
                  </>
                )}
              </section>
            )
          })
        )}
      </div>
      {cardFriend && (
        <MovingCard
          card={card}
          contentKey={cardFriend.id}
          width={288}
          placement={{ side: "left", align: "start", offset: CARD_OFFSET, alignOffset: -8 }}
          label={cardFriend.nickname}
          contentClassName="flex flex-col gap-4 p-6"
        >
          <FriendCard friend={cardFriend} gameIcon={gameIcon} onNote={onNote} />
        </MovingCard>
      )}
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
      className={cn("flex h-full min-h-0 flex-col gap-4 rounded-4xl border glass p-4 shadow-surface", className)}
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
