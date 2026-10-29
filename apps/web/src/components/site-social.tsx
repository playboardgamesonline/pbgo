"use client"

import { useMemo, useState } from "react"
import { initialsOf, type Account } from "@pbgo/accounts"
import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import type { Friend } from "@pbgo/ui/friends"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Badge } from "@pbgo/ui/platform/badge"
import { ChatWindow } from "@pbgo/ui/platform/chat-window"
import { FriendsBar } from "@pbgo/ui/platform/friends-bar"
import { PresenceDot } from "@pbgo/ui/platform/friends-panel"
import { NavbarEnd } from "@pbgo/ui/platform/navbar"
import { SocialPanel } from "@pbgo/ui/platform/social-panel"
import { unreadOf, type Conversation, type Message } from "@pbgo/ui/social"
import { cn } from "@pbgo/ui/utils"
import { AccountMenu } from "@/components/account-menu"
import { useCopied } from "@/lib/use-copied"
import { useSocial } from "@/lib/use-social"

/** The picture of a game on the hub: its icon in the Notion row of the catalog (`docs/catalog.md`), served by the hub itself. */
const gameIcon = (slug: string) => `/api/catalog/${slug}/icon`

/**
 * What a signed-in visitor has on the navbar, the way the Riot Client has it: the bar of the games their friends are in (`FriendsBar`, with the list of a game's
 * friends under the pointer), and, in the account's island, their picture, which opens the social panel on the right of the page (`SocialPanel`: friends, messages,
 * add a friend). The panel covers the bar while it is open, and the account's menu is at the top of it, under their name. A press on a friend or a conversation
 * opens the chat with them (`ChatWindow`) next to the panel, where a message sent is kept for as long as the page is open. The demo account of development has
 * friends, messages and requests whose buttons do nothing; a real account has none until PLT-23, so its bar is the button that invites a friend, which copies the
 * address of the sign-in, where a friend can come and sign in.
 */
export function SiteSocial({ account }: { account: Account }) {
  const social = useSocial(account)
  const [copied, copy] = useCopied()
  const [open, setOpen] = useState(false)
  const [chatWith, setChatWith] = useState<Friend | null>(null)
  const [sent, setSent] = useState<Record<string, readonly Message[]>>({})
  const [read, setRead] = useState<ReadonlySet<string>>(new Set())
  const preview = account.id === DEMO_ACCOUNT.id
  const nothing = () => {}

  // The conversations as the visitor has made them in this page: what they sent is in them, what they opened is read, and a friend they wrote to first has one
  const conversations = useMemo<Conversation[]>(() => {
    const known = new Set<string>()
    const all: Conversation[] = social.conversations.map((conversation) => {
      known.add(conversation.friend.id)
      return {
        ...conversation,
        unread: read.has(conversation.friend.id) ? 0 : conversation.unread,
        messages: [...conversation.messages, ...(sent[conversation.friend.id] ?? [])],
      }
    })
    for (const friend of social.friends) {
      const messages = sent[friend.id] ?? []
      if (!known.has(friend.id) && messages.length > 0) all.push({ id: `new-${friend.id}`, friend, unread: 0, messages })
    }
    return all
  }, [social, sent, read])
  const waiting = unreadOf(conversations) + social.requests.filter((request) => request.direction === "incoming").length

  const openChat = (friend: Friend) => {
    setChatWith(friend)
    setRead((all) => new Set(all).add(friend.id))
  }
  const send = (friend: Friend, text: string) =>
    setSent((all) => ({ ...all, [friend.id]: [...(all[friend.id] ?? []), { id: `${friend.id}-${Date.now()}`, from: "me", text, at: new Date().toISOString() }] }))

  const picture = (
    <>
      {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback>{initialsOf(account.nickname)}</AvatarFallback>
    </>
  )

  return (
    <>
      {!open && (
        <FriendsBar
          friends={social.friends}
          gameIcon={gameIcon}
          onJoin={preview ? nothing : undefined}
          onShareLink={copy}
          shareLabel={copied ? "Link copied" : "Invite a friend"}
          shared={copied}
        />
      )}
      <NavbarEnd>
        <button
          type="button"
          aria-label={waiting > 0 ? `Social, ${waiting} waiting` : "Social"}
          aria-expanded={open}
          className="relative rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          onClick={() => setOpen((value) => !value)}
        >
          <Avatar size="lg">{picture}</Avatar>
          {waiting > 0 && <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center px-1 ring-2 ring-background">{waiting}</Badge>}
        </button>
      </NavbarEnd>
      {open && (
        <SocialPanel
          className="fixed top-6 right-6 bottom-[calc(var(--consent-h,0px)+1.5rem)] z-50 w-80 max-w-[calc(100vw-3rem)] animate-in fade-in-0 slide-in-from-right-4"
          header={
            <AccountMenu account={account}>
              <button
                type="button"
                aria-label={`Account of ${account.nickname}`}
                className="flex w-full min-w-0 items-center gap-3 rounded-xl p-1 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <Avatar>
                  {picture}
                  <PresenceDot status="online" />
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{account.nickname}</span>
                  <span className="block truncate text-xs text-muted-foreground">Online</span>
                </span>
              </button>
            </AccountMenu>
          }
          onClose={() => setOpen(false)}
          // Escape folds the panel, unless it is the menu of the account that it closes
          onKeyDown={(event) => {
            if (event.key === "Escape" && !document.querySelector('[data-slot="dropdown-menu-content"]')) setOpen(false)
          }}
          friends={social.friends}
          conversations={conversations}
          requests={social.requests}
          onOpenChat={openChat}
          onJoin={preview ? nothing : undefined}
          onInvite={preview ? nothing : undefined}
          onSendRequest={preview ? nothing : undefined}
          onAnswerRequest={preview ? nothing : undefined}
          onShareLink={copy}
          shareLabel={copied ? "Link copied" : "Invite a friend"}
        />
      )}
      {chatWith && (
        <ChatWindow
          className={cn(
            "fixed bottom-[calc(var(--consent-h,0px)+1.5rem)] z-50 h-96 max-h-[calc(100svh-var(--consent-h,0px)-3rem)] animate-in fade-in-0 slide-in-from-bottom-4",
            "max-md:right-6 max-md:left-6 md:w-80",
            open ? "md:right-[25rem]" : "md:right-6"
          )}
          friend={chatWith}
          messages={conversations.find((conversation) => conversation.friend.id === chatWith.id)?.messages ?? []}
          onSend={(text) => send(chatWith, text)}
          onClose={() => setChatWith(null)}
        />
      )}
    </>
  )
}
