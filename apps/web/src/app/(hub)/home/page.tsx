import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { getSessionState } from "@pbgo/accounts/server"
import { activeAnnouncements } from "@pbgo/catalog/editorial"
import { getCatalog, getEditorial } from "@pbgo/catalog/server"
import { NO_AGE_STATES } from "@pbgo/core/lib/age-rules"
import { playerRange } from "@pbgo/ui/tables"
import { HomeAnnouncements } from "@/components/home-announcements"
import { HomePlay, type PlayGame } from "@/components/home-play"
import { ageStatesOf, lockedExpansions } from "@/lib/age-state"
import { demoEditorial } from "@/lib/demo-editorial"
import { getExpansions } from "@/lib/game-activity"
import { expansionOption, LANGUAGE_OPTIONS } from "@/lib/game-activity-props"
import { gamePicture } from "@/lib/game-card-props"
import { memberGames } from "@/lib/member-games"

// The home of a signed-in member. The proxy sends a visitor who has a session from `/` to it, instead of leaving them on the public home (`apps/web/src/proxy.ts`), and a visitor
// who is not signed in who asks for `/home` is sent to `/`, and one who has signed in but not passed the second step of their account (PLT-129) to the sign-in, which asks for the code and brings them back here: the proxy
// sees a session at `/` and would send that visitor straight back. It is read per request, since the session decides who sees it, and it is never indexed.
export const metadata: Metadata = { title: "Home", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

/** How many announcements the top of the home shows at once. */
const ANNOUNCEMENTS_MAX = 2

/**
 * What a member opens the hub on: what to play now. From the top: the announcements (a message bar each), drawn only when the platform's Sanity project holds one, and the play zone, one central interface with no title and no surface (`HomePlay`: a switch of Normal, Ranked,
 * Tournaments and Custom, the select of the games, their settings, the row of players with the member in the middle, and the button; the games that can be played, each with the picture of its tile, the member's rank in it, how many may play and its expansions, which the game's page offers
 * the same way). Nothing is under it: the tables, the news, the tournaments, the member's games and ranks and the footer are not here, they are the pages of their own tabs, a game's page and the member's profile (docs/accounts.md, PLT-21). It has no title and no search bar:
 * the title and the figures are the public home's.
 */
export default async function MemberHome() {
  const { account, secondStep } = await getSessionState()
  if (!account) redirect(secondStep ? `/login?next=${encodeURIComponent("/home")}` : "/")
  const catalog = await getCatalog()
  const editorial = isDemoAccount(account) ? demoEditorial() : await getEditorial()

  // The pages the hub has: the games of its catalog, the ones that can be played now being those a search looks for and a table can be opened on
  const known = new Set(catalog.entries.map((entry) => entry.slug))
  const live = catalog.entries.filter((entry) => entry.live)
  // What each game asks of the member for their age (PLT-125): a game they are too young for is not offered, one that needs their date of birth asks for it when they use it, and an expansion for adults they cannot choose carries a lock
  const ages = await ageStatesOf(
    live.map((entry) => entry.slug),
    account,
  )
  const playable = live.filter((entry) => ages.get(entry.slug)?.game?.refusal !== "too-young")
  // The rank they have in each game they rated, which a tile says in a ranked search; their games are the career page's, so none is listed here
  const member = await memberGames(account, 0)
  const rankOf = new Map(member.ranks.map((entry) => [entry.slug, entry.rank]))
  // What a search and a table of one's own offer is per game, and the catalog (read once, cached) has all of it: the number of players and the expansions of the platform's Sanity project
  const games: PlayGame[] = await Promise.all(
    playable.map(async (entry) => ({
      slug: entry.slug,
      name: entry.game.name,
      ...gamePicture(entry.game),
      rank: rankOf.get(entry.slug) ?? null,
      refusal: ages.get(entry.slug)?.game?.refusal ?? null,
      range: playerRange(entry.game.players?.min ?? null, entry.game.players?.max ?? null),
      expansions: lockedExpansions(await getExpansions(entry.slug), ages.get(entry.slug) ?? NO_AGE_STATES).map(expansionOption),
    })),
  )

  const announcements = activeAnnouncements(editorial.announcements, new Date())
    .slice(0, ANNOUNCEMENTS_MAX)
    .map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      message: announcement.message,
      tone: announcement.tone,
      dismissible: announcement.dismissible,
      link: announcement.link
        ? { href: announcement.link.url, label: announcement.link.label }
        : announcement.game && known.has(announcement.game)
          ? { href: `/game/${announcement.game}`, label: "Read more" }
          : null,
    }))

  // The page ends above the consent banner (`--consent-h`, set on <body>; 0px without a banner), and starts under the fixed navbar (`pt-navbar`)
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex-1 pt-navbar">
        <h1 className="sr-only">Home</h1>
        <div className="pt-10">
          <HomeAnnouncements items={announcements} />
          <HomePlay games={games} languages={LANGUAGE_OPTIONS} account={{ id: account.id, nickname: account.nickname, avatarUrl: account.avatarUrl }} />
        </div>
      </main>
    </div>
  )
}
