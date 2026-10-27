import { HugeiconsIcon } from "@hugeicons/react"
import { DiceIcon, Link01Icon, UserGroupIcon } from "@hugeicons/core-free-icons"

import { indexEntry } from "@pbgo/catalog/filter"
import { getCatalog } from "@pbgo/catalog/server"
import { Card, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { GameList } from "@/components/game-list"
import { GameSearch } from "@/components/game-search"
import { HeroSearch } from "@/components/hero-search"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { catalogCardProps } from "@/lib/game-card-props"
import { SITE_DESCRIPTION } from "@/site"

// Plain <a> to the games (GameCard): `@pbgo/ui` is framework-free, and the hub never prefetches a game's code.
// A card opens the game's page on the hub, `/game/<slug>`.

const STEPS = [
  { icon: DiceIcon, title: "Pick a game", text: "Choose a board or card game and open a table in one click." },
  { icon: Link01Icon, title: "Share the link", text: "Send the table link or code to your friends. Nobody needs an account." },
  { icon: UserGroupIcon, title: "Play together", text: "Everyone plays from their own browser, rules and scoring handled for you." },
]

export default async function Home() {
  // The live games of the registry, then the games to come, already in their order (docs/catalog.md). Without Notion (no key, or
  // Notion down) the catalog is the live games alone, each from the registry, and the list is what it was before it.
  const { entries } = await getCatalog()
  // One list for every game, each card a logo over a background on a grey frame. Every card is the game's Notion row, a live game's
  // included (its logo, or icon, and its background come from the catalog's picture route; a picture the row does not have leaves the
  // frame plain): the hub reads no game's Sanity project, only entering a game does. The registry decides the card's variant alone.
  // Each game goes to the browser with what the search reads of it (`indexEntry`) beside its card: the list is filtered there
  // (`GameSearch`, which the pill of the header and the list read), in the order of the catalog, and this page stays static.
  const games = entries.map((entry) => ({ ...indexEntry(entry), props: catalogCardProps(entry) }))

  // The page ends above the consent banner (`--consent-h`, set on <body>; 0px without a banner). It starts at the top of the window: the
  // fixed navbar is two containers with nothing between them, and the header band runs under both (`pt-navbar` keeps its text clear of them)
  return (
    <GameSearch games={games}>
      <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
        <SiteHeader />

        <main className="flex-1">
          {/* The header, centred, with the search pill laid over its lower edge (half of the pill's height, `-mt-7`, is pulled up into it) */}
          <section className="border-b bg-card pt-navbar">
            <div className="mx-auto flex w-full max-w-page flex-col items-center gap-4 px-gutter py-section text-center">
              <h1 className="max-w-2xl font-heading text-4xl md:text-6xl">Board games online, with friends.</h1>
              <p className="max-w-xl text-lg text-muted-foreground">{SITE_DESCRIPTION}</p>
            </div>
          </section>
          <div className="relative mx-auto -mt-7 w-full max-w-3xl px-gutter">
            <HeroSearch />
          </div>

          <section id="games" className="mx-auto w-full max-w-page scroll-mt-navbar px-gutter pt-10 pb-section">
            <h2 className="mb-6 font-heading text-2xl">Games</h2>
            <GameList />
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
    </GameSearch>
  )
}
