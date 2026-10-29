"use client"

import * as React from "react"
import { Cancel01Icon, SentIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { activityLine, initials, type Friend } from "../friends"
import type { Message } from "../social"
import { cn } from "../utils"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Button } from "./button"
import { PresenceDot, STATUS_TEXT } from "./friends-panel"
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group"

// The conversation with a friend, as the Riot Client opens it from its social panel: a card that floats at the bottom of the page, next to the panel, with the friend
// at the top (their picture, the dot of their presence, their name, and what they are doing) and the button that closes it, the messages as bubbles (the visitor's
// on the right, filled; the friend's on the left, quiet) that follow the last one, and the field to write in, which sends with Enter or its button. It is drawn from the
// messages it is given and decides nothing: where they come from, and where a message goes, are the page's. The page places it (`fixed`) and gives it a height.

/** What the line under the name says: what the friend is doing, or the word of their presence. */
function statusLine(friend: Friend): string {
  return activityLine(friend) ?? (friend.status === "offline" ? "Offline" : friend.status === "playing" ? "In a game" : "Online")
}

function ChatWindow({
  friend,
  messages,
  onSend,
  onClose,
  className,
  ...props
}: Omit<React.ComponentProps<"section">, "children"> & {
  friend: Friend
  /** The messages, the oldest first. */
  messages: readonly Message[]
  /** What the field does with what was written, once it is not empty. */
  onSend: (text: string) => void
  /** What the button that closes the chat does. */
  onClose: () => void
}) {
  const [text, setText] = React.useState("")
  const end = React.useRef<HTMLDivElement>(null)

  // The last message stays in view
  React.useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

  return (
    <section
      data-slot="chat-window"
      aria-label={`Chat with ${friend.nickname}`}
      className={cn("flex flex-col overflow-hidden rounded-3xl border bg-background/95 shadow-overlay backdrop-blur-xl", className)}
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
          <p className={cn("truncate text-xs", STATUS_TEXT[friend.status])}>{statusLine(friend)}</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close the chat" title="Close the chat" onClick={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      </header>

      <div role="log" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        <div ref={end} />
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
          <InputGroupInput value={text} onChange={(event) => setText(event.target.value)} placeholder="Message" aria-label={`Message ${friend.nickname}`} autoComplete="off" autoFocus />
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
