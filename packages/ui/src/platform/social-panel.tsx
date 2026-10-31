"use client"

import * as React from "react"
import { Cancel01Icon, Chatting01Icon, Link01Icon, PanelRightCloseIcon, PanelRightOpenIcon, Tick02Icon, UserAdd01Icon, UserListIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import { initials, type Friend } from "../friends"
import { DURATION, EASE_STANDARD, SPRING_TRAVEL } from "../motion"
import { lastMessage, sortedConversations, timeAgo, unreadOf, type Conversation, type FriendRequest } from "../social"
import { cn } from "../utils"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { AddFriendForm } from "./add-friend-form"
import { Badge } from "./badge"
import { Button } from "./button"
import { FriendsRoster, PresenceDot } from "./friends-panel"
import { Tabs, TabsList, TabsTrigger } from "./tabs"

// The social panel of a signed-in visitor, the way the Riot Client has it: three tabs, each an icon (the friends, game by game, and what they are doing, `FriendsRoster`; the conversations
// with them; and the way to add a friend, `AddFriendForm` (the username and the tag side by side and one button under them), with the requests that wait for an answer under it, the ones that came in
// and then the ones that went out, as the Riot Client lists them), the search of the friends, and the list. The tabs that have something for the visitor (messages
// not read, requests to answer) carry a count. The tile behind the current tab is one element that glides to the tab that is pressed, and the pane of a tab comes in from the side the tab is
// on while the one of the tab that was left goes out the other way (`AnimatePresence`, one after the other); a visitor who asks for less motion gets the change with no travel. With a
// surface of its own it is a column for a page, with a `header` (whatever the page puts at the top, usually a picture, a name and a status); `bare` draws none: it is then the body of the
// dock of the navbar (`SocialDock`), which is its surface and whose bar holds the button that opens and closes it (`SocialPanelToggle`). It is drawn from what it is given and decides
// nothing: where the friends, the messages and the requests come from (PLT-23) and what a press does are the page's, and a button whose handler is missing is not drawn (the form that
// adds a friend is off). The dot of a friend's presence wears its colour (`FriendsRoster`, `PresenceDot`).

export type SocialTab = "friends" | "messages" | "add"

/** The count on the corner of a tab: at the top right of its icon, which is in the middle. */
const COUNT = "absolute top-0.5 left-1/2 ml-2 h-4 min-w-4 justify-center px-1"

/** The look of a tab: a big icon in a rounded tile, which is a fill that glides from one tab to the next (`TabFill`). The bar is 3rem high, so `rounded-2xl`, and a tab is one step under it (`rounded-xl`: the bar's radius less its padding). Never a pill. */
const TAB = "relative isolate rounded-xl px-0 data-active:bg-transparent"

/** The tabs, in the order of the bar: the way a change of tab went is read from it. */
const ORDER: readonly SocialTab[] = ["friends", "messages", "add"]

/**
 * What a pane does as the tab changes: the one that was shown leaves quickly, to the side that the tab went from, and the one of the tab that was pressed comes in from the side it went
 * to, both fading, one after the other (`mode="wait"`). `way` is 1 when the tab went to the right and -1 when it went to the left.
 */
const PANE = {
  enter: (way: number) => ({ opacity: 0, x: way * 20 }),
  center: { opacity: 1, x: 0, transition: { duration: DURATION.base, ease: EASE_STANDARD } },
  exit: (way: number) => ({ opacity: 0, x: way * -20, transition: { duration: DURATION.fast, ease: EASE_STANDARD } }),
}

/**
 * What marks the current tab: the tile behind it and a small white bar under it, as the Riot Client's tab has, glued to the foot of the tab bar (`-bottom-1.5`: 6px under the tab, which is where the
 * bar ends) and a little apart from the tile. Each is one element for the three tabs (`layoutId`), so that it travels when another tab is pressed, with the spring of the navbar's fill.
 */
function TabFill() {
  return (
    <>
      <motion.span layoutId="social-tab" aria-hidden="true" className="absolute inset-0 -z-10 rounded-xl bg-input/50" transition={SPRING_TRAVEL} />
      <motion.span
        layoutId="social-tab-bar"
        aria-hidden="true"
        className="absolute -bottom-1.5 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-xs bg-foreground"
        transition={SPRING_TRAVEL}
      />
    </>
  )
}

/** The icon of a tab. */
const TAB_ICON = "size-6"

/** A scrolling column with no scrollbar, for what a tab holds. */
const COLUMN = "min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

type SocialPanelProps = Omit<React.ComponentProps<"aside">, "children"> & {
  /** What is at the top, above the tabs: the visitor, if the page wants one there. Nothing when the dock above it already shows them. */
  header?: React.ReactNode
  /** The panel lives in a container that is drawn around it (`SocialDock`): it draws none of its own, no border, no fill, no shadow. */
  bare?: boolean
  /** The tab that is shown, when the page decides it (a press on a game of the bar takes the visitor to the friends); the panel changes it itself, and tells `onTabChange`. */
  tab?: SocialTab
  onTabChange?: (tab: SocialTab) => void
  friends: readonly Friend[]
  /** The picture of a game, from its slug, for the heads of the list of friends. */
  gameIcon?: (slug: string) => string | undefined
  conversations: readonly Conversation[]
  requests: readonly FriendRequest[]
  /** The tab it opens on. */
  defaultTab?: SocialTab
  /** What a press on a friend, or on a conversation, does: open the chat with them. */
  onOpenChat?: (friend: Friend) => void
  /** What the button of a friend who is online does. */
  onInvite?: (friend: Friend) => void
  /** What the button of a friend who is in a game does. */
  onJoin?: (friend: Friend) => void
  /** What the button of the note on a friend, in their card (the card opens under the pointer, to the left of the panel), does. Not drawn without it. */
  onNote?: (friend: Friend) => void
  /** The games of the list of friends that are folded, by their key (`game:<slug>`), when the page keeps them (so that they stay folded when the panel is closed and opened again). */
  folded?: ReadonlySet<string>
  onFoldedChange?: (folded: ReadonlySet<string>) => void
  /** What the form that adds a friend does with the username and the tag typed in it, written `username#tag` (`AddFriendForm`). The form is off without it. */
  onSendRequest?: (who: string) => void
  /** What the buttons of a request do. Not drawn without it. */
  onAnswerRequest?: (request: FriendRequest, answer: "accept" | "decline" | "cancel") => void
  /** What the button that invites a friend who has no account does: copy a link that brings them here. Not drawn without it. */
  onShareLink?: () => void
  /** What that button says: "Invite a friend", then, for a moment after it was pressed, what it did. */
  shareLabel?: string
}

/** The picture of a friend with the dot of their presence. */
function FriendAvatar({ friend }: { friend: Friend }) {
  return (
    <Avatar>
      {friend.avatarUrl && <AvatarImage src={friend.avatarUrl} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback>{initials(friend.nickname)}</AvatarFallback>
      <PresenceDot status={friend.status} />
    </Avatar>
  )
}

function ConversationRow({ conversation, onOpen }: { conversation: Conversation; onOpen?: (friend: Friend) => void }) {
  const last = lastMessage(conversation)
  // What is new is white, what was read is grey: the last message and how long ago it was written
  const tone = conversation.unread > 0 ? "text-foreground" : "text-muted-foreground"
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left outline-none transition-colors duration-fast hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30"
        onClick={() => onOpen?.(conversation.friend)}
      >
        <FriendAvatar friend={conversation.friend} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">{conversation.friend.nickname}</span>
          {last && <span className={cn("block truncate text-xs", tone)}>{last.text}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {last && <span className={cn("text-xs", tone)}>{timeAgo(last.at)}</span>}
          {conversation.unread > 0 && (
            <Badge variant="notification" className="h-4 min-w-4 justify-center px-1">
              {conversation.unread}
              <span className="sr-only"> unread</span>
            </Badge>
          )}
        </span>
      </button>
    </li>
  )
}

/**
 * A request, as the Riot Client draws one: the picture, the username with the tag under it, and at the end a square button with rounded corners for each answer. One that came in is accepted (the white
 * button) or declined, one that went out is cancelled; the group it is in (`RequestGroup`) says which it is, so there is no word on the row.
 */
function RequestRow({ request, onAnswer }: { request: FriendRequest; onAnswer?: (request: FriendRequest, answer: "accept" | "decline" | "cancel") => void }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl px-2.5 py-2">
      <Avatar>
        {request.avatarUrl && <AvatarImage src={request.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        <AvatarFallback>{initials(request.nickname)}</AvatarFallback>
      </Avatar>
      <p className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{request.nickname}</span>
        <span className="block truncate text-xs text-muted-foreground">#{request.tag}</span>
      </p>
      {onAnswer &&
        (request.direction === "incoming" ? (
          <>
            <Button type="button" size="icon-sm" aria-label={`Accept ${request.nickname}`} title="Accept" onClick={() => onAnswer(request, "accept")}>
              <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Decline ${request.nickname}`}
              title="Decline"
              onClick={() => onAnswer(request, "decline")}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Cancel the request to ${request.nickname}`}
            title="Cancel the request"
            onClick={() => onAnswer(request, "cancel")}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </Button>
        ))}
    </li>
  )
}

/** The requests of one kind under a small label with how many there are (`Incoming 2`, `Outgoing 3`): nothing at all when there are none. */
function RequestGroup({ label, requests, onAnswer }: { label: string; requests: readonly FriendRequest[]; onAnswer?: (request: FriendRequest, answer: "accept" | "decline" | "cancel") => void }) {
  const id = React.useId()
  if (requests.length === 0) return null
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <h3 id={id} className="px-2.5 text-sm text-muted-foreground">
        {label} <span className="tabular-nums">{requests.length}</span>
      </h3>
      <ul className="flex flex-col">
        {requests.map((request) => (
          <RequestRow key={request.id} request={request} onAnswer={onAnswer} />
        ))}
      </ul>
    </section>
  )
}

/**
 * The panel: the visitor at the top, then the three tabs under them. It fills the place the page gives it and scrolls what a tab holds, so the page places it
 * (`PanelPresence`: `fixed`, on the right, from under the navbar's island to the bottom of the window).
 */
function SocialPanel({
  header,
  bare = false,
  friends,
  gameIcon,
  conversations,
  requests,
  tab: controlled,
  defaultTab = "friends",
  onTabChange,
  onOpenChat,
  onInvite,
  onJoin,
  onNote,
  folded,
  onFoldedChange,
  onSendRequest,
  onAnswerRequest,
  onShareLink,
  shareLabel = "Invite a friend",
  className,
  ...props
}: SocialPanelProps) {
  const [own, setOwn] = React.useState<SocialTab>(defaultTab)
  const tab = controlled ?? own
  // Which way the last change of tab went, so that the pane comes in from that side
  const [way, setWay] = React.useState<1 | -1>(1)
  const unread = unreadOf(conversations)
  const incoming = requests.filter((request) => request.direction === "incoming")
  const outgoing = requests.filter((request) => request.direction === "outgoing")
  const sorted = sortedConversations(conversations)
  // Each panel has its own tile and its own ids, so that two panels on one page (the specimens of the design docs) do not trade them
  const group = React.useId()

  function pick(next: SocialTab) {
    if (next === tab) return
    setWay(ORDER.indexOf(next) > ORDER.indexOf(tab) ? 1 : -1)
    setOwn(next)
    onTabChange?.(next)
  }

  const panes: Record<SocialTab, React.ReactNode> = {
    friends: <FriendsRoster friends={friends} gameIcon={gameIcon} folded={folded} onFoldedChange={onFoldedChange} onInvite={onInvite} onJoin={onJoin} onNote={onNote} onOpen={onOpenChat} />,
    messages: (
      <div className={COLUMN}>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
            <p className="text-sm text-foreground">No messages yet</p>
            <p className="text-sm text-muted-foreground">Your conversations with your friends are here.</p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {sorted.map((conversation) => (
              <ConversationRow key={conversation.id} conversation={conversation} onOpen={onOpenChat} />
            ))}
          </ul>
        )}
      </div>
    ),
    add: (
      <div className={cn(COLUMN, "flex flex-col gap-4")}>
        <AddFriendForm onSend={onSendRequest} />

        {requests.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
            <p className="text-sm text-foreground">No requests</p>
            <p className="text-sm text-muted-foreground">The friend requests you send and receive wait here for an answer.</p>
          </div>
        ) : (
          <>
            <RequestGroup label="Incoming" requests={incoming} onAnswer={onAnswerRequest} />
            <RequestGroup label="Outgoing" requests={outgoing} onAnswer={onAnswerRequest} />
          </>
        )}

        {onShareLink && (
          <Button type="button" variant="outline" size="lg" className="w-full" onClick={onShareLink}>
            <HugeiconsIcon icon={Link01Icon} strokeWidth={2} data-icon="inline-start" />
            {shareLabel}
          </Button>
        )}
      </div>
    ),
  }

  return (
    <aside
      data-slot="social-panel"
      aria-label="Social"
      className={cn("flex flex-col gap-4", bare ? "min-h-0 flex-1 px-4 pb-4" : "h-full rounded-4xl border glass p-4 shadow-overlay", className)}
      {...props}
    >
      {header && <div className="min-w-0">{header}</div>}

      <Tabs value={tab} onValueChange={(value) => pick(value as SocialTab)} className="min-h-0 flex-1 gap-4">
        <LayoutGroup id={group}>
          <TabsList className="w-full gap-1 rounded-2xl group-data-horizontal/tabs:h-12">
            <TabsTrigger value="friends" id={`${group}-friends`} aria-controls={`${group}-pane`} aria-label="Friends" title="Friends" className={TAB}>
              <HugeiconsIcon icon={UserListIcon} strokeWidth={2} className={TAB_ICON} />
              {tab === "friends" && <TabFill />}
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              id={`${group}-messages`}
              aria-controls={`${group}-pane`}
              aria-label={unread > 0 ? `Messages, ${unread} unread` : "Messages"}
              title="Messages"
              className={TAB}
            >
              <HugeiconsIcon icon={Chatting01Icon} strokeWidth={2} className={TAB_ICON} />
              {unread > 0 && <Badge variant="notification" className={COUNT}>{unread}</Badge>}
              {tab === "messages" && <TabFill />}
            </TabsTrigger>
            <TabsTrigger
              value="add"
              id={`${group}-add-tab`}
              aria-controls={`${group}-pane`}
              aria-label={incoming.length > 0 ? `Add a friend, ${incoming.length} requests` : "Add a friend"}
              title="Add a friend"
              className={TAB}
            >
              <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className={TAB_ICON} />
              {incoming.length > 0 && <Badge variant="notification" className={COUNT}>{incoming.length}</Badge>}
              {tab === "add" && <TabFill />}
            </TabsTrigger>
          </TabsList>
        </LayoutGroup>

        <AnimatePresence mode="wait" initial={false} custom={way}>
          <motion.div
            key={tab}
            id={`${group}-pane`}
            role="tabpanel"
            aria-labelledby={tab === "add" ? `${group}-add-tab` : `${group}-${tab}`}
            custom={way}
            variants={PANE}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex min-h-0 flex-1 flex-col"
          >
            {panes[tab]}
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </aside>
  )
}

/**
 * The button of the dock's bar that opens and closes the social panel: the icon of a panel on the right, which opens it (`PanelRightOpenIcon`) while it is closed and closes
 * it (`PanelRightCloseIcon`) while it is open, the two crossfading, and it has a fill under the pointer only, open or not. What waits for the visitor (messages not read, requests to answer) is not counted here: it is the count on the
 * corner of their picture (`AvatarCount`), which is in the bar whether the dock is open or closed. The page decides what a press does.
 */
function SocialPanelToggle({
  open,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "variant" | "size" | "asChild" | "children"> & {
  /** Whether the panel is open. */
  open: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label="Social"
      aria-expanded={open}
      title={open ? "Close the social panel" : "Open the social panel"}
      // A ghost button is filled while its `aria-expanded` is true; this one is not: the icon says whether the panel is open, and the fill is for the pointer alone
      className={cn("relative rounded-lg aria-expanded:bg-transparent aria-expanded:hover:bg-muted/50", className)}
      {...props}
    >
      <span aria-hidden="true" className="relative block size-5">
        <HugeiconsIcon
          icon={PanelRightOpenIcon}
          strokeWidth={2}
          className={cn("absolute inset-0 size-5 transition-[opacity,scale] duration-base ease-standard", open ? "scale-75 opacity-0" : "opacity-100")}
        />
        <HugeiconsIcon
          icon={PanelRightCloseIcon}
          strokeWidth={2}
          className={cn("absolute inset-0 size-5 transition-[opacity,scale] duration-base ease-standard", open ? "opacity-100" : "scale-75 opacity-0")}
        />
      </span>
    </Button>
  )
}

export { SocialPanel, SocialPanelToggle }
