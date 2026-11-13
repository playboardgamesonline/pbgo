"use client"

import * as React from "react"
import { Tick02Icon, UserAdd01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { connectedOf, gamesOf, initials, presenceWord, statusLine, tablesOf, type Friend, type GameFriends } from "../friends"
import { cn } from "../utils"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Button } from "./button"
import { GameIcon, PresenceDot } from "./friends-panel"
import { MovingCard, useMovingCard } from "./moving-card"

// The friends of a signed-in visitor as the Riot Client shows its social visibility: a small bar on the navbar, in the container of the account and of the social panel (`SocialDock`, which is its own container: the bar draws none), with a pill for each game
// that some of them are in (the game's picture and how many of them are in it), and, under the pointer, a panel under the bar with those friends in two lists,
// "Online" (waiting in the game's lobby, the ones who share a table together under it: "Table K7Q · 2/4") and "Playing", each with the picture, the dot of their
// presence, their name and what they are doing. The pill under the pointer takes the fill of the navbar's current item and a line under it; moving to another
// pill changes the panel. A friend who is away, or on the hub and in no game, is in none: they are in the list of the page of the friends (`FriendsPanel`).
// The friends who are connected come first, themselves: each is a small picture with the dot of its presence (`MAX_FRIENDS` at the most, fewer on a narrow screen, then "+N" for the others, which opens the panel), and under the pointer a card says who they are and what they are doing; a press on one
// does what the page decides (`onOpenFriend`: the conversation, or the panel). With no friend connected and none in a game the bar is the button that invites one. The bar draws no container: it is the top of the dock (`SocialDock`), which holds it with the account's picture and the button
// of the social panel, so that the games, the profile and the panel are one container. While the dock is open the bar is folded away, the profile taking its place. A status is the dot on the picture (a blue disc with a play knocked out for a friend who is playing, a green
// disc online, an orange-yellow moon inactive, a red disc with a bar do not disturb, a thick grey ring offline) and, under the name, a line of quiet text (only the dot is coloured), and always a word too, never the colour alone.
//
// The panel is one card for all the pills (`MovingCard`), centred under the pill that is under the pointer and narrow (15rem): it moves from a game to the next, and what it says changes. It opens under the pointer (a short delay on the way out lets the pointer cross the gap to the panel), with the
// keyboard (a pill that has the focus) and, where there is no pointer, when a pill is pressed (pressed again, or a press away, it closes). It is drawn from the
// friends it is given and decides nothing about them. A narrow screen has room for fewer pills, the most crowded games first.

/** The games the bar draws, the most crowded first. */
const MAX_GAMES = 3

/** The friends the bar draws as themselves, the first ones of `connectedOf`; on a screen under 400px wide there is room for one less. */
const MAX_FRIENDS = 3
const NARROW = "(max-width: 399px)"
const subscribeToNarrow = (notify: () => void) => {
  const query = window.matchMedia(NARROW)
  query.addEventListener("change", notify)
  return () => query.removeEventListener("change", notify)
}
const isNarrow = () => window.matchMedia(NARROW).matches
const notNarrow = () => false

/** Where each pill starts to have room: the first always, the next ones from wider screens. */
const SHOWN_FROM = ["", "max-[359px]:hidden", "max-[399px]:hidden"] as const

type FriendsBarProps = Omit<React.ComponentProps<"div">, "children"> & {
  friends: readonly Friend[]
  /** The picture of a game, from its slug; the initial of its name is drawn where there is none or it does not load. */
  gameIcon?: (slug: string) => string | undefined
  /** What the button of a friend who waits at a table that has room does: join them. Not drawn without it. */
  onJoin?: (friend: Friend) => void
  /** What a press on a connected friend does: open the conversation with them, or the panel. The card under the pointer is all there is without it (a touch screen opens it with a press). */
  onOpenFriend?: (friend: Friend) => void
  /** What the "+N" of the friends who do not fit does: open the panel. Not drawn without it. */
  onMoreFriends?: () => void
  /** What the button of a bar with no pill does: copy a link that brings a friend here. The bar has no button without it. */
  onShareLink?: () => void
  /** What that button says: "Invite a friend", then, for a moment after it was pressed, what it did. */
  shareLabel?: string
  /** Whether the link was just copied: the button shows a tick. */
  shared?: boolean
}

/** A friend of a game: the picture and the dot of their presence, their name, and what they are doing. A friend at a table with room can be joined. */
function BarFriend({ friend, onJoin }: { friend: Friend; onJoin?: (friend: Friend) => void }) {
  const joinable = friend.status === "online" && friend.table !== undefined && friend.table.size < friend.table.max
  return (
    <li data-slot="friend" data-status={friend.status} className="group/friend flex items-center gap-3">
      <Avatar>
        {friend.avatarUrl && <AvatarImage src={friend.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        <AvatarFallback>{initials(friend.nickname)}</AvatarFallback>
        <PresenceDot status={friend.status} />
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="ph-mask truncate text-sm text-foreground">
          {friend.nickname}
          {friend.tag && <span className="text-muted-foreground">#{friend.tag}</span>}
        </p>
        {friend.activity && <p className="truncate text-xs text-muted-foreground">{friend.activity}</p>}
      </div>
      {joinable && onJoin && (
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="shrink-0 opacity-0 group-hover/friend:opacity-100 focus-visible:opacity-100 group-focus-within/friend:opacity-100 [@media(hover:none)]:opacity-100"
          onClick={() => onJoin(friend)}
        >
          Join
        </Button>
      )}
    </li>
  )
}

/** What the card of a connected friend says: who they are and what they are doing, in the style of a friend of a game's list. */
function FriendCard({ friend, onJoin }: { friend: Friend; onJoin?: (friend: Friend) => void }) {
  return (
    <ul>
      <BarFriend friend={{ ...friend, activity: statusLine(friend) }} onJoin={onJoin} />
    </ul>
  )
}

/**
 * What the panel of a game says: "Online", the friends who wait in its lobby, those at one table together under it ("Table K7Q · 2/4") and the others after,
 * then "Playing". A list with nobody in it is not drawn. It is the content of the panel, shown on its own by the design docs.
 */
function FriendsBarList({ entry, onJoin }: { entry: GameFriends; onJoin?: (friend: Friend) => void }) {
  return (
    <>
      {entry.online.length > 0 && (
        <section aria-label="Online" className="flex flex-col gap-3">
          <h3 className="font-heading text-base">Online</h3>
          {tablesOf(entry.online).map(({ table, friends }) => (
            <div key={table?.code ?? "alone"} className="flex flex-col gap-3">
              {table && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <HugeiconsIcon icon={UserMultipleIcon} strokeWidth={2} className="size-4" />
                  Table {table.code} · {table.size}/{table.max}
                </p>
              )}
              <ul className="flex flex-col gap-3">
                {friends.map((friend) => (
                  <BarFriend key={friend.id} friend={friend} onJoin={onJoin} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      {entry.playing.length > 0 && (
        <section aria-label="Playing" className="flex flex-col gap-3">
          <h3 className="font-heading text-base">Playing</h3>
          <ul className="flex flex-col gap-3">
            {entry.playing.map((friend) => (
              <BarFriend key={friend.id} friend={friend} onJoin={onJoin} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/** The look of a pill, the navbar's tab look: quiet, then the fill of the current item under the pointer and while its panel is open. */
const PILL =
  "relative flex h-10 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 data-open:bg-muted data-open:text-foreground"

/**
 * The bar of the games the friends are in, for the navbar: with friends in games it is a pill each (the most crowded first, up to three), and the panel of a game opens
 * under it; with none it is the button that invites a friend, when it has a link to copy. It draws no container, so that the page puts it in one: the dock of the
 * social panel, whose bar it is. While that container is open the bar is folded away (it takes no room, no pointer and no focus).
 */
function FriendsBar({
  friends,
  gameIcon,
  onJoin,
  onOpenFriend,
  onMoreFriends,
  onShareLink,
  shareLabel = "Invite a friend",
  shared = false,
  className,
  ...props
}: FriendsBarProps) {
  // Kept for as long as the friends are the same ones: the panel below compares the game it draws with the one it drew before
  const games = React.useMemo(() => gamesOf(friends).slice(0, MAX_GAMES), [friends])
  const bar = React.useRef<HTMLDivElement>(null)
  const touched = React.useRef(false)
  // One panel for all the pills: it moves from a game to the next and says what is about the one under the pointer. A press on the bar is not a press away from the panel: the pill decides
  const card = useMovingCard((node) => bar.current?.contains(node) ?? false)
  const connected = React.useMemo(() => connectedOf(friends), [friends])
  const narrow = React.useSyncExternalStore(subscribeToNarrow, isNarrow, notNarrow)
  const room = narrow ? MAX_FRIENDS - 1 : MAX_FRIENDS
  const faces = connected.slice(0, room)
  const hidden = connected.length - faces.length
  const onPill = games.find((game) => `game:${game.game.slug}` === card.target?.key) ?? null
  const onFace = connected.find((friend) => `friend:${friend.id}` === card.target?.key) ?? null
  // The panel keeps the last thing it drew while it closes, so that it does not empty as it fades
  const [last, setLast] = React.useState<{ game: GameFriends } | { friend: Friend } | null>(null)
  if (onPill && !(last && "game" in last && last.game === onPill)) setLast({ game: onPill })
  else if (!onPill && onFace && !(last && "friend" in last && last.friend === onFace)) setLast({ friend: onFace })
  const shown = onPill ? { game: onPill } : onFace ? { friend: onFace } : last

  if (games.length === 0 && connected.length === 0) {
    if (!onShareLink) return null
    return (
      <div data-slot="friends-bar" className={cn("flex items-center gap-1", className)} {...props}>
        <Button type="button" variant="ghost" size="icon-lg" className="rounded-lg" aria-label={shareLabel} title={shareLabel} onClick={onShareLink}>
          <HugeiconsIcon icon={shared ? Tick02Icon : UserAdd01Icon} strokeWidth={2} />
        </Button>
      </div>
    )
  }

  return (
    <>
      <div
        role="group"
        aria-label="Friends online and in a game"
        {...props}
        ref={bar}
        data-slot="friends-bar"
        className={cn("flex items-center gap-1", className)}
        onPointerLeave={card.hide}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) card.hide()
        }}
      >
        {faces.map((friend) => {
          const key = `friend:${friend.id}`
          const isOpen = card.target?.key === key
          return (
            <button
              key={key}
              type="button"
              aria-label={`${friend.nickname}: ${presenceWord(friend)}`}
              aria-haspopup={onOpenFriend ? undefined : "true"}
              aria-expanded={onOpenFriend ? undefined : isOpen}
              data-slot="friends-bar-friend"
              data-status={friend.status}
              data-open={isOpen ? "" : undefined}
              className="relative flex size-10 items-center justify-center rounded-lg outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 data-open:bg-muted"
              onPointerEnter={(event) => {
                if (event.pointerType !== "touch") card.show(key, event.currentTarget, true)
              }}
              onPointerDown={(event) => {
                touched.current = event.pointerType === "touch"
              }}
              onClick={(event) => {
                if (onOpenFriend) {
                  card.close()
                  onOpenFriend(friend)
                } else if (touched.current && isOpen) card.close()
                else card.show(key, event.currentTarget, true)
              }}
              onFocus={(event) => {
                if (event.target.matches(":focus-visible")) card.show(key, event.currentTarget, true)
              }}
            >
              <Avatar>
                {friend.avatarUrl && <AvatarImage src={friend.avatarUrl} alt="" referrerPolicy="no-referrer" />}
                <AvatarFallback>{initials(friend.nickname)}</AvatarFallback>
                <PresenceDot status={friend.status} />
              </Avatar>
            </button>
          )
        })}
        {hidden > 0 && onMoreFriends && (
          <button
            type="button"
            data-slot="friends-bar-more"
            aria-label={`${hidden} more ${hidden === 1 ? "friend" : "friends"} online`}
            className="flex h-10 items-center rounded-lg px-2 text-sm text-muted-foreground tabular-nums outline-none transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
            onClick={onMoreFriends}
          >
            +{hidden}
          </button>
        )}
        {games.map((item, index) => {
          const isOpen = card.target?.key === `game:${item.game.slug}`
          return (
            <button
              key={item.game.slug}
              type="button"
              aria-label={`${item.game.name}: ${item.count} ${item.count === 1 ? "friend" : "friends"}`}
              aria-expanded={isOpen}
              aria-haspopup="true"
              data-open={isOpen ? "" : undefined}
              className={cn(PILL, SHOWN_FROM[index])}
              // A touch has no hover: it presses the pill, which opens its panel, and presses it again to close it
              onPointerEnter={(event) => {
                if (event.pointerType !== "touch") card.show(`game:${item.game.slug}`, event.currentTarget, true)
              }}
              onPointerDown={(event) => {
                touched.current = event.pointerType === "touch"
              }}
              onClick={(event) => {
                if (touched.current && isOpen) card.close()
                else card.show(`game:${item.game.slug}`, event.currentTarget, true)
              }}
              // Only the focus a keyboard gives opens it, not the one a click leaves
              onFocus={(event) => {
                if (event.target.matches(":focus-visible")) card.show(`game:${item.game.slug}`, event.currentTarget, true)
              }}
            >
              <GameIcon name={item.game.name} src={gameIcon?.(item.game.slug)} />
              <span className="tabular-nums">{item.count}</span>
              {isOpen && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-xs bg-foreground" />}
            </button>
          )
        })}
      </div>
      {shown && (
        <MovingCard
          card={card}
          contentKey={"game" in shown ? `game:${shown.game.game.slug}` : `friend:${shown.friend.id}`}
          width={240}
          // 2px under the pill: it overlaps the bar a little (the pill is 8px from the bottom of the bar), covering its padding and none of its pills
          placement={{ side: "bottom", align: "center", offset: 2 }}
          label={"game" in shown ? `Friends in ${shown.game.game.name}` : statusLine(shown.friend)}
          contentClassName="flex flex-col gap-6 p-4"
        >
          {"game" in shown ? <FriendsBarList entry={shown.game} onJoin={onJoin} /> : <FriendCard friend={shown.friend} onJoin={onJoin} />}
        </MovingCard>
      )}
    </>
  )
}

export { FriendsBar, FriendsBarList }
