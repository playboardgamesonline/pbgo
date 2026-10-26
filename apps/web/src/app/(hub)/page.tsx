import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, DiceIcon, Link01Icon, UserGroupIcon } from "@hugeicons/core-free-icons"

import { getCatalog } from "@pbgo/catalog/server"
import { gameCardArt } from "@pbgo/core/sanity/cover"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { GameCard } from "@pbgo/ui/platform/game-card"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { gameCardProps, plannedCardProps } from "@/lib/game-card-props"
import { SITE_DESCRIPTION } from "@/site"

// Plain <a> to the games (GameCard, Button asChild): `@pbgo/ui` is framework-free, and the hub never prefetches a game's code.
// A card opens the game's page on the hub, `/game/<slug>`; the hero button goes straight to the game's own site.

const STEPS = [
  { icon: DiceIcon, title: "Pick a game", text: "Choose a board or card game and open a table in one click." },
  { icon: Link01Icon, title: "Share the link", text: "Send the table link or code to your friends. Nobody needs an account." },
  { icon: UserGroupIcon, title: "Play together", text: "Everyone plays from their own browser, rules and scoring handled for you." },
]

export default async function Home() {
  // The live games of the registry, then the games to come of the Notion Games database, already in their order (docs/catalog.md).
  // Without Notion (no key, or Notion down) the catalog is the live games alone and the list is what it was before it.
  const { entries } = await getCatalog()
  const first = entries.flatMap((entry) => (entry.live ? [entry.game] : []))[0]
  // One list for every game, each card a logo over a background on a grey frame. A live card reads them from the game's Sanity
  // project (cached for 60 s; a picture the game does not have leaves the frame plain); a game to come has its logo (or icon) and
  // its background from the catalog's picture route
  const cards = await Promise.all(
    entries.map(async (entry) => ({
      slug: entry.slug,
      live: entry.live,
      props: entry.live ? gameCardProps(entry.game, await gameCardArt(entry.game)) : plannedCardProps(entry.game),
    }))
  )

  // The page ends above the consent banner (`--consent-h`, set on <body>; 0px without a banner)
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-page flex-col items-start gap-6 px-gutter py-section">
          <Badge variant="secondary">Free · No sign-up · In your browser</Badge>
          <h1 className="max-w-2xl font-heading text-4xl md:text-6xl">Board games online, with friends.</h1>
          <p className="max-w-xl text-lg text-muted-foreground">{SITE_DESCRIPTION}</p>
          <div className="flex flex-wrap gap-3">
            {first && (
              <Button size="lg" asChild>
                <a href={`/${first.slug}`} data-game={first.slug}>
                  Play {first.name}
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                </a>
              </Button>
            )}
            <Button size="lg" variant="outline" asChild>
              <a href="#games">Browse games</a>
            </Button>
          </div>
        </section>

        <section id="games" className="mx-auto w-full max-w-page scroll-mt-20 px-gutter pb-section">
          <h2 className="mb-6 font-heading text-2xl">Games</h2>
          {/* `data-game` only on the live games: analytics counts the games opened from the hub, and a game to come is not one */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {cards.map(({ slug, live, props }) => (
              <GameCard key={slug} {...props} data-game={live ? slug : undefined} />
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-page px-gutter pb-section">
          <h2 className="mb-6 font-heading text-2xl">How it works</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <Card key={step.title} size="sm">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
                    <HugeiconsIcon icon={step.icon} strokeWidth={2} className="size-5" />
                  </div>
                  <CardTitle>{step.title}</CardTitle>
                  <CardDescription>{step.text}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
