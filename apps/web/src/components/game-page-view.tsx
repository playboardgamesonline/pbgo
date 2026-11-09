import { notFound } from "next/navigation"
import { getAccount } from "@pbgo/accounts/server"
import { gameJsonLd, playLine, serializeJsonLd } from "@pbgo/catalog/seo"
import { normalizeCode } from "@pbgo/core/server/code"
import { getPlayableGame } from "@pbgo/games"
import { GameCard } from "@pbgo/ui/platform/game-card"
import { ScrollRow } from "@pbgo/ui/platform/scroll-row"
import { playerRange } from "@pbgo/ui/tables"
import { GameHead } from "@/components/game-head"
import { GameLeaderboard } from "@/components/game-leaderboard"
import { GamePlay } from "@/components/game-play"
import { GamePlayerBar } from "@/components/game-player-bar"
import { GameTournaments } from "@/components/game-tournaments"
import { SiteFooter } from "@/components/site-footer"
import { getExpansions, getHistory, getPlayerStats, getStandings, getTable, getTables, getTournaments, getViewerTable } from "@/lib/game-activity"
import { getGamePage } from "@/lib/game-page"
import { SITE_URL } from "@/site"

// The page of a game on the hub, where every card of the list leads. Every game's page is its game in the platform's Sanity project, a live game's included: the
// game's own project serves only once one enters the game. Its head (`GameHead`) has the game's background across the whole width of the page, the way back to the games at its top, then, at its foot, the game's logo in place of its name, the figures (the players, how long, how complex, from what age), the description, the categories and a row of controls: the
// three main buttons (to find a table, which starts a queue, to create one, which leads to the space below, and a picto that opens the rules),
// then, under them, the credits of the game, small and quiet (`GameCredits`: everybody credited on the game, by role, then its publishers and the year it came out, with a link to buy the game and BoardGameGeek's icon at the end of the line; the gallery of the game's pictures and clips is not drawn for now).
// Under it come, in this order: the visitor's three cards (`GamePlayerBar`: their rank with the points that are left to the next one and, under it, the games they played, their win rate and how long they have played; their recent games; their achievements as badges; a visitor who is not signed in, and a game to come, have none), the tables that are open on the left and a tall space on the right to play, the lobby the visitor is in or the space to open one (`GamePlay`: a table is opened, joined and started here, with the game's own routes, and the players
// then go to its board in the game's own site, `/<slug>/game/<code>`, another root layout, loaded whole; a game to come has it as the others do, with a button that does nothing and says "Coming soon" under its label, and no tables), the tournaments on the left and the leaderboard, which scrolls, on the right (`GameTournaments`, `GameLeaderboard`; a game to come has the tournaments alone), and the games the catalog finds similar to it, nine at most, as one row of cards that scrolls sideways (`ScrollRow`).
// None of what the bar, the open tables, the leaderboard and the tournaments show has a source yet (`lib/game-activity.ts`, whose types are already the rows of PLT-13's schema): their blocks say so. The visitor's own table is the exception, a row of the game's `games` table (PLT-106).
// Search engines: robots.txt does not cover `/game/<slug>` (it keeps crawlers out of `/*/game/`, the tables), so the page says itself
// whether it may be indexed, in its `robots` meta (`game.seo.indexable`: a live game follows the registry's flag, a game to come needs a
// description in its game in the Studio), and carries its JSON-LD only when it may. The rule and the metadata are `@pbgo/catalog/seo`.
// The page is found by the phrase "Play <name> Online": it is its title, its heading (`GameHead`) and the start of its description, and a last line under the similar games, the same for every game, starts with it (`playLine`).

// The same page is the page of a table (`/game/<slug>/<code>`, `code` given): the link of a table that waits for players, which the game's table page sends to (`GamePage` of core). It is the page of the game with that table picked in its list, so that the
// visitor sees who sits at it and sits down (`GamePlay`, `linked`); it is not indexed and has no JSON-LD (`GameTablePage`).

/** The page of the game `slug` on the hub, or of its table `code`. Answers 404 for a game the catalog does not list, and for a table that does not exist or is over. */
export async function GamePageView({ slug, code = null }: { slug: string; code?: string | null }) {
  const game = await getGamePage(slug)
  if (!game) notFound()
  const table = code === null ? null : normalizeCode(code)
  // Who is signed in is asked once per request (`getAccount` is cached): the lobby, the stats, the leaderboard's own row and the history are the visitor's
  const account = await getAccount()
  const viewerId = account?.id ?? null
  // The times on the page (the visitor's recent games, the tournaments) are written as the member chose; a visitor who is not signed in has no choice, and Automatic leaves each as the page writes it
  const timeFormat = account?.preferences.timeFormat ?? "auto"
  const seatsMax = playerRange(game.minPlayers, game.maxPlayers).max
  // A table can be opened where the game can be played: a live game, and, outside production, any game that has an engine (the template, a game under construction), as for its API
  const live = game.live || (process.env.VERCEL_ENV !== "production" && (await getPlayableGame(game.slug)) !== null)
  const [tables, viewerTable, standings, stats, history, tournaments, expansions] = await Promise.all([
    getTables(game.slug),
    // Only a game that can be played has tables: the others have none, whoever asks
    live ? getViewerTable(game.slug, seatsMax, table) : null,
    getStandings(game.slug, viewerId),
    getPlayerStats(game.slug, viewerId),
    getHistory(game.slug, viewerId),
    getTournaments(game.slug),
    getExpansions(game.slug),
  ])
  // The table of the link, when the visitor does not sit at it: the page shows it picked, with the way to sit down
  const linked = table !== null && viewerTable?.code !== table ? await getTable(game.slug, table, seatsMax) : null
  if (table !== null && viewerTable?.code !== table && !linked) notFound()

  // The page ends above the consent banner (`--consent-h`, set on <body>; 0px without a banner). It starts at the very top: the head's background is under the fixed navbar, and the head keeps its own text below it (`pt-navbar`)
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      {game.seo.indexable && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(gameJsonLd(game.seo, SITE_URL)) }} />
      )}

      <GameHead
        slug={game.slug}
        name={game.name}
        live={live}
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
        {/* Under the head, in this order: the visitor's cards, then the tables and the space to play (the head's "Create a table" leads to the space), then the tournaments and the leaderboard side by side. A game that is not live has the space and the tournaments: there is nothing to play, so no cards and no board. The credits are in the head */}
        <div className="flex flex-col gap-section">
          {live && stats && <GamePlayerBar slug={game.slug} stats={stats} recent={history} expansions={expansions} timeFormat={timeFormat} />}
          <GamePlay slug={game.slug} name={game.name} live={live} minPlayers={game.minPlayers} maxPlayers={game.maxPlayers} tables={tables} viewerTable={viewerTable} linked={linked} expansions={expansions} helpers={game.helpers} signedIn={account !== null} anchored />
          {live ? (
            <div className="grid gap-x-4 gap-y-section lg:grid-cols-3 lg:items-start">
              <div className="lg:col-span-2">
                <GameTournaments tournaments={tournaments} timeFormat={timeFormat} />
              </div>
              <GameLeaderboard standings={standings} />
            </div>
          ) : (
            <GameTournaments tournaments={tournaments} timeFormat={timeFormat} />
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

        {/* The last line of the page, for search engines and for whoever reads it: it starts with the phrase the page is found by (`playLine`), is the same for every game, live or not, is centred and quiet: the size of the footer's text and a little dimmer than the credits. Nothing above it moves for it */}
        <p className="mx-auto mt-section max-w-2xl text-balance text-center text-sm text-foreground/60">{playLine({ name: game.name, players: game.seo.players })}</p>
      </main>

      {/* 3rem more above the footer than the other pages give it, so that its text is not close to the page's last line */}
      <SiteFooter className="mt-12" />
    </div>
  )
}
