// The demo account of development: a way to see the pages of a signed-in visitor on a machine where no provider is set up (docs/accounts.md). It is
// a cookie that a development server alone honours (`/auth/demo` sets it, and answers 404 in a build), and the account it stands for is not in any
// database. Pure, so that the server, the browser and the tests read it the same way.

import type { Account } from "./account"

/** The cookie that says the visitor is the demo account. Readable by the browser, since it holds nothing. */
export const DEMO_COOKIE = "pbgo_demo_account"

/** The demo account: a name and no picture, which draws the initials. */
export const DEMO_ACCOUNT: Account = { id: "demo", nickname: "Oré", email: null, avatarUrl: null, provider: null, createdAt: "2026-10-01T09:00:00.000Z" }

/** Whether this code runs in development: the one case where the demo account exists. Inlined by the build, so a production bundle holds none of it. */
export const demoAllowed = (): boolean => process.env.NODE_ENV !== "production"
