import type { Metadata } from "next"
import type { ReactNode } from "react"
import { requireAccount } from "@pbgo/accounts/server"

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
}

/**
 * Everything under `/me`: the profile of a signed-in visitor, their career (the games they finished and their ranks) and their settings, which open as a window over the page they are on (`@modal`, `docs/routing.md`). A visitor who is not signed in is sent to
 * the sign-in (the proxy does it first, with the page they asked for; this is the second check), and the pages are rendered per request, since they hold someone's account. The profile has the frame of its own (`profile/layout.tsx`: its header), so
 * that the career and the settings, which have a frame of their own, are not drawn under it.
 */
export default async function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireAccount("/me")
  return children
}
