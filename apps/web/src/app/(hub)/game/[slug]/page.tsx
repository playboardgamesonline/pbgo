import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

import { getAccount } from "@pbgo/accounts/server"
import { gameJsonLd, gameMetadata, serializeJsonLd } from "@pbgo/catalog/seo"
import { GameCard } from "@pbgo/ui/platform/game-card"
import { ScrollRow } from "@pbgo/ui/platform/scroll-row"
import { GameHead } from "@/components/game-head"
import { GameHistory } from "@/components/game-history"
import { GameLeaderboard } from "@/components/game-leaderboard"
import { GamePlay } from "@/components/game-play"
import { GameStats } from "@/components/game-stats"
import { GameTournaments } from "@/components/game-tournaments"
import { SiteFooter } from "@/components/site-footer"
import { getExpansions, getHistory, getPlayerStats, getStandings, getTables, getTournaments, getViewerTable } from "@/lib/game-activity"
import { getGamePage } from "@/lib/game-page"
import { SITE_NAME, SITE_URL } from "@/site"

// The page of a game on the hub, where every card of the list leads. Every game's page is its game in the platform's Sanity project, a live game's included: the
// game's own project serves only once one enters the game. Its head (`GameHead`) is the title, the figures (the players, how long, from what age, the year it came out), the description, a row of buttons (to find a game, which starts a queue, and to create one, which leads to the space below; to read
// the rules), the credits (everybody credited on it, by role, then its publishers, under the text) and a picture, the one of its card. Under it come, in this order: the tables that are open on the left and a tall space on the right
// to play, the lobby the visitor is in or the space to open one (`GamePlay`: the space leads to the game's own site, `/<slug>`, another root layout, loaded whole; a game to come has it half transparent and no tables), then the visitor's stats on the left, with their latest games under them (the first three, the rest behind a button), and
// the leaderboard on the right, which scrolls (`GameStats`, `GameHistory`, `GameLeaderboard`; a game to come has none of them), the tournaments (`GameTournaments`), and the games the catalog
// finds similar to it, nine at most, as one row of cards that scrolls sideways (`ScrollRow`). None of what the tables, the lobby, the stats, the leaderboard and the tournaments show has a source yet (`lib/game-activity.ts`, whose types are already the rows of PLT-13's schema): their blocks say so.
// Search engines: robots.txt does not cover `/game/<slug>` (it keeps crawlers out of `/*/game/`, the tables), so the page says itself
// whether it may be indexed, in its `robots` meta (`game.seo.indexable`: a live game follows the registry's flag, a game to come needs a
// description in its game in the Studio), and carries its JSON-LD only when it may. The rule and the metadata are `@pbgo/catalog/seo`.

export async function generateMetadata({ params }: PageProps<"/game/[slug]">): Promise<Metadata> {
  const game = await getGamePage((await params).slug)
  if (!game) return {}
  return gameMetadata(game.seo, { url: SITE_URL, name: SITE_NAME })
}

export default async function GameDescription({ params }: PageProps<"/game/[slug]">) {
  const game = await getGamePage((await params).slug)
  if (!game) notFound()
  // Who is signed in is asked once per request (`getAccount` is cached): the lobby, the stats, the leaderboard's own row and the history are the visitor's
  const viewerId = (await getAccount())?.id ?? null
  const [tables, viewerTable, standings, stats, history, tournaments, expansions] = await Promise.all([
    getTables(game.slug),
    getViewerTable(game.slug, viewerId),
    getStandings(game.slug, viewerId),
    getPlayerStats(game.slug, viewerId),
    getHistory(game.slug, viewerId),
    getTournaments(game.slug),
    getExpansions(game.slug),
  ])

  // The page starts under the fixed navbar (`pt-navbar`) and ends above the consent banner (`--consent-h`, set on <body>; 0px without a banner)
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col pt-navbar">
      {game.seo.indexable && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(gameJsonLd(game.seo, SITE_URL)) }} />
      )}

      <main className="mx-auto w-full max-w-page flex-1 px-gutter py-8 md:py-12">
        <Link href="/games" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline">
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />
          All games
        </Link>

        <GameHead
          slug={game.slug}
          name={game.name}
          live={game.live}
          description={game.description}
          players={game.players}
          duration={game.duration}
          complexity={game.complexity}
          age={game.age}
          categories={game.categories}
          facts={game.facts}
          rulebooks={game.rulebooks}
          bgg={game.bgg}
          picture={game.picture}
        />

        {/* Between the head and the similar games: the tables and the space to play (the head's "Create a game" leads to the space), the visitor's stats and the leaderboard, then the tournaments. A game that is not live has the space alone and the tournaments: there is nothing to play, so no stats and no board */}
        <div className="mt-section flex flex-col gap-section">
          <GamePlay slug={game.slug} name={game.name} live={game.live} players={game.players} tables={tables} viewerTable={viewerTable} expansions={expansions} anchored />
          {game.live && (
            <div className="grid gap-x-4 gap-y-section lg:grid-cols-3 lg:items-start">
              <GameStats slug={game.slug} stats={stats} className="lg:col-span-2">
                <GameHistory entries={history} name={game.name} expansions={expansions} />
              </GameStats>
              <GameLeaderboard standings={standings} />
            </div>
          )}
          <GameTournaments tournaments={tournaments} />
        </div>

        {game.related.length > 0 && (
          // The games the catalog recommends with this one: its family first (the related games and the base game of its game in the Studio, from either side), then the games that look like it, by their categories and by the players
          // that play both (`rankRelated`, docs/catalog.md), nine at most (`RELATED_MAX`). One row of cards, like the home's, that scrolls sideways, under the title "Similar games". Their cards carry no `data-game`: analytics counts the games opened from the home, not from here
          <ScrollRow title="Similar games" className="mt-section">
            {game.related.map(({ slug, card }) => (
              <GameCard key={slug} {...card} />
            ))}
          </ScrollRow>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
