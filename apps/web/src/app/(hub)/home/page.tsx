import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import { KIND_LABELS, activeAnnouncements, bannersOf, entryHref, newsOf } from "@pbgo/catalog/editorial"
import { getCatalog, getEditorial } from "@pbgo/catalog/server"
import { Section } from "@pbgo/ui/platform/section"
import { HomeAnnouncements } from "@/components/home-announcements"
import { HomeBanners } from "@/components/home-banners"
import { HomeCreateTable } from "@/components/home-create-table"
import { HomeOpenTables, HomeTournaments, HomeYourGames } from "@/components/home-empty-zones"
import { HomeFindGame } from "@/components/home-find-game"
import { HomeNews } from "@/components/home-news"
import { SiteFooter } from "@/components/site-footer"
import { demoEditorial } from "@/lib/demo-editorial"

// The home of a signed-in member. It is not a page of its own: the proxy shows it at `/` instead of the public home when the visitor has a session (`apps/web/src/proxy.ts`, a rewrite, so the address stays `/`), and a visitor
// who is not signed in who asks for `/home` is sent to `/`. It is read per request, since the session decides who sees it, and it is never indexed.
export const metadata: Metadata = { title: "Home", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

/** How many announcements the top of the home shows at once. */
const ANNOUNCEMENTS_MAX = 2

/**
 * What a member opens the hub on: what is new and what to do now. From the top: the announcements (a message bar each), the banners (a new game, a new feature, each leading to its game or to what's new), Find a game and Create a table
 * side by side, the tables open on the member's games, their history, stats and ranks, their tournaments, and the news, like the public home's. The zones that come from the platform's Sanity project (announcements, banners, news) are drawn
 * only when it holds something, and it holds nothing yet. The others are drawn whole: Create a table works, and Find a game and the lists have their empty state, so the shape of the home is there to see (docs/accounts.md, PLT-21).
 * It has no title and no search bar: the title and the figures are the public home's.
 */
export default async function MemberHome() {
  const account = await getAccount()
  if (!account) redirect("/")
  const catalog = await getCatalog()
  const editorial = isDemoAccount(account) ? demoEditorial(catalog.entries) : await getEditorial()

  // The pages the hub has: the games of its catalog, the ones that can be played now being those a table can be opened on
  const known = new Set(catalog.entries.map((entry) => entry.slug))
  const playable = catalog.entries.filter((entry) => entry.live).map((entry) => ({ slug: entry.slug, name: entry.game.name }))

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
            <div className="grid gap-4 md:grid-cols-2">
              <HomeFindGame />
              <HomeCreateTable games={playable} />
            </div>
          </Section>
          <HomeOpenTables />
          <HomeYourGames />
          <HomeTournaments />
          <HomeNews lines={news} />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
