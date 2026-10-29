import type { Metadata } from "next"
import type { ReactNode } from "react"
import { requireAccount } from "@pbgo/accounts/server"
import { AccountNav } from "@/components/account-nav"
import { AccountShell } from "@/components/account-shell"
import { ProfileHeader } from "@/components/profile-header"

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
}

/**
 * The pages of a signed-in visitor, `/me`: their profile, their games, their friends. The frame is the same on each: the header with their name and the links
 * from one page to the next (the games their friends are in, on every page of the hub, are the bar of the navbar). A visitor who is not signed in is sent to the sign-in (the
 * proxy does it first, with the page they asked for; this is the second check), and the pages are rendered per request, since they hold someone's account.
 */
export default async function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  const account = await requireAccount("/me")
  return (
    <AccountShell>
      <ProfileHeader account={account} />
      <AccountNav className="mt-8" />
      <div className="pt-8">{children}</div>
    </AccountShell>
  )
}
