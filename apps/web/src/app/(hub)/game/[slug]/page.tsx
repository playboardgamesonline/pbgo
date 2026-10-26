import { Fragment } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowRight01Icon, DiceIcon, HourglassIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"

import { Button } from "@pbgo/ui/platform/button"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { getGamePage } from "@/lib/game-page"

// The page of a game on the hub, where every card of the list leads. The button of a live game is a plain <a> to the game's own site
// (`/<slug>`, another root layout, loaded whole); a game to come has the same button, disabled.

export async function generateMetadata({ params }: PageProps<"/game/[slug]">): Promise<Metadata> {
  const game = await getGamePage((await params).slug)
  if (!game) return {}
  return {
    title: game.name,
    ...(game.description && { description: game.description.text }),
    alternates: { canonical: `/game/${game.slug}` },
    // robots.txt does not cover `/game/<slug>` (it keeps crawlers out of `/*/game/`, the tables): the page itself stays out of the search engines
    robots: { index: false },
  }
}

export default async function GameDescription({ params }: PageProps<"/game/[slug]">) {
  const game = await getGamePage((await params).slug)
  if (!game) notFound()

  // The page ends above the consent banner (`--consent-h`, set on <body>; 0px without a banner)
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-page flex-1 px-gutter py-8 md:py-12">
        <Link href="/#games" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline">
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />
          All games
        </Link>

        {/* One column, then two from `lg`: the text on the left, the picture on the right, the credits under the text. On a narrow screen the picture comes before the credits */}
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <div className="flex flex-col items-start gap-6 lg:col-start-1">
            <h1 className="font-heading text-4xl md:text-6xl">{game.name}</h1>
            {game.tagline && <p className="max-w-xl text-lg text-muted-foreground">{game.tagline}</p>}
            {(game.players || game.duration) && (
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

          <div className="relative aspect-4/3 overflow-hidden rounded-4xl bg-muted ring-1 ring-foreground/10 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            {game.visual ? (
              // A plain <img>, like the cards: the art is a URL from the game's Sanity project (or, for a game to come, from the catalog's picture route).
              // `object-top` keeps the top of a tall cut-out when the 4:3 frame crops it; a logo is contained, not cropped
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={game.visual.src}
                alt=""
                decoding="async"
                className={`size-full ${game.visual.fit === "cover" ? "object-cover object-top" : "object-contain p-12"}`}
              />
            ) : (
              // A live game without cover art shows the card's placeholder; a game to come, a plain frame
              game.live && (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <HugeiconsIcon icon={DiceIcon} strokeWidth={1.5} className="size-16" />
                </div>
              )
            )}
          </div>

          {game.facts.length > 0 && (
            <dl className="grid content-start gap-x-8 gap-y-5 border-t pt-6 sm:grid-cols-2 lg:col-start-1">
              {game.facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-sm text-muted-foreground">{fact.label}</dt>
                  <dd className="mt-1">
                    {fact.values.map((value, index) => (
                      <Fragment key={`${value.text}-${index}`}>
                        {index > 0 && ", "}
                        {value.href ? (
                          <a href={value.href} target="_blank" rel="noopener noreferrer" lang={value.lang} className="text-foreground underline underline-offset-4">
                            {value.text}
                          </a>
                        ) : (
                          value.text
                        )}
                      </Fragment>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
