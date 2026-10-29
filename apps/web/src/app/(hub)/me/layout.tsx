import type { Metadata } from "next"
import type { ReactNode } from "react"
import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import { requireAccount } from "@pbgo/accounts/server"
import { AccountNav } from "@/components/account-nav"
import { AccountShell } from "@/components/account-shell"
import { ProfileHeader } from "@/components/profile-header"
import { accountData } from "@/lib/account-data"

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
}

/**
 * The pages of a signed-in visitor, `/me`: their profile, their games, their friends. The frame is the same on each: the header with their name, the
 * links from one page to the next, and the friends' panel at the side. A visitor who is not signed in is sent to the sign-in (the proxy does it
 * first, with the page they asked for; this is the second check), and the pages are rendered per request, since they hold someone's account.
 */
export default async function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  const account = await requireAccount("/me")
  const { friends } = accountData(account)
  const preview = account.id === DEMO_ACCOUNT.id
  return (
    <AccountShell friends={friends} preview={preview}>
      <ProfileHeader account={account} friends={friends} preview={preview} />
      <AccountNav className="mt-8" />
      <div className="pt-8">{children}</div>
    </AccountShell>
  )
}
