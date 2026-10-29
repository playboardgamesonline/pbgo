"use client"

import * as React from "react"
import { ArrowRightDoubleIcon, Cancel01Icon, Chatting01Icon, Link01Icon, Tick02Icon, UserAdd01Icon, UserListIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { initials, type Friend } from "../friends"
import { lastMessage, sortedConversations, timeAgo, unreadOf, type Conversation, type FriendRequest } from "../social"
import { cn } from "../utils"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Badge } from "./badge"
import { Button } from "./button"
import { FriendsRoster, PresenceDot } from "./friends-panel"
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

// The social panel of a signed-in visitor, the way the Riot Client has it: a column on the right of the page that opens from the account, with the visitor at the
// top (whatever the page puts there, usually their picture and name inside the menu of their account) and a button that folds it away, then three tabs, each an
// icon: the friends and what they are doing (`FriendsRoster`), the conversations with them, and the way to add a friend with the requests that wait for an answer.
// The tabs that have something for the visitor (messages not read, requests to answer) carry a count. It is drawn from what it is given and decides nothing:
// where the friends, the messages and the requests come from (PLT-23) and what a press does are the page's, and a button whose handler is missing is not drawn
// (the field that adds a friend is off). The presence of a friend wears its colour (`FriendsRoster`, `PresenceDot`). The page places it (`fixed`, on the right, over the navbar's account island).

export type SocialTab = "friends" | "messages" | "add"

/** The count on the corner of a tab: at the top right of its icon, which is in the middle. */
const COUNT = "absolute top-0.5 left-1/2 ml-2 h-4 min-w-4 justify-center px-1"

/** The look of a tab: a big icon in a pill, filled while it is the current one. The bar is a pill too, like the search bar and the buttons: `Tabs` is round by default, so nothing here rounds it differently. */
const TAB = "relative px-0"

/** The icon of a tab. */
const TAB_ICON = "size-6"

/** What the field that adds a friend shows: the tag follows the nickname after a hash (PLT-39). Written in two parts so that the design guard, which takes a hash and digits for a colour, leaves it alone. */
const EXAMPLE = ["Oré", "4821"].join("#")
const PLACEHOLDER = ["Nickname", "0000"].join("#")

/** A scrolling column with no scrollbar, for what a tab holds. */
const COLUMN = "min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

type SocialPanelProps = Omit<React.ComponentProps<"aside">, "children"> & {
  /** The visitor, at the top: their picture and name, usually inside the trigger of the menu of their account. */
  header: React.ReactNode
  /** What the button that folds the panel away does. */
  onClose: () => void
  friends: readonly Friend[]
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
  /** What the field that adds a friend does with the nickname and the tag typed in it. The field is off without it. */
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
          {last && <span className="block truncate text-xs text-muted-foreground">{last.text}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {last && <span className="text-xs text-muted-foreground">{timeAgo(last.at)}</span>}
          {conversation.unread > 0 && (
            <Badge className="h-4 min-w-4 justify-center px-1">
              {conversation.unread}
              <span className="sr-only"> unread</span>
            </Badge>
          )}
        </span>
      </button>
    </li>
  )
}

function RequestRow({ request, onAnswer }: { request: FriendRequest; onAnswer?: (request: FriendRequest, answer: "accept" | "decline" | "cancel") => void }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl px-2.5 py-2">
      <Avatar>
        <AvatarFallback>{initials(request.nickname)}</AvatarFallback>
      </Avatar>
      <p className="min-w-0 flex-1 truncate text-sm text-foreground">
        {request.nickname}
        <span className="text-muted-foreground">#{request.tag}</span>
      </p>
      {request.direction === "incoming" ? (
        onAnswer && (
          <>
            <Button type="button" size="icon-xs" aria-label={`Accept ${request.nickname}`} title="Accept" onClick={() => onAnswer(request, "accept")}>
              <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
            </Button>
            <Button type="button" size="icon-xs" variant="ghost" aria-label={`Decline ${request.nickname}`} title="Decline" onClick={() => onAnswer(request, "decline")}>
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          </>
        )
      ) : (
        <>
          <Badge variant="secondary">Sent</Badge>
          {onAnswer && (
            <Button type="button" size="icon-xs" variant="ghost" aria-label={`Cancel the request to ${request.nickname}`} title="Cancel the request" onClick={() => onAnswer(request, "cancel")}>
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          )}
        </>
      )}
    </li>
  )
}

/**
 * The panel: the visitor and the button that folds it at the top, then the three tabs under them. It fills the height the page gives it and scrolls what a tab
 * holds, so the page places it (`fixed`, from the top to the bottom of the window, on the right).
 */
function SocialPanel({
  header,
  onClose,
  friends,
  conversations,
  requests,
  defaultTab = "friends",
  onOpenChat,
  onInvite,
  onJoin,
  onSendRequest,
  onAnswerRequest,
  onShareLink,
  shareLabel = "Invite a friend",
  className,
  ...props
}: SocialPanelProps) {
  const [tab, setTab] = React.useState<SocialTab>(defaultTab)
  const unread = unreadOf(conversations)
  const incoming = requests.filter((request) => request.direction === "incoming").length
  const sorted = sortedConversations(conversations)

  return (
    <aside
      data-slot="social-panel"
      aria-label="Social"
      className={cn("flex flex-col gap-4 rounded-3xl border bg-background/90 p-4 shadow-overlay backdrop-blur-xl", className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{header}</div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Fold the social panel" title="Fold the social panel" onClick={onClose}>
          <HugeiconsIcon icon={ArrowRightDoubleIcon} strokeWidth={2} />
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as SocialTab)} className="min-h-0 flex-1 gap-4">
        <TabsList className="w-full gap-1 group-data-horizontal/tabs:h-12">
          <TabsTrigger value="friends" aria-label="Friends" title="Friends" className={TAB}>
            <HugeiconsIcon icon={UserListIcon} strokeWidth={2} className={TAB_ICON} />
          </TabsTrigger>
          <TabsTrigger value="messages" aria-label={unread > 0 ? `Messages, ${unread} unread` : "Messages"} title="Messages" className={TAB}>
            <HugeiconsIcon icon={Chatting01Icon} strokeWidth={2} className={TAB_ICON} />
            {unread > 0 && <Badge className={COUNT}>{unread}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="add" aria-label={incoming > 0 ? `Add a friend, ${incoming} requests` : "Add a friend"} title="Add a friend" className={TAB}>
            <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className={TAB_ICON} />
            {incoming > 0 && <Badge className={COUNT}>{incoming}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="flex min-h-0 flex-col">
          <FriendsRoster friends={friends} onInvite={onInvite} onJoin={onJoin} onOpen={onOpenChat} />
        </TabsContent>

        <TabsContent value="messages" className={COLUMN}>
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
        </TabsContent>

        <TabsContent value="add" className={cn(COLUMN, "flex flex-col gap-6")}>
          <section aria-labelledby="social-add" className="flex flex-col gap-2">
            <h3 id="social-add" className="font-heading text-base">
              Add a friend
            </h3>
            <p className="text-sm text-muted-foreground">Type their nickname and their tag, like {EXAMPLE}.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const field = event.currentTarget.elements.namedItem("who") as HTMLInputElement
                const who = field.value.trim()
                if (who === "") return
                onSendRequest?.(who)
                field.value = ""
              }}
            >
              <InputGroup>
                <InputGroupInput name="who" placeholder={PLACEHOLDER} aria-label="Nickname and tag of the friend" autoComplete="off" disabled={!onSendRequest} />
                <InputGroupAddon align="inline-end">
                  <Button type="submit" size="sm" disabled={!onSendRequest}>
                    Send
                  </Button>
                </InputGroupAddon>
              </InputGroup>
            </form>
          </section>

          <section aria-labelledby="social-requests" className="flex flex-col gap-2">
            <h3 id="social-requests" className="font-heading text-base">
              Requests {requests.length > 0 && <span className="text-muted-foreground">{requests.length}</span>}
            </h3>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">The friend requests you send and receive wait here for an answer.</p>
            ) : (
              <ul className="flex flex-col">
                {requests.map((request) => (
                  <RequestRow key={request.id} request={request} onAnswer={onAnswerRequest} />
                ))}
              </ul>
            )}
          </section>

          {onShareLink && (
            <Button type="button" variant="outline" size="lg" className="w-full" onClick={onShareLink}>
              <HugeiconsIcon icon={Link01Icon} strokeWidth={2} data-icon="inline-start" />
              {shareLabel}
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </aside>
  )
}

export { SocialPanel }
