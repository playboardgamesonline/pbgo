"use client"

import * as React from "react"
import { Cancel01Icon, MoreHorizontalIcon, SentIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { initials, statusLine, type Friend } from "../friends"
import type { Message } from "../social"
import { cn } from "../utils"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Button } from "./button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./dropdown-menu"
import { PresenceDot } from "./friends-panel"
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group"

// The conversation with a friend, as the Riot Client opens it from its social panel: a card that floats at the bottom of the page, next to the panel, with the friend
// at the top (their picture, the dot of their presence, their name, and what they are doing), a menu of what can be done with them (`···`: join them or invite them, remove them,
// block them) and the button that closes it, the messages as bubbles (the visitor's
// on the right, filled; the friend's on the left, quiet) that follow the last one, and the field to write in, which sends with Enter or its button. It is drawn from the
// messages it is given and decides nothing: where they come from, where a message goes and what an entry of the menu does are the page's (an entry whose handler is missing is not
// drawn, and the menu is not either without any). The page places it (`fixed`) and gives it a height.

function ChatWindow({
  friend,
  messages,
  onSend,
  onClose,
  onJoin,
  onInvite,
  onRemove,
  onBlock,
  autoFocus = true,
  className,
  ...props
}: Omit<React.ComponentProps<"section">, "children" | "autoFocus"> & {
  friend: Friend
  /** The messages, the oldest first. */
  messages: readonly Message[]
  /** What the field does with what was written, once it is not empty. */
  onSend: (text: string) => void
  /** What the button that closes the chat does. */
  onClose: () => void
  /** What the entries of the menu do: join the friend (when they play or wait at a table that has room), invite them (when they are online), remove them, block them. */
  onJoin?: (friend: Friend) => void
  onInvite?: (friend: Friend) => void
  onRemove?: (friend: Friend) => void
  onBlock?: (friend: Friend) => void
  /** Whether the field takes the focus when the chat opens, which a chat that a visitor has just opened wants. A page that draws the window among other things (the docs) does not: focusing a field scrolls the page to it. */
  autoFocus?: boolean
}) {
  const [text, setText] = React.useState("")
  // The same rule as the row of the friend in the list: a friend who plays can be joined, so can one who waits at a table that has room; one who is online anywhere else can be invited
  const joinable = friend.status === "playing" || (friend.status === "online" && friend.table !== undefined && friend.table.size < friend.table.max)
  const play = joinable ? onJoin : friend.status === "online" ? onInvite : undefined
  const log = React.useRef<HTMLDivElement>(null)

  // The last message stays in view: the list scrolls and nothing else does (`scrollIntoView` would scroll every box that holds the window, the page included)
  React.useEffect(() => {
    const list = log.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages.length])

  return (
    <section
      data-slot="chat-window"
      aria-label={`Chat with ${friend.nickname}`}
      className={cn("flex flex-col overflow-hidden rounded-4xl border glass shadow-overlay", className)}
      {...props}
    >
      <header className="flex items-center gap-3 border-b px-4 py-3">
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
          <p className="truncate text-xs text-muted-foreground">{statusLine(friend)}</p>
        </div>
        {(play || onRemove || onBlock) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`More about ${friend.nickname}`} title="More">
                <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {play && <DropdownMenuItem onSelect={() => play(friend)}>{joinable ? "Join" : "Invite"}</DropdownMenuItem>}
              {play && (onRemove || onBlock) && <DropdownMenuSeparator />}
              {onRemove && <DropdownMenuItem onSelect={() => onRemove(friend)}>Remove friend</DropdownMenuItem>}
              {onBlock && (
                <DropdownMenuItem variant="destructive" onSelect={() => onBlock(friend)}>
                  Block
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close the chat" title="Close the chat" onClick={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      </header>

      <div ref={log} role="log" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {messages.length === 0 && <p className="m-auto text-center text-sm text-muted-foreground">Say hello to {friend.nickname}.</p>}
        {messages.map((message) => (
          <p
            key={message.id}
            className={cn(
              "max-w-11/12 rounded-xl px-3 py-2 text-sm wrap-break-word",
              message.from === "me" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted text-foreground"
            )}
          >
            {message.text}
          </p>
        ))}
      </div>

      <form
        className="border-t p-3"
        onSubmit={(event) => {
          event.preventDefault()
          const sent = text.trim()
          if (sent === "") return
          onSend(sent)
          setText("")
        }}
      >
        <InputGroup>
          <InputGroupInput value={text} onChange={(event) => setText(event.target.value)} placeholder="Message" aria-label={`Message ${friend.nickname}`} autoComplete="off" autoFocus={autoFocus} />
          <InputGroupAddon align="inline-end">
            <Button type="submit" size="icon-xs" variant="ghost" aria-label="Send" title="Send" disabled={text.trim() === ""}>
              <HugeiconsIcon icon={SentIcon} strokeWidth={2} />
            </Button>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </section>
  )
}

export { ChatWindow }
