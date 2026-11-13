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
import { QueuePill } from "@pbgo/ui/platform/queue"
import { Separator } from "@pbgo/ui/platform/separator"
import { SocialDock, SocialDockIdentity } from "@pbgo/ui/platform/social-dock"
import { SocialPanel, SocialPanelToggle, type SocialTab } from "@pbgo/ui/platform/social-panel"
import { QUEUE_MODE_LABELS, queueGamesLabel, queueProgress } from "@pbgo/ui/queue"
import { unreadOf, type Conversation, type Message } from "@pbgo/ui/social"
import { cn } from "@pbgo/ui/utils"
import { AccountMenu } from "@/components/account-menu"
import { changeFriends, useFriendActions } from "@/components/friend-actions"
import { useReceivedRequestToasts } from "@/components/friend-toasts"
import { useInvitationActions, useReceivedInvitationToasts } from "@/components/invitation-actions"
import { OwnName } from "@/components/own-name"
import { readFolded, writeFolded } from "@/lib/folded-games"
import { leaveQueue, useQueue, useQueueSeconds } from "@/lib/matchmaking"
import { MESSAGE_MAX_LENGTH } from "@pbgo/core/lib/messages"
import { useChatThread } from "@/lib/use-chat-thread"
import { useCopied } from "@/lib/use-copied"
import { useSocial } from "@/lib/use-social"

/** The picture of a game on the hub: its icon in the catalog (`docs/catalog.md`). */
const gameIcon = (slug: string) => `/api/catalog/${slug}/icon`

/**
 * What a signed-in visitor has on the navbar, the way the Riot Client has it, in one container on the right (`SocialDock`) that is a bar while it is closed and a real side
 * panel while it is open, the same element changing from one to the other with a transition. Closed, the bar has the friends who are connected, each a small picture with the dot of its presence (three at the most, then "+N", which opens the panel), then the games their friends are in (`FriendsBar`, with the list of a
 * game's friends under the pointer), then, behind a thin line, their picture, with the count of what waits for them on its corner (messages not read, requests and invitations to answer), which opens
 * the menu of their account (`AccountMenu`), and the button of the social panel (`SocialPanelToggle`: the icon of a panel on the right, which opens it and, once it is open, closes it).
 * Open, the bar is the header of the panel: the games fold away, the picture glides to the start of the bar and says who they are beside it (`SocialDockIdentity`: their name with its tag and
 * their status), the button stays where it was, and the panel (`SocialPanel`: friends game by game, messages, add a friend) is under it. A real account's friends and requests are the database's (PLT-23: `useSocial`, kept fresh while a tab is in view), and
 * what the buttons do is `useFriendActions`'s: the form that adds a friend, the answers to a request, and the menu of a friend (their profile, remove, block). A press on a friend, or on a conversation, opens the chat (`ChatWindow`) next to the panel: a real account's is read from the server while it is open and what is written is kept (PLT-25, `useChatThread`); the demo account of development has made-up friends and conversations, and a message it sends is kept for as long as the page is open.
 * While the visitor looks for a game (the button of a game's page, `lib/matchmaking.ts`), the closed bar has a small pill for it before the games, and the panel a card at the top, over the tabs. Joining a friend and inviting one are not drawn for a real account (PLT-109);
 * the demo account has the buttons, and they do nothing. A visitor with no friend at a game has the button that invites a friend in the bar, which copies the address of the sign-in, where a friend can come and sign in.
 */
export function SiteSocial({ account, game }: { account: Account; /** The rows of a game's screen for the menu of the picture, above the pages of the account: its sound, its language, its setup, the way out (`HudMenu` of core) */ game?: React.ReactNode }) {
  const social = useSocial(account)
  const friends = useFriendActions()
  const [copied, copy] = useCopied()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<SocialTab>("friends")
  // The games of the list that the visitor folded: the panel is unmounted when the dock closes, so they are kept here, and in the browser for the next visit
  const [folded, setFolded] = useState<ReadonlySet<string>>(readFolded)
  // The friend of the chat is kept after it is closed, so that the window has someone to show while it leaves
  const [chatWith, setChatWith] = useState<Friend | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const [sent, setSent] = useState<Record<string, readonly Message[]>>({})
  const [read, setRead] = useState<ReadonlySet<string>>(new Set())
  const preview = account.id === DEMO_ACCOUNT.id
  // A toast for each friend request that comes in while the page is open (the demo account has none that come in: its requests are made up)
  useReceivedRequestToasts(preview ? null : account.id, changeFriends)
  // The invitations to a table: the card of the panel, a toast for each that comes in while the page is open (the demo account has none that come in), and what sits the visitor down at the table of one they accepted
  const invitations = useInvitationActions()
  useReceivedInvitationToasts(preview ? null : account.id, invitations.answer, gameIcon)
  const nothing = () => {}
  // The search for a game that the visitor has begun, wherever they began it (the button of a game's page, the home's Find a game): the bar shows it while the panel is closed, and the panel has a card for it
  const queue = useQueue()
  const seconds = useQueueSeconds(queue)
  const searching = queue ? { game: queueGamesLabel(queue.games), mode: QUEUE_MODE_LABELS[queue.mode], progress: queueProgress(queue), seconds, onCancel: leaveQueue } : undefined

  // The conversations as the visitor has made them in this page: what they sent is in them, what they opened is read, and a friend they wrote to first has one
  const conversations = useMemo<Conversation[]>(() => {
    // A real account's conversations are the server's: the last message of each, and what is not read
    if (!preview) return [...social.conversations]
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
  }, [social, sent, read, preview])
  const waiting = unreadOf(conversations) + social.requests.filter((request) => request.direction === "incoming").length + social.invitations.length

  // Escape folds the dock, unless a menu or a panel of the page is what it closes, and gives the focus back to the button that opened it
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector('[data-slot="dropdown-menu-content"], [data-slot="popover-content"], [data-slot="dialog-content"], [data-slot="moving-card"]')) return
      setOpen(false)
      toggle.current?.focus()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  const openChat = (friend: Friend) => {
    setChatWith(friend)
    setChatOpen(true)
    setRead((all) => new Set(all).add(friend.id))
  }
  // A real account's chat: the friend as the list shows them now (their presence changes), the conversation read from the server while the window is open, and what the member writes
  const chatFriend = chatWith && (social.friends.find((friend) => friend.id === chatWith.id) ?? chatWith)
  const thread = useChatThread(preview ? null : chatFriend, { active: chatOpen, onGone: () => setChatOpen(false) })
  // The panel on its friends tab: what the "+N" of the bar opens
  const showFriends = () => {
    setTab("friends")
    setOpen(true)
  }
  // A press on a connected friend of the bar opens their conversation
  const showFriend = (friend: Friend) => openChat(friend)
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
        games={
          <>
            {/* The bar grows to the left, over the navbar's tabs, in a window narrower than 1024px: there the button of the page and the panel's card show the wait, and the bar has no pill */}
            {searching && <QueuePill {...searching} className="max-lg:hidden" />}
            <FriendsBar
              friends={social.friends}
              gameIcon={gameIcon}
              onJoin={preview ? nothing : undefined}
              onOpenFriend={showFriend}
              onMoreFriends={() => showFriends()}
              onShareLink={copy}
              shareLabel={copied ? "Link copied" : "Invite a friend"}
              shared={copied}
            />
            <Separator orientation="vertical" className="mx-1 h-6 self-center" />
          </>
        }
        profile={
          <AccountMenu account={account} beside={open ? '[data-slot="social-dock"]' : undefined} game={game}>
            <button
              type="button"
              aria-label={`Account of ${account.nickname}${waiting > 0 ? `, ${waiting} waiting` : ""}`}
              className="flex min-w-0 items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <Avatar>
                {picture}
                <AvatarCount count={waiting} />
                <PresenceDot status="online" />
              </Avatar>
              <SocialDockIdentity>
                <OwnName account={account} className="text-lg leading-tight font-strong text-foreground" />
                <span className="truncate text-xs text-muted-foreground">Online</span>
              </SocialDockIdentity>
            </button>
          </AccountMenu>
        }
        toggle={<SocialPanelToggle ref={toggle} open={open} aria-controls="social-panel" onClick={() => setOpen((value) => !value)} />}
      >
        <SocialPanel
          bare
          id="social-panel"
          queue={searching}
          tab={tab}
          onTabChange={setTab}
          friends={social.friends}
          gameIcon={gameIcon}
          conversations={conversations}
          requests={social.requests}
          invitations={social.invitations}
          onAnswerInvitation={(invitation, answer) => invitations.answer(invitation, answer)}
          onOpenChat={openChat}
          onViewProfile={friends.viewProfile}
          onRemove={friends.remove}
          onBlock={friends.block}
          folded={folded}
          onFoldedChange={(next) => {
            setFolded(next)
            writeFolded(next)
          }}
          onJoin={preview ? nothing : undefined}
          onInvite={preview ? nothing : undefined}
          onNote={preview ? nothing : undefined}
          onSendRequest={friends.sendRequest}
          onAnswerRequest={friends.answer}
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
        {chatWith && chatFriend && (
          <ChatWindow
            className="h-full"
            friend={chatFriend}
            messages={preview ? (conversations.find((conversation) => conversation.friend.id === chatWith.id)?.messages ?? []) : thread.messages}
            maxLength={MESSAGE_MAX_LENGTH}
            onSend={(text) => (preview ? send(chatWith, text) : thread.send(text))}
            onClose={() => setChatOpen(false)}
            onJoin={preview ? nothing : undefined}
            onInvite={preview ? nothing : undefined}
            onRemove={preview ? nothing : (friend) => friends.remove(friend)}
            onBlock={preview ? nothing : (friend) => friends.block(friend)}
          />
        )}
      </PanelPresence>
      {friends.dialog}
      {invitations.joining}
    </>
  )
}
