import { requireAccount } from "@pbgo/accounts/server"
import { ProfileSections } from "@/components/profile-sections"
import { ProfileViewed } from "@/components/profile-viewed"
import { memberGames } from "@/lib/member-games"
import { ownProfileHead } from "@/lib/profile-data"

/** How many of the latest games the profile lists. */
const RECENT_GAMES = 3

/**
 * The member's own profile. It uses the same parts as a public profile (`ProfileSections`) but shows everything, hidden or not. It lists the last three games and links to the whole history (`/me/games`). The games are the recorded ones (PLT-13).
 */
export default async function ProfilePage() {
  const account = await requireAccount("/me")
  const [head, games] = await Promise.all([ownProfileHead(account), memberGames(account, RECENT_GAMES)])
  return (
    <>
      <ProfileSections games={games} own hideHistory={head.hideHistory} recent={RECENT_GAMES} allGamesHref="/me/games" timeFormat={account.preferences.timeFormat} />
      <ProfileViewed own hidden={head.hideHistory} from="account" />
    </>
  )
}
