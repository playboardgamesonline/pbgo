// The demo account of development: a way to see the pages of a signed-in visitor on a machine where no provider is set up (docs/accounts.md). It is
// a cookie that a development server alone honours (`/auth/demo` sets it, and answers 404 in a build), and the account it stands for is not in any
// database. Pure, so that the server, the browser and the tests read it the same way.

import type { Account } from "./account"

/** The cookie that says the visitor is the demo account. Readable by the browser, since it holds nothing. */
export const DEMO_COOKIE = "pbgo_demo_account"

/**
 * A made-up picture for the demo account and its friends: an emoji on a colour, drawn as an SVG that needs no file (`apps/web/public` holds none, and the
 * pictures of the people of the demo are not anywhere else). A data URI, so that it works offline. Like the rest of the demo, for development.
 */
export function demoAvatar(emoji: string, colour: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="${colour}"/><text x="48" y="52" font-size="54" text-anchor="middle" dominant-baseline="central">${emoji}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** The demo account: a name and a made-up picture. */
export const DEMO_ACCOUNT: Account = {
  id: "demo",
  nickname: "Oré",
  email: null,
  avatarUrl: demoAvatar("🦊", "#f97316"),
  provider: null,
  createdAt: "2026-10-01T09:00:00.000Z",
}

/** Whether this code runs in development: the one case where the demo account exists. Inlined by the build, so a production bundle holds none of it. */
export const demoAllowed = (): boolean => process.env.NODE_ENV !== "production"
