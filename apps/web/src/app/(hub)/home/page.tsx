import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { getSessionState } from "@pbgo/accounts/server"
import { KIND_LABELS, activeAnnouncements, bannersOf, entryHref, newsOf } from "@pbgo/catalog/editorial"
import { getCatalog, getEditorial } from "@pbgo/catalog/server"
import { NO_AGE_STATES } from "@pbgo/core/lib/age-rules"
import { Section } from "@pbgo/ui/platform/section"
import { playerRange } from "@pbgo/ui/tables"
import { HomeAnnouncements } from "@/components/home-announcements"
import { HomeBanners } from "@/components/home-banners"
import { HomeCreateTable } from "@/components/home-create-table"
import { HomeOpenTables, HomeTournaments } from "@/components/home-empty-zones"
import { HomeFindGame } from "@/components/home-find-game"
import { HomeNews } from "@/components/home-news"
import { HomeYourGames } from "@/components/home-your-games"
import { SiteFooter } from "@/components/site-footer"
import { ageStatesOf, lockedExpansions } from "@/lib/age-state"
import { demoEditorial } from "@/lib/demo-editorial"
import { getExpansions } from "@/lib/game-activity"
import { expansionOption, LANGUAGE_OPTIONS } from "@/lib/game-activity-props"
import { gamePicture } from "@/lib/game-card-props"

// The home of a signed-in member. The proxy sends a visitor who has a session from `/` to it, instead of leaving them on the public home (`apps/web/src/proxy.ts`), and a visitor
// who is not signed in who asks for `/home` is sent to `/`, and one who has signed in but not passed the second step of their account (PLT-129) to the sign-in, which asks for the code and brings them back here: the proxy
// sees a session at `/` and would send that visitor straight back. It is read per request, since the session decides who sees it, and it is never indexed.
export const metadata: Metadata = { title: "Home", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

/** How many announcements the top of the home shows at once. */
const ANNOUNCEMENTS_MAX = 2

/**
 * What a member opens the hub on: what is new and what to do now. From the top: the announcements (a message bar each), the banners (a new game, a new feature, each leading to its game or to what's new), the play zone, Find a game on two thirds of the row
 * and Create a table on the third beside it (from `xl`: two fifths for it from `lg`, the whole row for each below) (the games that can be played, each with the picture of its tile and, for a table, how many may play, its expansions and its helpers, which the game's page offers the same way), the tables open on the member's
 * games, their history, stats and ranks (the games that were recorded, PLT-13), their tournaments, and the news, like the public home's. The zones that come from the platform's Sanity project (announcements, banners, news) are drawn only when it holds something, and it holds nothing yet.
 * The others are drawn whole: the play zone works as far as the platform does, and the lists have their empty state, so the shape of the home is there to see (docs/accounts.md, PLT-21). It has no title and no search bar: the title and the figures are the public home's.
 */
export default async function MemberHome() {
  const { account, secondStep } = await getSessionState()
  if (!account) redirect(secondStep ? `/login?next=${encodeURIComponent("/home")}` : "/")
  const catalog = await getCatalog()
  const editorial = isDemoAccount(account) ? demoEditorial(catalog.entries) : await getEditorial()

  // The pages the hub has: the games of its catalog, the ones that can be played now being those a search looks for and a table can be opened on
  const known = new Set(catalog.entries.map((entry) => entry.slug))
  const live = catalog.entries.filter((entry) => entry.live)
  // What each game asks of the member for their age (PLT-125): a game they are too young for is not offered, one that needs their date of birth asks for it when they use it, and an expansion for adults they cannot choose carries a lock
  const ages = await ageStatesOf(
    live.map((entry) => entry.slug),
    account,
  )
  const playable = live.filter((entry) => ages.get(entry.slug)?.game?.refusal !== "too-young")
  const findable = playable.map((entry) => ({ slug: entry.slug, name: entry.game.name, ...gamePicture(entry.game), refusal: ages.get(entry.slug)?.game?.refusal ?? null }))
  // What the settings of a table offer is per game, and the catalog (read once, cached) has all of it: the number of players, the helpers, and the expansions of the platform's Sanity project
  const creatable = await Promise.all(
    playable.map(async (entry) => ({
      slug: entry.slug,
      name: entry.game.name,
      range: playerRange(entry.game.players?.min ?? null, entry.game.players?.max ?? null),
      expansions: lockedExpansions(await getExpansions(entry.slug), ages.get(entry.slug) ?? NO_AGE_STATES).map(expansionOption),
      helpers: entry.game.helpers.map(({ key, title }) => ({ id: key, label: title })),
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
  const banners = bannersOf(editorial.entries).flatMap((entry) =>
    entry.image ? [{ id: entry.id, image: entry.image, kind: KIND_LABELS[entry.kind], title: entry.title, href: entryHref(entry, known) }] : [],
  )
  const news = newsOf(editorial.entries).map((entry) => ({ id: entry.id, kind: KIND_LABELS[entry.kind], date: entry.date, title: entry.title, text: entry.text, href: entryHref(entry, known) }))

  // The page ends above the consent banner (`--consent-h`, set on <body>; 0px without a banner), and starts under the fixed navbar (`pt-navbar`)
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex-1 pt-navbar">
        <h1 className="sr-only">Home</h1>
        <div className="pt-10">
          <HomeAnnouncements items={announcements} />
          <HomeBanners banners={banners} />
          <Section aria-labelledby="home-play">
            <h2 id="home-play" className="sr-only">
              Play
            </h2>
            {/* Two thirds and a third from `xl`; between `lg` and `xl` the third is too narrow for the settings of a table (the speed's four chips), so Create a table has two fifths of the row there */}
            <div className="grid gap-4 lg:grid-cols-5 xl:grid-cols-3">
              <HomeFindGame games={findable} className="lg:col-span-3 xl:col-span-2" />
              <HomeCreateTable games={creatable} languages={LANGUAGE_OPTIONS} className="lg:col-span-2 xl:col-span-1" />
            </div>
          </Section>
          <HomeOpenTables />
          <HomeYourGames account={account} />
          <HomeTournaments />
          <HomeNews lines={news} />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
