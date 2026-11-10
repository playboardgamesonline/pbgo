import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { getSessionState } from "@pbgo/accounts/server"
import { KIND_LABELS, activeAnnouncements, bannersOf, entryHref, newsOf } from "@pbgo/catalog/editorial"
import { getCatalog, getEditorial } from "@pbgo/catalog/server"
import { NO_AGE_STATES } from "@pbgo/core/lib/age-rules"
import type { TableSettings } from "@pbgo/core/lib/table-settings"
import { readTableSettings } from "@pbgo/core/server/table-settings"
import { readMemberTables } from "@pbgo/core/server/tables"
import { Section } from "@pbgo/ui/platform/section"
import { playerRange } from "@pbgo/ui/tables"
import { HomeAnnouncements } from "@/components/home-announcements"
import { HomeBanners } from "@/components/home-banners"
import { HomeCreateTable } from "@/components/home-create-table"
import { HomeTournaments } from "@/components/home-empty-zones"
import { HomeFindGame } from "@/components/home-find-game"
import { HomeNews } from "@/components/home-news"
import { HomeOpenTables, type HomeTableRow } from "@/components/home-open-tables"
import { HomeYourGames, RECENT_GAMES } from "@/components/home-your-games"
import { SiteFooter } from "@/components/site-footer"
import { ageStatesOf, lockedExpansions } from "@/lib/age-state"
import { demoEditorial } from "@/lib/demo-editorial"
import { demoTables } from "@/lib/demo-tables"
import { getExpansions, tableOfMember } from "@/lib/game-activity"
import { expansionOption, LANGUAGE_OPTIONS, tableEntryProps } from "@/lib/game-activity-props"
import { gamePicture } from "@/lib/game-card-props"
import { memberGames } from "@/lib/member-games"
import { publicTableRows } from "@/lib/public-table-rows"

// The home of a signed-in member. The proxy sends a visitor who has a session from `/` to it, instead of leaving them on the public home (`apps/web/src/proxy.ts`), and a visitor
// who is not signed in who asks for `/home` is sent to `/`, and one who has signed in but not passed the second step of their account (PLT-129) to the sign-in, which asks for the code and brings them back here: the proxy
// sees a session at `/` and would send that visitor straight back. It is read per request, since the session decides who sees it, and it is never indexed.
export const metadata: Metadata = { title: "Home", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

/** How many announcements the top of the home shows at once. */
const ANNOUNCEMENTS_MAX = 2

/** How many of the tables open to everyone the home lists after the member's own: the Tables tab has the rest. */
const PUBLIC_TABLES_MAX = 6

/**
 * What a member opens the hub on: what to play now, then what is new. From the top: the announcements (a message bar each), the play zone, Find a game on two thirds of the row
 * and Create a table on the third beside it (from `xl`: two fifths for it from `lg`, the whole row for each below) (the games that can be played, each with the picture of its tile and, for a table, how many may play, its expansions and its helpers, which the game's page offers the same way), the tables the member sits at
 * and, after them, the ones open to everyone (PLT-21, six at the most: the Tables tab has the rest), their history, stats and ranks (the games that were recorded, PLT-13), their tournaments, and, at the foot, the banners (a new game, a new feature, slim cards, each leading to its game or to what's new) and the news, like the public home's. The zones that come from the platform's Sanity project (announcements, banners, news) are drawn only when it holds something.
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
  // What they played and the rank they have in each game they rated: the history and the ranks below, and the rank on the tile of a game in a ranked search
  const member = await memberGames(account, RECENT_GAMES)
  const rankOf = new Map(member.ranks.map((entry) => [entry.slug, entry.rank]))
  const findable = playable.map((entry) => ({ slug: entry.slug, name: entry.game.name, ...gamePicture(entry.game), rank: rankOf.get(entry.slug) ?? null, refusal: ages.get(entry.slug)?.game?.refusal ?? null }))
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

  // The tables the member sits at: the row of each is the one of a game's page, which leads to the table (PLT-120). A project where the database cannot say (migration 0013 is not applied yet) lists none
  const memberTables = isDemoAccount(account) ? demoTables(catalog.entries, account.nickname) : await readMemberTables(account.id).catch((error) => (console.error("The tables of a member could not be read", error instanceof Error ? error.message : error), []))
  // What each of their tables was set to (PLT-21): who may join, the speed, the seats. Read per game; the demo account's tables are in no database
  const settingsOf = new Map<string, TableSettings>()
  if (!isDemoAccount(account)) {
    await Promise.all(
      [...new Set(memberTables.map((table) => table.game))].map(async (game) => {
        const found = await readTableSettings(game, memberTables.filter((table) => table.game === game).map((table) => table.code))
        for (const [code, settings] of found) settingsOf.set(`${game}:${code}`, settings)
      }),
    )
  }
  const tableRows = (
    await Promise.all(
      memberTables.map(async (table): Promise<HomeTableRow | null> => {
        const entry = catalog.entries.find((candidate) => candidate.slug === table.game)
        if (!entry) return null
        const row = tableEntryProps(tableOfMember(table, entry.game.players?.max ?? table.players.length, settingsOf.get(`${table.game}:${table.code}`)), table.game, undefined, await getExpansions(table.game), table.status === "lobby")
        // Which game it is, first; the free seats of a table that is played are no way in, and the row leads to the table: a lobby's page, or the board of a game in progress (`/<slug>/game/<code>` sends a lobby to its page)
        return { id: `${table.game}:${table.code}`, entry: { ...row, facts: [entry.game.name, ...(row.facts ?? [])], hostedByYou: table.hostId === table.seat, to: row.href } }
      }),
    )
  ).filter((row) => row !== null)
  // Then the tables open to everyone, the newest first: the ones the member sits at are listed already
  const publicRows = await publicTableRows({ limit: PUBLIC_TABLES_MAX + memberTables.length, exclude: new Set(memberTables.map((table) => `${table.game}:${table.code}`)) })

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

  const bannersZone = <HomeBanners banners={banners} className="pb-6" />
  const playZone = (
    <Section aria-labelledby="home-play">
      <h2 id="home-play" className="sr-only">
        Play
      </h2>
      {/* Two thirds and a third from `xl`; between `lg` and `xl` the third is too narrow for the settings of a table (the speed's four chips), so Create a table has two fifths of the row there */}
      <div className="grid gap-4 lg:grid-cols-5 xl:grid-cols-3">
        <HomeFindGame games={findable} className="lg:col-span-3 xl:col-span-2" />
        <HomeCreateTable games={creatable} languages={LANGUAGE_OPTIONS} host={{ name: account.nickname, avatarUrl: account.avatarUrl }} className="lg:col-span-2 xl:col-span-1" />
      </div>
    </Section>
  )
  const tablesZone = <HomeOpenTables rows={[...tableRows, ...publicRows.slice(0, PUBLIC_TABLES_MAX).map(({ id, entry }) => ({ id, entry }))]} />

  // The page ends above the consent banner (`--consent-h`, set on <body>; 0px without a banner), and starts under the fixed navbar (`pt-navbar`)
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex-1 pt-navbar">
        <h1 className="sr-only">Home</h1>
        <div className="pt-10">
          <HomeAnnouncements items={announcements} />
          {playZone}
          {tablesZone}
          <HomeYourGames member={member} timeFormat={account.preferences.timeFormat} />
          <HomeTournaments />
          {bannersZone}
          <HomeNews lines={news} />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
