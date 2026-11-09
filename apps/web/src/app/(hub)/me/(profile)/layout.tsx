import type { ReactNode } from "react"
import { requireAccount } from "@pbgo/accounts/server"
import { AccountShell } from "@/components/account-shell"
import { ProfileHeader } from "@/components/profile-header"

/**
 * The frame of the pages of the profile, `/me`, `/me/games` and `/me/friends`: the header with the visitor's name, and the page under it. There are no tabs: the profile is a page, the settings are a window (the account menu opens it), and the
 * games and the friends are reached from the account menu and from the places that lead to them (the games a visitor played, the panel of their friends). The games their friends are in, on every page of the hub, are the bar of the navbar.
 */
export default async function ProfileLayout({ children }: Readonly<{ children: ReactNode }>) {
  const account = await requireAccount("/me")
  return (
    <AccountShell>
      <ProfileHeader account={account} />
      <div className="pt-8">{children}</div>
    </AccountShell>
  )
}
