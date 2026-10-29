import { Fragment } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowRight01Icon, ArrowUpRight01Icon, ChildIcon, HourglassIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"

import { gameJsonLd, gameMetadata, serializeJsonLd } from "@pbgo/catalog/seo"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { GameCard, GameCardVisual } from "@pbgo/ui/platform/game-card"
import { Item, ItemActions, ItemContent, ItemTitle } from "@pbgo/ui/platform/item"
import { SiteFooter } from "@/components/site-footer"
import { getGamePage } from "@/lib/game-page"
import { SITE_NAME, SITE_URL } from "@/site"

// The page of a game on the hub, where every card of the list leads. Every game's page is its Notion row, a live game's included: the
// game's Sanity project serves only once one enters the game. The button of a live game is a plain <a> to the game's own site
// (`/<slug>`, another root layout, loaded whole); a game to come has the same button, disabled. Its picture is the one of its card,
// and the games the catalog relates to it come last, as cards.
// Search engines: robots.txt does not cover `/game/<slug>` (it keeps crawlers out of `/*/game/`, the tables), so the page says itself
// whether it may be indexed, in its `robots` meta (`game.seo.indexable`: a live game follows the registry's flag, a game to come needs a
// description in its Notion row), and carries its JSON-LD only when it may. The rule and the metadata are `@pbgo/catalog/seo`.

export async function generateMetadata({ params }: PageProps<"/game/[slug]">): Promise<Metadata> {
  const game = await getGamePage((await params).slug)
  if (!game) return {}
  return gameMetadata(game.seo, { url: SITE_URL, name: SITE_NAME })
}

export default async function GameDescription({ params }: PageProps<"/game/[slug]">) {
  const game = await getGamePage((await params).slug)
  if (!game) notFound()

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

        {/* One column, then two from `lg`: the text on the left, the picture on the right, the credits and the rulebooks under the text. On a narrow screen the picture comes before them */}
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
            {game.live ? (
              <Button size="lg" asChild>
                <a href={`/${game.slug}`}>
                  Create a game
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                </a>
              </Button>
            ) : (
              <Button size="lg" disabled>
                Coming soon
              </Button>
            )}
          </div>

          {/* The picture of the game's card, drawn larger: its logo over its background, a plain frame when the game has neither. It is the page's first picture, so it loads at once */}
          <GameCardVisual
            {...game.picture}
            loading="eager"
            className="ring-1 ring-foreground/10 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
          />

          {(game.facts.length > 0 || game.rulebooks.length > 0) && (
            // Under the text: the credits follow one another, one line each, then the rulebooks in an area of their own, one link per language
            <div className="flex flex-col gap-8 border-t pt-6 lg:col-start-1">
              {game.facts.length > 0 && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3">
                  {game.facts.map((fact) => (
                    <Fragment key={fact.label}>
                      <dt className="text-muted-foreground">{fact.label}</dt>
                      <dd>
                        {fact.values.map((value, index) => (
                          <Fragment key={`${value.text}-${index}`}>
                            {index > 0 && ", "}
                            {value.href ? (
                              <a href={value.href} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4">
                                {value.text}
                              </a>
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

              {/* A rulebook is a PDF in a language: each one is a bordered link opening it in a new tab. The language's code sits on a grey chip (hidden
                  from screen readers: the title is in that language and the link says so), then the title with the game's name, then the arrow that says
                  the link leaves the page. On hover the card turns grey, so the chip turns dark to stay visible */}
              {game.rulebooks.length > 0 && (
                <section aria-labelledby="rulebooks" className="flex max-w-xl flex-col gap-3">
                  <h2 id="rulebooks" className="text-muted-foreground">
                    {game.rulebooks.length === 1 ? "Rulebook" : "Rulebooks"}
                  </h2>
                  <ul className="flex flex-col gap-3">
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
            </div>
          )}
        </div>

        {game.related.length > 0 && (
          // The games the catalog relates to this one, listed like the home: the Related Games and the base game of its Notion row, from
          // either side (docs/catalog.md). Their cards carry no `data-game`: analytics counts the games opened from the home, not from here
          <section aria-labelledby="related-games" className="mt-section">
            <h2 id="related-games" className="mb-6 font-heading text-2xl">
              Related games
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {game.related.map(({ slug, card }) => (
                <GameCard key={slug} {...card} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
