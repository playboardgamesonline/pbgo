import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { UserAdd01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { parseProfileSegment, profilePath, profileSourceOf } from "@pbgo/accounts"
import { getAccount } from "@pbgo/accounts/server"
import { Button } from "@pbgo/ui/platform/button"
import { AccountShell } from "@/components/account-shell"
import { AddFriendButton } from "@/components/add-friend-button"
import { ProfileHeader } from "@/components/profile-header"
import { ProfileSections } from "@/components/profile-sections"
import { ProfileViewed } from "@/components/profile-viewed"
import { profilePage } from "@/lib/profile-data"

// The title does not hold the name: the analytics read the title of a page, and a nickname is nothing they keep. The page is never indexed, and robots.txt keeps the crawlers out of it (`robots.ts`)
export const metadata: Metadata = { title: "Player profile", robots: { index: false, follow: false } }

/** How many of the latest games the profile lists. */
const RECENT_GAMES = 10

/**
 * A member's public profile (PLT-39, PLT-111). Anybody can open it. It uses the same parts as `/me` (`ProfileHeader`, `ProfileSections`). Another visitor sees no games when the member hides them. An address that no member goes by is the hub's 404. `?from=` is for analytics.
 * The head has the button that makes friends (PLT-23): for a visitor who is not signed in, Add friend leads to the sign-in and back here; for a member, `AddFriendButton`, which says whether they are friends, a request waits, or the other member had asked first. The member's own profile has Edit profile.
 */
export default async function PlayerPage({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ from?: string | string[] }> }) {
  const [{ handle: segment }, { from }] = await Promise.all([params, searchParams])
  const handle = parseProfileSegment(segment)
  if (!handle) notFound()
  const viewer = await getAccount()
  const profile = await profilePage(handle, viewer, RECENT_GAMES)
  if (!profile) notFound()
  const { head, own, games, relation } = profile

  return (
    <AccountShell>
      <ProfileHeader head={head}>
        {own && (
          <Button asChild variant="outline">
            <Link href="/me/settings/account">Edit profile</Link>
          </Button>
        )}
        {!own && head.tag !== null && viewer === null && (
          <Button asChild>
            <Link href={`/login?next=${encodeURIComponent(profilePath({ nickname: head.nickname, tag: head.tag }))}`}>
              <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} data-icon="inline-start" />
              Add friend
            </Link>
          </Button>
        )}
        {!own && head.tag !== null && relation !== null && <AddFriendButton handle={{ nickname: head.nickname, tag: head.tag }} relation={relation} />}
      </ProfileHeader>
      <div className="pt-8">
        <ProfileSections games={games} own={own} hideHistory={head.hideHistory} recent={RECENT_GAMES} timeFormat={viewer?.preferences.timeFormat} />
      </div>
      <ProfileViewed own={own} hidden={games === null} from={profileSourceOf(typeof from === "string" ? from : null)} />
    </AccountShell>
  )
}
