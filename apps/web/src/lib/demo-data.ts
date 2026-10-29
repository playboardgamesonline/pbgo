import type { PlayedGame } from "@pbgo/accounts"
import { demoAvatar } from "@pbgo/accounts/demo"
import type { Friend } from "@pbgo/ui/friends"
import type { Conversation, FriendRequest } from "@pbgo/ui/social"

// The made-up friends, requests, conversations and games of the demo account of development (`@pbgo/accounts/demo`), in a file of their own so that the browser loads
// them in development only (`use-social.ts`): nothing here ever reaches a deployment, where that account does not exist.

const COURTISANS = { slug: "courtisans", name: "Courtisans" }
const SKULL_KING = { slug: "skull-king", name: "Skull King" }
const HANABI = { slug: "hanabi", name: "Hanabi" }

const MARLY: Friend = { id: "f1", nickname: "Marly", tag: "4821", avatarUrl: demoAvatar("🐙", "#8b5cf6"), status: "playing", game: COURTISANS, table: { code: "K7P", size: 3, max: 4 }, activity: "Table K7P · 12 min" }
const HERVE: Friend = { id: "f2", nickname: "Hervé", tag: "0412", avatarUrl: demoAvatar("🦉", "#0ea5e9"), status: "playing", game: SKULL_KING, table: { code: "9QD", size: 4, max: 6 }, activity: "Table 9QD · 4 min" }
const ZOE: Friend = { id: "f3", nickname: "Zoé", tag: "1033", avatarUrl: demoAvatar("🐼", "#14b8a6"), status: "online", game: COURTISANS, table: { code: "M3R", size: 2, max: 4 }, activity: "In the lobby" }
const TOM: Friend = { id: "f4", nickname: "Tom", tag: "7712", avatarUrl: demoAvatar("🐯", "#f59e0b"), status: "online", game: COURTISANS, table: { code: "M3R", size: 2, max: 4 }, activity: "In the lobby" }
const LINA: Friend = { id: "f5", nickname: "Lina", tag: "2290", avatarUrl: demoAvatar("🐸", "#22c55e"), status: "inactive", game: HANABI, activity: "Inactive · 8 min" }
const JADE: Friend = { id: "f9", nickname: "Jade", tag: "6604", avatarUrl: demoAvatar("🦄", "#ec4899"), status: "online", activity: "On the hub" }
const MAX: Friend = { id: "f6", nickname: "Max", tag: "5501", avatarUrl: demoAvatar("🐧", "#6366f1"), status: "offline", activity: "2 h ago" }
const INES: Friend = { id: "f7", nickname: "Inès", tag: "3318", avatarUrl: demoAvatar("🦋", "#06b6d4"), status: "offline", activity: "Yesterday" }
const SAM: Friend = { id: "f8", nickname: "Sam", tag: "9042", avatarUrl: demoAvatar("🐻", "#a16207"), status: "offline", activity: "3 days ago" }

export const DEMO_FRIENDS: readonly Friend[] = [MARLY, HERVE, ZOE, TOM, LINA, JADE, MAX, INES, SAM]

export const DEMO_REQUESTS: readonly FriendRequest[] = [
  { id: "r1", nickname: "Nolan", tag: "6150", avatarUrl: demoAvatar("🐺", "#64748b"), direction: "incoming" },
  { id: "r2", nickname: "Clara", tag: "8827", avatarUrl: demoAvatar("🐳", "#3b82f6"), direction: "incoming" },
  { id: "r3", nickname: "Yann", tag: "3069", avatarUrl: demoAvatar("🦔", "#d97706"), direction: "outgoing" },
]

const ago = (minutes: number, now: number) => new Date(now - minutes * 60_000).toISOString()

/** The conversations of the demo account, with times counted back from `now`, so that they are as fresh as the page. */
export function demoConversations(now: number): readonly Conversation[] {
  return [
    {
      id: "c1",
      friend: MARLY,
      unread: 2,
      messages: [
        { id: "c1-1", from: "them", text: "You up for a few games?", at: ago(26, now) },
        { id: "c1-2", from: "me", text: "Jumping on now. Let me see if anyone else wants to play", at: ago(24, now) },
        { id: "c1-3", from: "them", text: "Will set up a table", at: ago(4, now) },
        { id: "c1-4", from: "them", text: "Table is up: Courtisans or Skull King?", at: ago(2, now) },
      ],
    },
    { id: "c2", friend: HERVE, unread: 1, messages: [{ id: "c2-1", from: "them", text: "Starting a Skull King, are you joining?", at: ago(65, now) }] },
    { id: "c3", friend: TOM, unread: 0, messages: [{ id: "c3-1", from: "me", text: "Hop on, we need a fourth for Courtisans", at: ago(130, now) }] },
    { id: "c4", friend: LINA, unread: 0, messages: [{ id: "c4-1", from: "them", text: "Hanabi tonight?", at: ago(60 * 6, now) }] },
    { id: "c5", friend: ZOE, unread: 0, messages: [{ id: "c5-1", from: "me", text: "gg, rematch next time", at: ago(60 * 26, now) }] },
    { id: "c6", friend: SAM, unread: 0, messages: [{ id: "c6-1", from: "them", text: "Bring snacks", at: ago(60 * 24 * 2, now) }] },
  ]
}

export const DEMO_GAMES: readonly PlayedGame[] = [
  { id: "g1", slug: "courtisans", name: "Courtisans", playedAt: "2026-10-29T20:41:00Z", table: "K7P", opponents: [{ nickname: "Marly" }, { nickname: "Hervé" }], state: "in-progress" },
  { id: "g2", slug: "skull-king", name: "Skull King", playedAt: "2026-10-29T18:05:00Z", table: "9QD", opponents: [{ nickname: "Zoé" }, { nickname: "Tom" }, { nickname: "Lina" }], state: "in-progress" },
  { id: "g3", slug: "courtisans", name: "Courtisans", playedAt: "2026-10-28T21:12:00Z", table: "M3T", opponents: [{ nickname: "Marly" }, { nickname: "Max" }], state: "finished", result: "won", rank: 1 },
  { id: "g4", slug: "love-letter", name: "Love Letter", playedAt: "2026-10-27T19:30:00Z", table: "B8C", opponents: [{ nickname: "Inès" }, { nickname: "Sam" }, { nickname: "Tom" }], state: "finished", result: "lost", rank: 3 },
  { id: "g5", slug: "hanabi", name: "Hanabi", playedAt: "2026-10-24T20:00:00Z", table: "H2X", opponents: [{ nickname: "Zoé" }], state: "finished", result: "won", rank: 1 },
  { id: "g6", slug: "courtisans", name: "Courtisans", playedAt: "2026-10-22T22:48:00Z", table: "P5R", opponents: [{ nickname: "Hervé" }, { nickname: "Lina" }, { nickname: "Max" }], state: "finished", result: "lost", rank: 2 },
  { id: "g7", slug: "skyjo", name: "Skyjo", playedAt: "2026-10-19T17:15:00Z", table: "W9N", opponents: [{ nickname: "Sam" }, { nickname: "Inès" }], state: "finished", result: "draw", rank: 1 },
]
