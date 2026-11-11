import Link from "next/link"
import type { ReactNode } from "react"
import { profilePath } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { requireAccount } from "@pbgo/accounts/server"
import { Button } from "@pbgo/ui/platform/button"
import { AccountShell } from "@/components/account-shell"
import { EditProfileButton } from "@/components/edit-profile-button"
import { ProfileAbout } from "@/components/profile-about"
import { ProfileHeader } from "@/components/profile-header"
import { handleOfHead, ownProfileHead } from "@/lib/profile-data"

/**
 * The frame of the member's own profile pages (`/me`, `/me/games`, `/me/friends`): the same head as a public profile (`ProfileHeader`, then `ProfileAbout`: the bio and the favourite games), buttons to edit it (the window of `EditProfileDialog`) and to open the public page, and the page under it. There are no tabs.
 */
export default async function ProfileLayout({ children }: Readonly<{ children: ReactNode }>) {
  const account = await requireAccount("/me")
  const head = await ownProfileHead(account)
  const handle = handleOfHead(head)
  return (
    <AccountShell>
      <ProfileHeader head={head} note={isDemoAccount(account) ? "Demo account (development only)" : undefined}>
        <EditProfileButton head={head} demo={isDemoAccount(account)} address="me" />
        {handle && (
          <Button asChild variant="outline">
            <Link href={profilePath(handle, "account")}>View public profile</Link>
          </Button>
        )}
      </ProfileHeader>
      <ProfileAbout details={head.details} />
      <div className="pt-8">{children}</div>
    </AccountShell>
  )
}
