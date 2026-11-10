import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { parseProfileSegment, profileSourceOf } from "@pbgo/accounts"
import { getAccount } from "@pbgo/accounts/server"
import { Button } from "@pbgo/ui/platform/button"
import { AccountShell } from "@/components/account-shell"
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
 */
export default async function PlayerPage({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ from?: string | string[] }> }) {
  const [{ handle: segment }, { from }] = await Promise.all([params, searchParams])
  const handle = parseProfileSegment(segment)
  if (!handle) notFound()
  const viewer = await getAccount()
  const profile = await profilePage(handle, viewer, RECENT_GAMES)
  if (!profile) notFound()
  const { head, own, games } = profile

  return (
    <AccountShell>
      <ProfileHeader head={head}>
        {/* PLT-23: the Add friend button of another member's profile goes here */}
        {own && (
          <Button asChild variant="outline">
            <Link href="/me/settings/account">Edit profile</Link>
          </Button>
        )}
      </ProfileHeader>
      <div className="pt-8">
        <ProfileSections games={games} own={own} hideHistory={head.hideHistory} recent={RECENT_GAMES} timeFormat={viewer?.preferences.timeFormat} />
      </div>
      <ProfileViewed own={own} hidden={games === null} from={profileSourceOf(typeof from === "string" ? from : null)} />
    </AccountShell>
  )
}
