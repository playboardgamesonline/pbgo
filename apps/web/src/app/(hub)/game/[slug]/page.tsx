import { Fragment } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowUpRight01Icon, ChildIcon, HourglassIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"

import { getAccount } from "@pbgo/accounts/server"
import { gameJsonLd, gameMetadata, serializeJsonLd } from "@pbgo/catalog/seo"
import { Badge } from "@pbgo/ui/platform/badge"
import { CreditLink } from "@pbgo/ui/platform/credit-link"
import { GameCard, GameCardVisual } from "@pbgo/ui/platform/game-card"
import { Item, ItemActions, ItemContent, ItemTitle } from "@pbgo/ui/platform/item"
import { ScrollRow } from "@pbgo/ui/platform/scroll-row"
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
// game's own project serves only once one enters the game. Its head is the title, the facts, the description, the credits (everybody
// credited on it, by role, then its publishers, under the text) and a picture, the one of its card. Under it come, in this order: the tables that are open on the left and a tall space on the right
// to play, the lobby the visitor is in or the space to open one (`GamePlay`: the space leads to the game's own site, `/<slug>`, another root layout, loaded whole; a game to come has it half transparent and no tables), then the visitor's stats on the left, with their latest games under them (the first three, the rest behind a button), and
// the leaderboard on the right, which scrolls (`GameStats`, `GameHistory`, `GameLeaderboard`; a game to come has none of them), the tournaments (`GameTournaments`), the rulebooks, and the games the catalog
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

        {/* One column, then two from `lg`: the text on the left, the picture on the right, the credits under the text. On a narrow screen the picture comes before them */}
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <div className="flex flex-col items-start gap-6 lg:col-start-1">
            <h1 className="font-heading text-4xl md:text-6xl">{game.name}</h1>
            {(game.players || game.duration || game.age) && (
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-muted-foreground">
                {game.players && (
                  <li className="inline-flex items-center gap-1.5">
                    <HugeiconsIcon icon={UserMultipleIcon} strokeWidth={2} className="size-4" />
                    {game.players}
                  </li>
                )}
                {game.duration && (
                  <li className="inline-flex items-center gap-1.5">
                    <HugeiconsIcon icon={HourglassIcon} strokeWidth={2} className="size-4" />
                    {game.duration}
                  </li>
                )}
                {game.age && (
                  <li className="inline-flex items-center gap-1.5">
                    <HugeiconsIcon icon={ChildIcon} strokeWidth={2} className="size-4" />
                    {game.age}
                  </li>
                )}
              </ul>
            )}
            {/* The text is the game's own, in the language it was found in; line breaks of the source are kept */}
            {game.description && (
              <p lang={game.description.language} className="max-w-xl text-pretty whitespace-pre-line text-muted-foreground">
                {game.description.text}
              </p>
            )}
          </div>

          {/* The picture of the game's card, drawn larger: its logo over its background, a plain frame when the game has neither. It is the page's first picture, so it loads at once */}
          <GameCardVisual
            {...game.picture}
            loading="eager"
            className="rounded-4xl ring-1 ring-foreground/10 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
          />

          {game.facts.length > 0 && (
            // Under the text: the credits follow one another, one line each (Designer, Artist, Publisher, each in the plural when there are several). A publisher is a link to its website,
            // with the icon of that site before its name, the two being one link. The lines keep the height of their text and the same gap, whatever room the picture beside them leaves: the block is stretched by the grid of the head,
            // and a grid shares the height it is given between its rows unless it is told to start them at the top (`content-start`)
            <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1.5 border-t pt-6 lg:col-start-1">
              {game.facts.map((fact) => (
                <Fragment key={fact.label}>
                  <dt className="text-muted-foreground">{fact.label}</dt>
                  <dd>
                    {fact.values.map((value, index) => (
                      <Fragment key={`${value.text}-${index}`}>
                        {index > 0 && ", "}
                        {value.href ? (
                          <CreditLink href={value.href} icon={value.icon}>
                            {value.text}
                          </CreditLink>
                        ) : (
                          value.text
                        )}
                      </Fragment>
                    ))}
                  </dd>
                </Fragment>
              ))}
            </dl>
          )}
        </div>

        {/* Between the head and the rules: the tables and the space to play, the visitor's stats and the leaderboard, then the tournaments. A game that is not live has the space alone and the tournaments: there is nothing to play, so no stats and no board */}
        <div className="mt-section flex flex-col gap-section">
          <GamePlay slug={game.slug} name={game.name} live={game.live} players={game.players} tables={tables} viewerTable={viewerTable} expansions={expansions} />
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

        {/* A rulebook is a PDF in a language: each one is a bordered link opening it in a new tab. The language's code sits on a grey chip (hidden
            from screen readers: the title is in that language and the link says so), then the title with the game's name, then the arrow that says
            the link leaves the page. On hover the card turns grey, so the chip turns dark to stay visible. The rulebooks end the page, over the related games, in a grid
            that follows the width like theirs */}
        {game.rulebooks.length > 0 && (
          <section aria-labelledby="rulebooks" className="mt-section">
            <h2 id="rulebooks" className="mb-6 font-heading text-2xl">
              {game.rulebooks.length === 1 ? "Rulebook" : "Rulebooks"}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {game.rulebooks.map(({ language, label, href }) => (
                <li key={language}>
                  <Item variant="outline" asChild>
                    <a href={href} target="_blank" rel="noopener noreferrer" lang={language}>
                      <Badge variant="secondary" aria-hidden className="min-w-9 group-hover/item:bg-background">
                        {language.toUpperCase()}
                      </Badge>
                      <ItemContent>
                        <ItemTitle className="line-clamp-none text-base">{label}</ItemTitle>
                      </ItemContent>
                      <ItemActions>
                        <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} className="size-5 text-muted-foreground" aria-hidden />
                      </ItemActions>
                    </a>
                  </Item>
                </li>
              ))}
            </ul>
          </section>
        )}

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
