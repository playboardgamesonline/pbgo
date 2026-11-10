import Link from "next/link"
import type { ReactNode } from "react"
import { profilePath } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { requireAccount } from "@pbgo/accounts/server"
import { Button } from "@pbgo/ui/platform/button"
import { AccountShell } from "@/components/account-shell"
import { ProfileHeader } from "@/components/profile-header"
import { handleOfHead, ownProfileHead } from "@/lib/profile-data"

/**
 * The frame of the member's own profile pages (`/me`, `/me/games`, `/me/friends`): the same head as a public profile (`ProfileHeader`), buttons to edit it and to open the public page, and the page under it. There are no tabs.
 */
export default async function ProfileLayout({ children }: Readonly<{ children: ReactNode }>) {
  const account = await requireAccount("/me")
  const head = await ownProfileHead(account)
  const handle = handleOfHead(head)
  return (
    <AccountShell>
      <ProfileHeader head={head} note={isDemoAccount(account) ? "Demo account (development only)" : undefined}>
        <Button asChild variant="outline">
          <Link href="/me/settings/account">Edit profile</Link>
        </Button>
        {handle && (
          <Button asChild variant="outline">
            <Link href={profilePath(handle, "account")}>View public profile</Link>
          </Button>
        )}
      </ProfileHeader>
      <div className="pt-8">{children}</div>
    </AccountShell>
  )
}
