"use client"

import * as React from "react"
import { Tick02Icon, UserAdd01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { gamesOf, initials, tablesOf, type Friend, type GameFriends } from "../friends"
import { cn } from "../utils"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Button } from "./button"
import { GameIcon, PresenceDot } from "./friends-panel"
import { Popover, PopoverAnchor, PopoverContent } from "./popover"

// The friends of a signed-in visitor as the Riot Client shows its social visibility: a small bar on the navbar, in the container of the account and of the social panel (`SocialDock`, which is its own container: the bar draws none), with a pill for each game
// that some of them are in (the game's picture and how many of them are in it), and, under the pointer, a panel under the bar with those friends in two lists,
// "Online" (waiting in the game's lobby, the ones who share a table together under it: "Table K7Q · 2/4") and "Playing", each with the picture, the dot of their
// presence, their name and what they are doing. The pill under the pointer takes the fill of the navbar's current item and a line under it; moving to another
// pill changes the panel. A friend who is away, or on the hub and in no game, is in none: they are in the list of the page of the friends (`FriendsPanel`).
// With no friend in a game the bar is the button that invites one. The bar draws no container: it is the top of the dock (`SocialDock`), which holds it with the account's picture and the button
// of the social panel, so that the games, the profile and the panel are one container. While the dock is open the bar is a recap (`recap`). A status is the dot on the picture (a blue disc with a play knocked out for a friend who is playing, a green
// disc online, an orange-yellow moon inactive, a red disc with a bar do not disturb, a thick grey ring offline) and, under the name, a line of quiet text (only the dot is coloured), and always a word too, never the colour alone.
//
// The panel is a `Popover` anchored on the bar, which opens under the pointer (a short delay on the way out lets the pointer cross the gap to the panel), with the
// keyboard (a pill that has the focus) and, where there is no pointer, when a pill is pressed (pressed again, or a press away, it closes). It is drawn from the
// friends it is given and decides nothing about them. A narrow screen has room for fewer pills, the most crowded games first.

/** The games the bar draws, the most crowded first. */
const MAX_GAMES = 3

/** Where each pill starts to have room: the first always, the next ones from wider screens. */
const SHOWN_FROM = ["", "max-[359px]:hidden", "max-[399px]:hidden"] as const

/** How long the panel stays when the pointer leaves, so that it can cross the gap between the bar and the panel. */
const HIDE_DELAY = 140

type FriendsBarProps = Omit<React.ComponentProps<"div">, "children"> & {
  friends: readonly Friend[]
  /** The bar is only a recap: the panel of a game does not open under the pointer, and a press on a pill asks the page for that game (`onPickGame`). */
  recap?: boolean
  /** What a press on a pill does while the bar is a recap: show that game. */
  onPickGame?: (slug: string) => void
  /** The picture of a game, from its slug; the initial of its name is drawn where there is none or it does not load. */
  gameIcon?: (slug: string) => string | undefined
  /** What the button of a friend who waits at a table that has room does: join them. Not drawn without it. */
  onJoin?: (friend: Friend) => void
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
        <p className="truncate text-sm text-foreground">
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

/**
 * What the panel of a game says: "Online", the friends who wait in its lobby, those at one table together under it ("Table K7Q · 2/4") and the others after,
 * then "Playing". A list with nobody in it is not drawn. It is the content of the panel, shown on its own by `/design`.
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
 * social panel, whose bar it is. While that container is open the bar is only a recap (`recap`): the panel of a game does not open, and a pill takes the visitor to that game in the list.
 */
function FriendsBar({
  friends,
  recap = false,
  onPickGame,
  gameIcon,
  onJoin,
  onShareLink,
  shareLabel = "Invite a friend",
  shared = false,
  className,
  ...props
}: FriendsBarProps) {
  const games = gamesOf(friends).slice(0, MAX_GAMES)
  const [open, setOpen] = React.useState<string | null>(null)
  const bar = React.useRef<HTMLDivElement>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const touched = React.useRef(false)
  const last = React.useRef<GameFriends | null>(null)

  // The panel keeps the last game it drew while it closes, so that it does not empty as it fades
  const entry = recap ? null : (games.find((game) => game.game.slug === open) ?? null)
  if (entry) last.current = entry
  const shown = entry ?? last.current

  const cancel = () => clearTimeout(timer.current)
  const show = (slug: string) => {
    if (recap) return
    cancel()
    setOpen(slug)
  }
  const hide = () => {
    cancel()
    timer.current = setTimeout(() => setOpen(null), HIDE_DELAY)
  }
  React.useEffect(() => () => clearTimeout(timer.current), [])

  if (games.length === 0) {
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
    <Popover
      open={entry !== null}
      onOpenChange={(next) => {
        if (!next) setOpen(null)
      }}
    >
      <PopoverAnchor asChild>
        <div
          role="group"
          aria-label="Friends in a game"
          {...props}
          ref={bar}
          data-slot="friends-bar"
          className={cn("flex items-center gap-1", className)}
          onPointerLeave={hide}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) hide()
          }}
        >
          {games.map((item, index) => {
            const isOpen = open === item.game.slug
            return (
              <button
                key={item.game.slug}
                type="button"
                aria-label={`${item.game.name}: ${item.count} ${item.count === 1 ? "friend" : "friends"}`}
                aria-expanded={recap ? undefined : isOpen}
                aria-haspopup={recap ? undefined : "true"}
                data-open={isOpen ? "" : undefined}
                className={cn(PILL, SHOWN_FROM[index])}
                // A touch has no hover: it presses the pill, which opens its panel, and presses it again to close it
                onPointerEnter={(event) => {
                  if (event.pointerType !== "touch") show(item.game.slug)
                }}
                onPointerDown={(event) => {
                  touched.current = event.pointerType === "touch"
                }}
                onClick={() => {
                  if (recap) onPickGame?.(item.game.slug)
                  else if (touched.current && isOpen) setOpen(null)
                  else show(item.game.slug)
                }}
                // Only the focus a keyboard gives opens it, not the one a click leaves
                onFocus={(event) => {
                  if (event.target.matches(":focus-visible")) show(item.game.slug)
                }}
              >
                <GameIcon name={item.game.name} src={gameIcon?.(item.game.slug)} />
                <span className="tabular-nums">{item.count}</span>
                {isOpen && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-xs bg-foreground" />}
              </button>
            )
          })}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={14}
        aria-label={shown ? `Friends in ${shown.game.name}` : "Friends"}
        className="w-72 gap-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        // A press on the bar is not a press away from the panel: the pill it is on decides what the panel does
        onInteractOutside={(event) => {
          if (bar.current?.contains(event.target as Node)) event.preventDefault()
        }}
        onPointerEnter={cancel}
        onPointerLeave={hide}
      >
        {shown && <FriendsBarList entry={shown} onJoin={onJoin} />}
      </PopoverContent>
    </Popover>
  )
}

export { FriendsBar, FriendsBarList }
