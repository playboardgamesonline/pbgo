import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { getSessionState } from "@pbgo/accounts/server"
import { getCatalog } from "@pbgo/catalog/server"
import { NO_AGE_STATES } from "@pbgo/core/lib/age-rules"
import { playerRange } from "@pbgo/ui/tables"
import { HomeAside } from "@/components/home-aside"
import { HomePlay, type PlayGame } from "@/components/home-play"
import { ageStatesOf, lockedExpansions } from "@/lib/age-state"
import { getExpansions, getTournaments } from "@/lib/game-activity"
import { expansionOption, LANGUAGE_OPTIONS } from "@/lib/game-activity-props"
import { gamePicture } from "@/lib/game-card-props"
import { gameThumb } from "@/lib/game-thumb"
import { DEMO_ARTICLE, demoTournaments, openTournaments, type AsideGame } from "@/lib/home-aside"
import { memberGames } from "@/lib/member-games"

// The home of a signed-in member. The proxy sends a visitor who has a session from `/` to it, instead of leaving them on the public home (`apps/web/src/proxy.ts`), and a visitor
// who is not signed in who asks for `/home` is sent to `/`, and one who has signed in but not passed the second step of their account (PLT-129) to the sign-in, which asks for the code and brings them back here: the proxy
// sees a session at `/` and would send that visitor straight back. It is read per request, since the session decides who sees it, and it is never indexed.
export const metadata: Metadata = { title: "Home", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

/**
 * What a member opens the hub on: what to play now, in two spaces side by side. The larger, on the left, is the play zone, one central interface with no title and no surface (`HomePlay`: a switch of Normal, Ranked and Custom, the games as tiles with their settings, the row of players with the
 * member in the middle, and the button; the games that can be played, each with its cover, the member's rank in it, how many may play and its expansions, which the game's page offers the same way). The smaller, on the right, is `HomeAside`: what's new and the open tournaments, which stack under
 * the zone on a screen too narrow for two spaces. Nothing else is on it: the announcements, the tables, the member's games and ranks and the footer are not here, they are the pages of their own tabs, a game's page and the member's profile (docs/accounts.md, PLT-21). It has no title and no search bar:
 * the title and the figures are the public home's.
 */
export default async function MemberHome() {
  const { account, secondStep } = await getSessionState()
  if (!account) redirect(secondStep ? `/login?next=${encodeURIComponent("/home")}` : "/")
  const catalog = await getCatalog()

  // The games the hub has, the ones that can be played now being those a search looks for and a table can be opened on
  const live = catalog.entries.filter((entry) => entry.live)
  // What each game asks of the member for their age (PLT-125): a game they are too young for is not offered, one that needs their date of birth asks for it when they use it, and an expansion for adults they cannot choose carries a lock
  const ages = await ageStatesOf(
    live.map((entry) => entry.slug),
    account,
  )
  const playable = live.filter((entry) => ages.get(entry.slug)?.game?.refusal !== "too-young")
  // The rank they have in each game they rated, which a card says in a ranked search; their games are the career page's, so none is listed here
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

  // The right column: the latest article and the tournaments that are open. The hub reads no article yet and no tournament is recorded (`getTournaments` lists none), so a member's column says so; the demo account of development has some made up, to look at it with something in it
  const asideGames: AsideGame[] = playable.map((entry) => ({ slug: entry.slug, name: entry.game.name, ...gameThumb(entry.game) }))
  const demo = isDemoAccount(account)
  const article = demo ? DEMO_ARTICLE : null
  const tournaments = demo ? demoTournaments(asideGames, new Date()) : openTournaments(await Promise.all(asideGames.map(async (game) => ({ game, tournaments: await getTournaments(game.slug) }))))

  // The page ends above the consent banner (`--consent-h`, set on <body>; 0px without a banner), and starts under the fixed navbar (`pt-navbar`). The two spaces are side by side from `xl`, with the same margin at the two sides of the page, between them and under them, the zone, a card as tall as what is left of the screen, taking what the column leaves, so that its button is at the foot of the card and of the screen, and the column as tall as the card, its last block ending where the card does
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex flex-1 flex-col pt-navbar">
        <h1 className="sr-only">Home</h1>
        <div className="flex flex-1 flex-col gap-6 px-gutter pt-4 pb-gutter xl:flex-row xl:gap-x-gutter">
          <HomePlay className="flex-1" games={games} languages={LANGUAGE_OPTIONS} account={{ id: account.id, nickname: account.nickname, avatarUrl: account.avatarUrl }} />
          <HomeAside className="w-full xl:w-80 xl:shrink-0 2xl:w-96" article={article} tournaments={tournaments} timeFormat={account.preferences.timeFormat} />
        </div>
      </main>
    </div>
  )
}
