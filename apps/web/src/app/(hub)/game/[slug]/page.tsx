import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getAccount } from "@pbgo/accounts/server"
import { gameJsonLd, gameMetadata, serializeJsonLd } from "@pbgo/catalog/seo"
import { GameCard } from "@pbgo/ui/platform/game-card"
import { ScrollRow } from "@pbgo/ui/platform/scroll-row"
import { GameHead } from "@/components/game-head"
import { GameLeaderboard } from "@/components/game-leaderboard"
import { GamePlay } from "@/components/game-play"
import { GamePlayerBar } from "@/components/game-player-bar"
import { GameTournaments } from "@/components/game-tournaments"
import { SiteFooter } from "@/components/site-footer"
import { getExpansions, getHistory, getPlayerStats, getStandings, getTables, getTournaments, getViewerTable } from "@/lib/game-activity"
import { getGamePage } from "@/lib/game-page"
import { SITE_NAME, SITE_URL } from "@/site"

// The page of a game on the hub, where every card of the list leads. Every game's page is its game in the platform's Sanity project, a live game's included: the
// game's own project serves only once one enters the game. Its head (`GameHead`) has the game's background across the whole width of the page, the way back to the games at its top, then, at its foot, the game's logo in place of its name, the figures (the players, how long, how complex, from what age), the description, the categories and a row of controls: the
// three main buttons (to find a table, which starts a queue, to create one, which leads to the space below, and a picto that opens the rules),
// then, under them, the credits of the game, small and quiet (`GameCredits`: everybody credited on the game, by role, then its publishers and the year it came out, with a link to buy the game and BoardGameGeek's icon at the end of the line; the gallery of the game's pictures and clips is not drawn for now).
// Under it come, in this order: the visitor's bar (`GamePlayerBar`: their rank with the points that are left to the next one, how long they have played and at how many games, their achievements as badges and their last game; a visitor who is not signed in, and a game to come, have none), the tables that are open on the left and a tall space on the right to play, the lobby the visitor is in or the space to open one (`GamePlay`: the space leads to the game's
// own site, `/<slug>`, another root layout, loaded whole; a game to come has it as the others do, with a button that does nothing and says "Coming soon" under its label, and no tables), the tournaments on the left and the leaderboard, which scrolls, on the right (`GameTournaments`, `GameLeaderboard`; a game to come has the tournaments alone), and the games the catalog finds similar to it, nine at most, as one row of cards that scrolls sideways (`ScrollRow`).
// None of what the bar, the tables, the lobby, the leaderboard and the tournaments show has a source yet (`lib/game-activity.ts`, whose types are already the rows of PLT-13's schema): their blocks say so.
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

  // The page ends above the consent banner (`--consent-h`, set on <body>; 0px without a banner). It starts at the very top: the head's background is under the fixed navbar, and the head keeps its own text below it (`pt-navbar`)
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      {game.seo.indexable && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(gameJsonLd(game.seo, SITE_URL)) }} />
      )}

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
        rulebooks={game.rulebooks}
        hero={game.hero}
        facts={game.facts}
        bgg={game.bgg}
        shop={game.shop}
      />

      <main className="mx-auto w-full max-w-page flex-1 px-gutter py-8 md:py-12">
        {/* Under the head, in this order: the visitor's bar, then the tables and the space to play (the head's "Create a table" leads to the space), then the tournaments and the leaderboard side by side. A game that is not live has the space and the tournaments: there is nothing to play, so no bar and no board. The credits are in the head */}
        <div className="flex flex-col gap-section">
          {game.live && stats && <GamePlayerBar stats={stats} latest={history[0] ?? null} />}
          <GamePlay slug={game.slug} name={game.name} live={game.live} minPlayers={game.minPlayers} maxPlayers={game.maxPlayers} tables={tables} viewerTable={viewerTable} expansions={expansions} helpers={game.helpers} anchored />
          {game.live ? (
            <div className="grid gap-x-4 gap-y-section lg:grid-cols-3 lg:items-start">
              <div className="lg:col-span-2">
                <GameTournaments tournaments={tournaments} />
              </div>
              <GameLeaderboard standings={standings} />
            </div>
          ) : (
            <GameTournaments tournaments={tournaments} />
          )}
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
