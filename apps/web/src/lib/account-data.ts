import type { Account, PlayedGame } from "@pbgo/accounts"
import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import type { Friend } from "@pbgo/ui/platform/friends-panel"

// What the pages of an account list: the games a visitor played and their friends. Neither exists yet: both are in the platform schema that comes with PLT-13
// (the tables, the results, the players) and PLT-23 (the friends), so a real account has none, and its pages say so. The demo account of development
// (`@pbgo/accounts/demo`) has made-up ones, to see the pages as they will be; nothing here ever reaches a deployment, where that account does not exist.

/** A friend who asked to be, or was asked: waiting for an answer. */
export type FriendRequest = { id: string; nickname: string; tag: string; direction: "incoming" | "outgoing" }

export type AccountData = { friends: readonly Friend[]; requests: readonly FriendRequest[]; games: readonly PlayedGame[] }

const NOBODY: AccountData = { friends: [], requests: [], games: [] }

const DEMO: AccountData = {
  friends: [
    { id: "f1", nickname: "Marly", tag: "4821", status: "playing", activity: "Courtisans · table K7P" },
    { id: "f2", nickname: "Hervé", tag: "0412", status: "playing", activity: "Skull King · table 9QD" },
    { id: "f3", nickname: "Zoé", tag: "1033", status: "online", activity: "In the lobby" },
    { id: "f4", nickname: "Tom", tag: "7712", status: "online" },
    { id: "f5", nickname: "Lina", tag: "2290", status: "online" },
    { id: "f6", nickname: "Max", tag: "5501", status: "offline", activity: "2 h ago" },
    { id: "f7", nickname: "Inès", tag: "3318", status: "offline", activity: "Yesterday" },
    { id: "f8", nickname: "Sam", tag: "9042", status: "offline", activity: "3 days ago" },
  ],
  requests: [
    { id: "r1", nickname: "Nolan", tag: "6150", direction: "incoming" },
    { id: "r2", nickname: "Clara", tag: "8827", direction: "incoming" },
    { id: "r3", nickname: "Yann", tag: "3069", direction: "outgoing" },
  ],
  games: [
    { id: "g1", slug: "courtisans", name: "Courtisans", playedAt: "2026-10-29T20:41:00Z", table: "K7P", opponents: [{ nickname: "Marly" }, { nickname: "Hervé" }], state: "in-progress" },
    { id: "g2", slug: "skull-king", name: "Skull King", playedAt: "2026-10-29T18:05:00Z", table: "9QD", opponents: [{ nickname: "Zoé" }, { nickname: "Tom" }, { nickname: "Lina" }], state: "in-progress" },
    { id: "g3", slug: "courtisans", name: "Courtisans", playedAt: "2026-10-28T21:12:00Z", table: "M3T", opponents: [{ nickname: "Marly" }, { nickname: "Max" }], state: "finished", result: "won", rank: 1 },
    { id: "g4", slug: "love-letter", name: "Love Letter", playedAt: "2026-10-27T19:30:00Z", table: "B8C", opponents: [{ nickname: "Inès" }, { nickname: "Sam" }, { nickname: "Tom" }], state: "finished", result: "lost", rank: 3 },
    { id: "g5", slug: "hanabi", name: "Hanabi", playedAt: "2026-10-24T20:00:00Z", table: "H2X", opponents: [{ nickname: "Zoé" }], state: "finished", result: "won", rank: 1 },
    { id: "g6", slug: "courtisans", name: "Courtisans", playedAt: "2026-10-22T22:48:00Z", table: "P5R", opponents: [{ nickname: "Hervé" }, { nickname: "Lina" }, { nickname: "Max" }], state: "finished", result: "lost", rank: 2 },
    { id: "g7", slug: "skyjo", name: "Skyjo", playedAt: "2026-10-19T17:15:00Z", table: "W9N", opponents: [{ nickname: "Sam" }, { nickname: "Inès" }], state: "finished", result: "draw", rank: 1 },
  ],
}

/** What the pages of an account list for this visitor. */
export function accountData(account: Account): AccountData {
  return account.id === DEMO_ACCOUNT.id ? DEMO : NOBODY
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })

/** "28 Oct, 21:12": when a game started, in UTC so that the server and the browser write the same thing. */
export const gameDate = (iso: string): string => DATE.format(new Date(iso))

/** "October 2026": since when an account exists. */
export const monthOf = (iso: string): string => MONTH.format(new Date(iso))
