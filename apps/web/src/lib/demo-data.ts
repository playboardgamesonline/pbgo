import type { PlayedGame } from "@pbgo/accounts"
import type { Person } from "@pbgo/core/lib/friends"
import { DEMO_AVATARS } from "@pbgo/accounts/demo-avatars"
import type { Friend } from "@pbgo/ui/friends"
import type { Conversation, FriendRequest } from "@pbgo/ui/social"

// The made-up friends, requests, conversations and games of the demo account of development (`@pbgo/accounts/demo`), in a file of their own so that the browser loads
// them in development only (`use-social.ts`): nothing here ever reaches a deployment, where that account does not exist.

const COURTISANS = { slug: "courtisans", name: "Courtisans" }
const SKULL_KING = { slug: "skull-king", name: "Skull King" }
const HANABI = { slug: "hanabi", name: "Hanabi" }

const MARLY: Friend = { id: "f1", nickname: "Marly", tag: "4821", avatarUrl: DEMO_AVATARS.marly, status: "playing", game: COURTISANS, table: { code: "K7P", size: 3, max: 4 }, activity: "Table K7P · 12 min" }
const HERVE: Friend = { id: "f2", nickname: "Hervé", tag: "0412", avatarUrl: DEMO_AVATARS.herve, status: "playing", game: SKULL_KING, table: { code: "9QD", size: 4, max: 6 }, activity: "Table 9QD · 4 min" }
const ZOE: Friend = { id: "f3", nickname: "Zoé", tag: "1033", avatarUrl: DEMO_AVATARS.zoe, status: "online", game: COURTISANS, table: { code: "M3R", size: 2, max: 4 }, activity: "In the lobby" }
const TOM: Friend = { id: "f4", nickname: "Tom", tag: "7712", avatarUrl: DEMO_AVATARS.tom, status: "online", game: COURTISANS, table: { code: "M3R", size: 2, max: 4 }, activity: "In the lobby" }
const LINA: Friend = { id: "f5", nickname: "Lina", tag: "2290", avatarUrl: DEMO_AVATARS.lina, status: "inactive", game: HANABI, activity: "Inactive · 8 min" }
const JADE: Friend = { id: "f9", nickname: "Jade", tag: "6604", avatarUrl: DEMO_AVATARS.jade, status: "dnd", activity: "Do not disturb" }
const MAX: Friend = { id: "f6", nickname: "Max", tag: "5501", avatarUrl: DEMO_AVATARS.max, status: "offline", activity: "2 h ago" }
const INES: Friend = { id: "f7", nickname: "Inès", tag: "3318", avatarUrl: DEMO_AVATARS.ines, status: "offline", activity: "Yesterday" }
const SAM: Friend = { id: "f8", nickname: "Sam", tag: "9042", avatarUrl: DEMO_AVATARS.sam, status: "offline", activity: "3 days ago" }

export const DEMO_FRIENDS: readonly Friend[] = [MARLY, HERVE, ZOE, TOM, LINA, JADE, MAX, INES, SAM]

export const DEMO_REQUESTS: readonly FriendRequest[] = [
  { id: "r1", nickname: "Nolan", tag: "6150", avatarUrl: DEMO_AVATARS.nolan, direction: "incoming" },
  { id: "r2", nickname: "Clara", tag: "8827", avatarUrl: DEMO_AVATARS.clara, direction: "incoming" },
  { id: "r3", nickname: "Yann", tag: "3069", avatarUrl: DEMO_AVATARS.yann, direction: "outgoing" },
]

/** The players the demo account blocked (PLT-23), with no picture: their initial stands in. */
export const DEMO_BLOCKED: readonly Person[] = [
  { nickname: "Rex", tag: 1234, avatarUrl: null },
  { nickname: "Vic", tag: 7, avatarUrl: null },
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

// Their opponents are the demo friends: their pictures, and the handle that a member has (the page it leads to is that of a made-up member, which has no profile in any database). A record is what the card of a player says: their rank in the game and the games of it they won.
const O = {
  marly: { nickname: "Marly", avatarUrl: DEMO_AVATARS.marly, handle: { nickname: "Marly", tag: 4821 }, record: { rank: { tier: "Gold", division: 3 }, gamesPlayed: 41, wins: 19 } },
  herve: { nickname: "Hervé", avatarUrl: DEMO_AVATARS.herve, handle: { nickname: "Hervé", tag: 412 }, record: { rank: { tier: "Silver", division: 1 }, gamesPlayed: 23, wins: 9 } },
  max: { nickname: "Max", avatarUrl: DEMO_AVATARS.max, handle: { nickname: "Max", tag: 5501 } },
  zoe: { nickname: "Zoé", avatarUrl: DEMO_AVATARS.zoe, handle: { nickname: "Zoé", tag: 1033 }, record: { rank: { tier: "Silver", division: 2 }, gamesPlayed: 12, wins: 6 } },
  tom: { nickname: "Tom", avatarUrl: DEMO_AVATARS.tom, handle: { nickname: "Tom", tag: 7712 } },
  lina: { nickname: "Lina", avatarUrl: DEMO_AVATARS.lina, handle: { nickname: "Lina", tag: 2290 } },
  ines: { nickname: "Inès", avatarUrl: DEMO_AVATARS.ines, handle: { nickname: "Inès", tag: 3318 } },
  sam: { nickname: "Sam", avatarUrl: DEMO_AVATARS.sam },
} as const

// The games of the demo account: what a finished game says of itself is what a real one has (`playedGameOf`): the table as it was played (ranked or normal, its speed, how long it lasted, its expansions), the score where the game counts points and how many sat at it.
export const DEMO_GAMES: readonly PlayedGame[] = [
  { id: "g1", slug: "courtisans", name: "Courtisans", playedAt: "2026-10-29T20:41:00Z", table: "K7P", opponents: [O.marly, O.herve], state: "in-progress" },
  { id: "g2", slug: "skull-king", name: "Skull King", playedAt: "2026-10-29T18:05:00Z", table: "9QD", opponents: [O.zoe, O.tom, O.lina], state: "in-progress" },
  { id: "g3", slug: "courtisans", name: "Courtisans", playedAt: "2026-10-28T21:12:00Z", opponents: [O.marly, O.max], state: "finished", result: "won", rank: 1, points: 18, score: 31, ranked: true, playerCount: 3, durationSeconds: 1680, pace: "normal", expansions: ["Diplomats & Confidants"] },
  { id: "g4", slug: "love-letter", name: "Love Letter", playedAt: "2026-10-27T19:30:00Z", opponents: [O.ines, O.sam, O.tom], state: "finished", result: "lost", rank: 3, ranked: false, playerCount: 4, durationSeconds: 540, pace: "fast" },
  { id: "g5", slug: "hanabi", name: "Hanabi", playedAt: "2026-10-24T20:00:00Z", opponents: [O.zoe], state: "finished", result: "won", score: 23, ranked: false, playerCount: 2, durationSeconds: 1320, pace: "none", expansions: ["Black Powder"] },
  { id: "g6", slug: "courtisans", name: "Courtisans", playedAt: "2026-10-22T22:48:00Z", opponents: [O.herve, O.lina, O.max], state: "finished", result: "lost", rank: 2, points: -12, score: 19, ranked: true, playerCount: 4, durationSeconds: 2100, pace: "slow" },
  { id: "g7", slug: "skyjo", name: "Skyjo", playedAt: "2026-10-19T17:15:00Z", opponents: [O.sam, O.ines], state: "finished", result: "draw", rank: 1, points: 0, score: 42, ranked: true, playerCount: 3, durationSeconds: 960, pace: "async" },
]
