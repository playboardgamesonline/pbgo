import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, DiceIcon, Link01Icon, UserGroupIcon } from "@hugeicons/core-free-icons"
import Link from "next/link"

import { ConsentLink } from "@pbgo/analytics/client"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { GameCard } from "@pbgo/ui/platform/game-card"
import { Separator } from "@pbgo/ui/platform/separator"
import { gameCardProps } from "@/lib/game-card-props"
import { SITE_DESCRIPTION, SITE_NAME } from "@/site"
import { listedGames } from "@pbgo/games/registry"

// Plain <a> to the games (GameCard, Button asChild): the hub and the games have separate root layouts, so this is a full
// page load anyway, and the hub never prefetches a game's code.

const STEPS = [
  { icon: DiceIcon, title: "Pick a game", text: "Choose a board or card game and open a table in one click." },
  { icon: Link01Icon, title: "Share the link", text: "Send the table link or code to your friends. Nobody needs an account." },
  { icon: UserGroupIcon, title: "Play together", text: "Everyone plays from their own browser, rules and scoring handled for you." },
]

export default function Home() {
  const games = listedGames()
  const first = games[0]

  // The page ends above the consent banner (`--consent-h`, set on <body>; 0px without a banner)
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-page items-center justify-between px-gutter">
          <Link href="/" className="flex items-center gap-2">
            <HugeiconsIcon icon={DiceIcon} strokeWidth={2} className="size-5" />
            {SITE_NAME}
          </Link>
          <Button variant="ghost" asChild>
            <a href="#games">Games</a>
          </Button>
        </div>
      </header>

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <GameCard key={game.slug} {...gameCardProps(game)} data-game={game.slug} />
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

      <footer className="mx-auto w-full max-w-page px-gutter pb-10">
        <Separator className="mb-6" />
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>Unofficial, free online adaptations. Every game belongs to its authors and publisher.</p>
          <div className="flex items-center gap-4">
            {/* Only where analytics are on: it reopens the choice of the cookie banner */}
            <ConsentLink className="cursor-pointer underline-offset-4 hover:underline">Cookies</ConsentLink>
            <Link href="/legal" className="underline-offset-4 hover:underline">
              Legal notice
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
