import type { Account, TimeFormat } from "@pbgo/accounts"
import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import type { Friend } from "@pbgo/ui/friends"
import type { FriendRequest } from "@pbgo/ui/social"
import { DEMO_FRIENDS, DEMO_REQUESTS } from "./demo-data"
import { perTimeFormat } from "./time-format"

// What the pages of an account list for the demo account of development (`@pbgo/accounts/demo`): its made-up friends and requests (`demo-data.ts`), to see the pages as they will be; nothing here ever reaches a deployment, where that account does
// not exist. A real account's friends and requests are the database's (PLT-23): the pages read them on the server (`social-state.ts`) and the social panel on every page, in the browser (`use-social.ts`). The games a visitor played are `member-games.ts`'s: they are recorded (PLT-13).

export type { FriendRequest }

export type AccountData = { friends: readonly Friend[]; requests: readonly FriendRequest[] }

const NOBODY: AccountData = { friends: [], requests: [] }

const DEMO: AccountData = { friends: DEMO_FRIENDS, requests: DEMO_REQUESTS }

/** What the pages of an account list for this visitor: the made-up friends and requests of the demo account, nobody for any other (a real account's are read from the database). */
export function accountData(account: Account): AccountData {
  return account.id === DEMO_ACCOUNT.id ? DEMO : NOBODY
}

const DATE = perTimeFormat(({ hourCycle, hour }) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour, minute: "2-digit", hourCycle, timeZone: "UTC" }))
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })

/** "28 Oct, 21:12", or "28 Oct, 9:12 pm" when the member chose the clock of 12 hours: when a game started, in UTC so that the server and the browser write the same thing. */
export const gameDate = (iso: string, format: TimeFormat = "auto"): string => DATE[format].format(new Date(iso))

/** "October 2026": since when an account exists. */
export const monthOf = (iso: string): string => MONTH.format(new Date(iso))
