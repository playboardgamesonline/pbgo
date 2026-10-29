import type { Account, PlayedGame } from "@pbgo/accounts"
import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import type { Friend } from "@pbgo/ui/friends"
import type { FriendRequest } from "@pbgo/ui/social"
import { DEMO_FRIENDS, DEMO_GAMES, DEMO_REQUESTS } from "./demo-data"

// What the pages of an account list: the games a visitor played and their friends. Neither exists yet: both are in the platform schema that comes with PLT-13
// (the tables, the results, the players) and PLT-23 (the friends), so a real account has none, and its pages say so. The demo account of development
// (`@pbgo/accounts/demo`) has made-up ones (`demo-data.ts`), to see the pages as they will be; nothing here ever reaches a deployment, where that account does
// not exist. The friends, conversations and requests of the social panel on every page are `use-social.ts`'s, which reads the same ones.

export type { FriendRequest }

export type AccountData = { friends: readonly Friend[]; requests: readonly FriendRequest[]; games: readonly PlayedGame[] }

const NOBODY: AccountData = { friends: [], requests: [], games: [] }

const DEMO: AccountData = { friends: DEMO_FRIENDS, requests: DEMO_REQUESTS, games: DEMO_GAMES }

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
