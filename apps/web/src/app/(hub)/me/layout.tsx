import type { Metadata } from "next"
import type { ReactNode } from "react"
import { requireAccount } from "@pbgo/accounts/server"

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
}

/**
 * Everything under `/me`: the profile of a signed-in visitor, the games they played, their friends, and their settings, which open as a window over the page they are on (`@modal`, `docs/routing.md`). A visitor who is not signed in is sent to
 * the sign-in (the proxy does it first, with the page they asked for; this is the second check), and the pages are rendered per request, since they hold someone's account. The frame of the profile is its own layout (`(profile)`), so
 * that the settings, which have a frame of their own, are not drawn under the profile's header.
 */
export default async function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireAccount("/me")
  return children
}
