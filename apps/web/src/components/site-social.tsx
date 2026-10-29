"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { initialsOf, type Account } from "@pbgo/accounts"
import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import type { Friend } from "@pbgo/ui/friends"
import { Avatar, AvatarCount, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { ChatWindow } from "@pbgo/ui/platform/chat-window"
import { FriendsBar } from "@pbgo/ui/platform/friends-bar"
import { PresenceDot } from "@pbgo/ui/platform/friends-panel"
import { PanelPresence } from "@pbgo/ui/platform/panel-presence"
import { Separator } from "@pbgo/ui/platform/separator"
import { SocialDock } from "@pbgo/ui/platform/social-dock"
import { SocialPanel, SocialPanelToggle, type SocialTab } from "@pbgo/ui/platform/social-panel"
import { unreadOf, type Conversation, type Message } from "@pbgo/ui/social"
import { cn } from "@pbgo/ui/utils"
import { AccountMenu } from "@/components/account-menu"
import { useCopied } from "@/lib/use-copied"
import { useSocial } from "@/lib/use-social"

/** The picture of a game on the hub: its icon in the Notion row of the catalog (`docs/catalog.md`), served by the hub itself. */
const gameIcon = (slug: string) => `/api/catalog/${slug}/icon`

/**
 * What a signed-in visitor has on the navbar, the way the Riot Client has it, in one container on the right (`SocialDock`) that is a recap bar while it is closed and a real
 * side panel while it is open, the same element changing from one to the other with a transition: the bar has the games their friends are in (`FriendsBar`, with the list of a
 * game's friends under the pointer), then, behind a thin line, their picture, with the count of what waits for them on its corner (messages not read, requests to answer), which opens the menu of their account (`AccountMenu`), and the button of the social panel
 * (`SocialPanelToggle`: the icon of a panel on the right, which opens it and, once it is open, closes it). Open, the bar stays at the top of
 * the container (a press on a game takes the visitor to it in the list) and the panel (`SocialPanel`: friends game by game, messages, add a friend) is under it. A press on a friend or
 * a conversation opens the chat with them (`ChatWindow`) next to the panel, where a message sent is kept for as long as the page is open. The demo account of development has
 * friends, messages and requests whose buttons do nothing; a real account has none until PLT-23, so its bar is the button that invites a friend, which copies the address of the
 * sign-in, where a friend can come and sign in.
 */
export function SiteSocial({ account }: { account: Account }) {
  const social = useSocial(account)
  const [copied, copy] = useCopied()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<SocialTab>("friends")
  // The friend of the chat is kept after it is closed, so that the window has someone to show while it leaves
  const [chatWith, setChatWith] = useState<Friend | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
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

  // Escape folds the dock, unless a menu or a panel of the page is what it closes, and gives the focus back to the button that opened it
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector('[data-slot="dropdown-menu-content"], [data-slot="popover-content"]')) return
      setOpen(false)
      toggle.current?.focus()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  // A press on a game of the recap: the list of the friends, at that game, once the tab has come in
  const pickGame = (slug: string) => {
    setTab("friends")
    window.setTimeout(() => document.querySelector(`[data-slot="social-dock"] [data-game="${slug}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }), 250)
  }

  const openChat = (friend: Friend) => {
    setChatWith(friend)
    setChatOpen(true)
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
      <SocialDock
        open={open}
        bar={
          <>
            <FriendsBar
              friends={social.friends}
              recap={open}
              onPickGame={pickGame}
              gameIcon={gameIcon}
              onJoin={preview ? nothing : undefined}
              onShareLink={copy}
              shareLabel={copied ? "Link copied" : "Invite a friend"}
              shared={copied}
            />
            <Separator orientation="vertical" className="mx-1 h-6 self-center" />
            <div className="flex items-center gap-1">
              <AccountMenu account={account}>
                <button
                  type="button"
                  aria-label={`Account of ${account.nickname}${waiting > 0 ? `, ${waiting} waiting` : ""}`}
                  className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <Avatar>
                    {picture}
                    <AvatarCount count={waiting} />
                    <PresenceDot status="online" />
                  </Avatar>
                </button>
              </AccountMenu>
              <SocialPanelToggle ref={toggle} open={open} aria-controls="social-panel" onClick={() => setOpen((value) => !value)} />
            </div>
          </>
        }
      >
        <SocialPanel
          bare
          id="social-panel"
          tab={tab}
          onTabChange={setTab}
          friends={social.friends}
          gameIcon={gameIcon}
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
      </SocialDock>
      <PanelPresence
        open={chatOpen}
        from="bottom"
        className={cn(
          "fixed bottom-[calc(var(--consent-h,0px)+1.5rem)] z-50 h-96 max-h-[calc(100svh-var(--consent-h,0px)-3rem)] transition-[right] duration-slow ease-standard",
          "max-md:right-6 max-md:left-6 md:w-80",
          open ? "md:right-[22.5rem]" : "md:right-6"
        )}
      >
        {chatWith && (
          <ChatWindow
            className="h-full"
            friend={chatWith}
            messages={conversations.find((conversation) => conversation.friend.id === chatWith.id)?.messages ?? []}
            onSend={(text) => send(chatWith, text)}
            onClose={() => setChatOpen(false)}
          />
        )}
      </PanelPresence>
    </>
  )
}
