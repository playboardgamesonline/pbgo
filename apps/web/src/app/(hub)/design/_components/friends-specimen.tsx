"use client"

import { useMemo, useState } from "react"
import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import { DEMO_AVATARS } from "@pbgo/accounts/demo-avatars"
import { Avatar, AvatarCount, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { ChatWindow } from "@pbgo/ui/platform/chat-window"
import { FriendsBar, FriendsBarList } from "@pbgo/ui/platform/friends-bar"
import { FriendsPanel, PresenceDot } from "@pbgo/ui/platform/friends-panel"
import { NavbarIsland } from "@pbgo/ui/platform/navbar"
import { Separator } from "@pbgo/ui/platform/separator"
import { SocialDock, SocialDockIdentity } from "@pbgo/ui/platform/social-dock"
import { SocialPanel, SocialPanelToggle, type SocialTab } from "@pbgo/ui/platform/social-panel"
import { gamesOf, type Friend } from "@pbgo/ui/friends"
import type { Conversation, FriendRequest, Message } from "@pbgo/ui/social"

/** The picture of a game on the hub: its icon in the catalog (an initial on a tile where there is none). */
const gameIcon = (slug: string) => `/api/catalog/${slug}/icon`

const COURTISANS = { slug: "courtisans", name: "Courtisans" }
const SKULL_KING = { slug: "skull-king", name: "Skull King" }
const HANABI = { slug: "hanabi", name: "Hanabi" }

const MARLY: Friend = { id: "1", nickname: "Marly", tag: "4821", avatarUrl: DEMO_AVATARS.marly, status: "playing", game: COURTISANS, table: { code: "K7P", size: 3, max: 4 }, activity: "Table K7P · 12 min" }

const FRIENDS: readonly Friend[] = [
  MARLY,
  { id: "2", nickname: "Hervé", tag: "0412", avatarUrl: DEMO_AVATARS.herve, status: "playing", game: SKULL_KING, table: { code: "9QD", size: 4, max: 6 }, activity: "Table 9QD · 4 min" },
  { id: "3", nickname: "Zoé", tag: "1033", avatarUrl: DEMO_AVATARS.zoe, status: "online", game: COURTISANS, table: { code: "M3R", size: 2, max: 4 }, activity: "In the lobby" },
  { id: "4", nickname: "Tom", tag: "7712", avatarUrl: DEMO_AVATARS.tom, status: "online", game: COURTISANS, table: { code: "M3R", size: 2, max: 4 }, activity: "In the lobby" },
  { id: "5", nickname: "Lina", tag: "2290", avatarUrl: DEMO_AVATARS.lina, status: "inactive", game: HANABI, activity: "Inactive · 8 min" },
  { id: "6", nickname: "Jade", tag: "6604", avatarUrl: DEMO_AVATARS.jade, status: "dnd", activity: "Do not disturb" },
  { id: "7", nickname: "Max", tag: "5501", avatarUrl: DEMO_AVATARS.max, status: "offline", activity: "2 h ago" },
  { id: "8", nickname: "Inès", tag: "3318", avatarUrl: DEMO_AVATARS.ines, status: "offline", activity: "Yesterday" },
  { id: "9", nickname: "Sam", tag: "9042", avatarUrl: DEMO_AVATARS.sam, status: "offline", activity: "3 days ago" },
]

/**
 * The friends' panel with every button it can have, in a column as high as a page: with friends, then with none. The buttons do nothing here, and the search
 * works.
 */
export function FriendsSpecimen({ empty = false }: { empty?: boolean }) {
  const nothing = () => {}
  return (
    <div className="h-[34rem] w-full">
      <FriendsPanel friends={empty ? [] : FRIENDS} gameIcon={gameIcon} onAddFriend={nothing} onInvite={nothing} onJoin={nothing} onShareLink={nothing} />
    </div>
  )
}

/**
 * The friends' bar in an island of its own, at the right of a frame that stands for the navbar (the bar draws no container: the dock is the one that holds it on the hub): left to
 * itself it opens the panel of a game under the pointer, over the page. The buttons do nothing here.
 */
export function BarSpecimen({ empty = false }: { empty?: boolean }) {
  const nothing = () => {}
  return (
    <div className="flex h-72 w-full items-start justify-end rounded-3xl border bg-card/40 p-6">
      <NavbarIsland>
        <FriendsBar friends={empty ? [] : FRIENDS} gameIcon={gameIcon} onJoin={nothing} onShareLink={nothing} />
      </NavbarIsland>
    </div>
  )
}

/**
 * The dock in a frame that stands for the page: the container that is the bar of the games, the profile and the social panel at once. The button of the bar opens it into a side
 * panel and closes it back into the bar, the same element changing between the two (its width, its height and its corners, with the panel fading in under the bar). The buttons of
 * the panel do nothing here, and its tabs and its search work.
 */
export function DockSpecimen() {
  const nothing = () => {}
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<SocialTab>("friends")
  const chats = useMemo(() => conversations(), [])
  return (
    <div className="relative h-[40rem] w-full overflow-hidden rounded-3xl border bg-card/40">
      <div className="absolute top-6 right-6">
        <SocialDock
          open={open}
          height={592}
          games={
            <>
              <FriendsBar friends={FRIENDS} gameIcon={gameIcon} onJoin={nothing} onShareLink={nothing} />
              <Separator orientation="vertical" className="mx-1 h-6 self-center" />
            </>
          }
          profile={
            <button type="button" aria-label="Account of Oré, 3 waiting" className="flex min-w-0 items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
              <Avatar>
                <AvatarImage src={DEMO_ACCOUNT.avatarUrl ?? undefined} alt="" />
                <AvatarFallback>O</AvatarFallback>
                <AvatarCount count={3} />
                <PresenceDot status="online" />
              </Avatar>
              <SocialDockIdentity>
                <span className="truncate text-lg leading-tight font-strong text-foreground">Oré</span>
                <span className="truncate text-xs text-muted-foreground">Online</span>
              </SocialDockIdentity>
            </button>
          }
          toggle={<SocialPanelToggle open={open} aria-controls="design-social-panel" onClick={() => setOpen((value) => !value)} />}
        >
          <SocialPanel
            bare
            id="design-social-panel"
            tab={tab}
            onTabChange={setTab}
            friends={FRIENDS}
            gameIcon={gameIcon}
            conversations={chats}
            requests={REQUESTS}
            onOpenChat={nothing}
            onJoin={nothing}
            onInvite={nothing}
            onNote={nothing}
            onSendRequest={nothing}
            onAnswerRequest={nothing}
            onShareLink={nothing}
          />
        </SocialDock>
      </div>
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
  { id: "r1", nickname: "Nolan", tag: "6150", avatarUrl: DEMO_AVATARS.nolan, direction: "incoming" },
  { id: "r2", nickname: "Clara", tag: "8827", avatarUrl: DEMO_AVATARS.clara, direction: "incoming" },
  { id: "r3", nickname: "Yann", tag: "3069", avatarUrl: DEMO_AVATARS.yann, direction: "outgoing" },
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
            <AvatarImage src={DEMO_ACCOUNT.avatarUrl ?? undefined} alt="" />
            <AvatarFallback>O</AvatarFallback>
            <PresenceDot status="online" />
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-foreground">Oré</span>
            <span className="block truncate text-xs text-muted-foreground">Online</span>
          </span>
        </div>
      }
      defaultTab={tab}
      friends={empty ? [] : FRIENDS}
      gameIcon={gameIcon}
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
      onJoin={() => {}}
      onRemove={() => {}}
      onBlock={() => {}}
    />
  )
}

/** One picture each, of different styles, for the five dots of the legend. */
const LEGEND_AVATARS = [DEMO_AVATARS.marly, DEMO_AVATARS.herve, DEMO_AVATARS.zoe, DEMO_AVATARS.tom, DEMO_AVATARS.max] as const

const DOTS = [
  { status: "online", label: "Active", detail: "a green disc" },
  { status: "playing", label: "Playing", detail: "a blue disc, a play knocked out" },
  { status: "inactive", label: "Inactive", detail: "an orange-yellow moon" },
  { status: "dnd", label: "Do not disturb", detail: "a red disc, a bar knocked out" },
  { status: "offline", label: "Offline", detail: "a thick grey ring" },
] as const

/** The five dots of presence, on the three sizes of an avatar, each with its word: a shape, a colour and a word, never the colour alone. */
export function PresenceLegend() {
  return (
    <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {DOTS.map(({ status, label, detail }, index) => (
        <div key={status} className="flex flex-col gap-3 rounded-3xl border p-4">
          <div className="flex items-end gap-3">
            {(["sm", "default", "lg"] as const).map((size) => (
              <Avatar key={size} size={size}>
                <AvatarImage src={LEGEND_AVATARS[index] ?? DEMO_AVATARS.marly} alt="" />
                <AvatarFallback>M</AvatarFallback>
                <PresenceDot status={status} />
              </Avatar>
            ))}
          </div>
          <div>
            <p className="text-sm text-foreground">{label}</p>
            <p className="text-sm text-muted-foreground">{detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
