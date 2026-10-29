"use client"

import { useMemo, useState } from "react"
import { demoAvatar } from "@pbgo/accounts/demo"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { ChatWindow } from "@pbgo/ui/platform/chat-window"
import { FriendsBar, FriendsBarList } from "@pbgo/ui/platform/friends-bar"
import { FriendsPanel, PresenceDot } from "@pbgo/ui/platform/friends-panel"
import { NavbarIsland } from "@pbgo/ui/platform/navbar"
import { SocialPanel, type SocialTab } from "@pbgo/ui/platform/social-panel"
import { gamesOf, type Friend } from "@pbgo/ui/friends"
import type { Conversation, FriendRequest, Message } from "@pbgo/ui/social"

const COURTISANS = { slug: "courtisans", name: "Courtisans" }
const SKULL_KING = { slug: "skull-king", name: "Skull King" }
const HANABI = { slug: "hanabi", name: "Hanabi" }

const MARLY: Friend = { id: "1", nickname: "Marly", tag: "4821", avatarUrl: demoAvatar("🐙", "#8b5cf6"), status: "playing", game: COURTISANS, table: { code: "K7P", size: 3, max: 4 }, activity: "Table K7P · 12 min" }

const FRIENDS: readonly Friend[] = [
  MARLY,
  { id: "2", nickname: "Hervé", tag: "0412", avatarUrl: demoAvatar("🦉", "#0ea5e9"), status: "playing", game: SKULL_KING, table: { code: "9QD", size: 4, max: 6 }, activity: "Table 9QD · 4 min" },
  { id: "3", nickname: "Zoé", tag: "1033", avatarUrl: demoAvatar("🐼", "#14b8a6"), status: "online", game: COURTISANS, table: { code: "M3R", size: 2, max: 4 }, activity: "In the lobby" },
  { id: "4", nickname: "Tom", tag: "7712", avatarUrl: demoAvatar("🐯", "#f59e0b"), status: "online", game: COURTISANS, table: { code: "M3R", size: 2, max: 4 }, activity: "In the lobby" },
  { id: "5", nickname: "Lina", tag: "2290", avatarUrl: demoAvatar("🐸", "#22c55e"), status: "online", game: HANABI, activity: "In the lobby" },
  { id: "6", nickname: "Jade", tag: "6604", avatarUrl: demoAvatar("🦄", "#ec4899"), status: "online", activity: "On the hub" },
  { id: "7", nickname: "Max", tag: "5501", avatarUrl: demoAvatar("🐧", "#6366f1"), status: "offline", activity: "2 h ago" },
  { id: "8", nickname: "Inès", tag: "3318", avatarUrl: demoAvatar("🦋", "#06b6d4"), status: "offline", activity: "Yesterday" },
  { id: "9", nickname: "Sam", tag: "9042", avatarUrl: demoAvatar("🐻", "#a16207"), status: "offline", activity: "3 days ago" },
]

/**
 * The friends' panel with every button it can have, in a column as high as a page: with friends, then with none. The buttons do nothing here, and the search
 * works.
 */
export function FriendsSpecimen({ empty = false }: { empty?: boolean }) {
  const nothing = () => {}
  return (
    <div className="h-[34rem] w-full">
      <FriendsPanel friends={empty ? [] : FRIENDS} onAddFriend={nothing} onInvite={nothing} onJoin={nothing} onShareLink={nothing} />
    </div>
  )
}

/**
 * The friends' bar in a row with the account's island, at the right of a frame that stands for the navbar: left to itself it opens the panel of a game under the
 * pointer, over the page. The buttons do nothing here.
 */
export function BarSpecimen({ empty = false }: { empty?: boolean }) {
  const nothing = () => {}
  return (
    <div className="flex h-72 w-full items-start justify-end gap-2 rounded-3xl border bg-card/40 p-6">
      <FriendsBar friends={empty ? [] : FRIENDS} onJoin={nothing} onShareLink={nothing} />
      <NavbarIsland>
        <Avatar size="lg">
          <AvatarImage src={demoAvatar("🦊", "#f97316")} alt="" />
          <AvatarFallback>O</AvatarFallback>
        </Avatar>
      </NavbarIsland>
    </div>
  )
}

/** What the panel of the most crowded game says, on its own, in the box a `PopoverContent` makes of it. */
export function BarListSpecimen() {
  const entry = gamesOf(FRIENDS)[0]
  if (!entry) return null
  return (
    <div className="flex w-72 flex-col gap-6 rounded-3xl border bg-popover p-4 text-popover-foreground shadow-float">
      <FriendsBarList entry={entry} onJoin={() => {}} />
    </div>
  )
}

const REQUESTS: readonly FriendRequest[] = [
  { id: "r1", nickname: "Nolan", tag: "6150", avatarUrl: demoAvatar("🐺", "#64748b"), direction: "incoming" },
  { id: "r2", nickname: "Clara", tag: "8827", avatarUrl: demoAvatar("🐳", "#3b82f6"), direction: "incoming" },
  { id: "r3", nickname: "Yann", tag: "3069", avatarUrl: demoAvatar("🦔", "#d97706"), direction: "outgoing" },
]

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

/** The conversations of the specimens, with times counted back from the page being opened. */
function conversations(): Conversation[] {
  const [, hervé, zoé, tom] = FRIENDS
  if (!hervé || !zoé || !tom) return []
  return [
    {
      id: "c1",
      friend: MARLY,
      unread: 2,
      messages: [
        { id: "m1", from: "them", text: "You up for a few games?", at: ago(26) },
        { id: "m2", from: "me", text: "Jumping on now. Let me see if anyone else wants to play", at: ago(24) },
        { id: "m3", from: "them", text: "Will set up a table", at: ago(4) },
        { id: "m4", from: "them", text: "Table is up: Courtisans or Skull King?", at: ago(2) },
      ],
    },
    { id: "c2", friend: hervé, unread: 1, messages: [{ id: "m5", from: "them", text: "Starting a Skull King, are you joining?", at: ago(65) }] },
    { id: "c3", friend: tom, unread: 0, messages: [{ id: "m6", from: "me", text: "Hop on, we need a fourth for Courtisans", at: ago(130) }] },
    { id: "c4", friend: zoé, unread: 0, messages: [{ id: "m7", from: "me", text: "gg, rematch next time", at: ago(60 * 26) }] },
  ]
}

/**
 * The social panel in a column as high as a page gives it, on one of its tabs, with its friends, its conversations and its requests, or with none. The buttons do
 * nothing here, and the search and the tabs work.
 */
export function SocialSpecimen({ tab = "friends", empty = false }: { tab?: SocialTab; empty?: boolean }) {
  const nothing = () => {}
  const chats = useMemo(() => conversations(), [])
  return (
    <SocialPanel
      className="h-[34rem] w-full"
      header={
        <div className="flex items-center gap-3 p-1">
          <Avatar>
            <AvatarImage src={demoAvatar("🦊", "#f97316")} alt="" />
            <AvatarFallback>O</AvatarFallback>
            <PresenceDot status="online" />
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-foreground">Oré</span>
            <span className="block truncate text-xs text-presence-online">Online</span>
          </span>
        </div>
      }
      onClose={nothing}
      defaultTab={tab}
      friends={empty ? [] : FRIENDS}
      conversations={empty ? [] : chats}
      requests={empty ? [] : REQUESTS}
      onOpenChat={nothing}
      onJoin={nothing}
      onInvite={nothing}
      onSendRequest={nothing}
      onAnswerRequest={nothing}
      onShareLink={nothing}
    />
  )
}

/** The chat window with a friend, whose field sends: what is written is added to the conversation, and goes nowhere. */
export function ChatSpecimen() {
  const [messages, setMessages] = useState<readonly Message[]>(() => conversations()[0]?.messages ?? [])
  return (
    <ChatWindow
      className="h-96 w-full max-w-sm"
      friend={MARLY}
      messages={messages}
      onSend={(text) => setMessages((all) => [...all, { id: `sent-${all.length}`, from: "me", text, at: new Date().toISOString() }])}
      onClose={() => {}}
    />
  )
}
