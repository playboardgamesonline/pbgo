import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, DiceIcon, Globe02Icon, Link01Icon, UserGroupIcon } from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { GAMES } from "@/games"
import { SITE_DESCRIPTION, SITE_NAME } from "@/site"

// Plain <a> to games (via Button asChild): each game is a separate app (multi-zones), so navigation is a full page load.

const STEPS = [
  { icon: DiceIcon, title: "Pick a game", text: "Choose a board or card game and open a table in one click." },
  { icon: Link01Icon, title: "Share the link", text: "Send the table link or code to your friends. Nobody needs an account." },
  { icon: UserGroupIcon, title: "Play together", text: "Everyone plays from their own browser, rules and scoring handled for you." },
]

export default function Home() {
  const games = GAMES.filter((g) => g.listed)
  const first = games[0]

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2 font-semibold">
            <HugeiconsIcon icon={DiceIcon} strokeWidth={2} className="size-5" />
            {SITE_NAME}
          </a>
          <Button variant="ghost" asChild>
            <a href="#games">Games</a>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-4 py-16 md:py-24">
          <Badge variant="secondary">Free · No sign-up · In your browser</Badge>
          <h1 className="max-w-2xl font-heading text-4xl font-semibold tracking-tight text-balance md:text-6xl">
            Board games online, with friends.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">{SITE_DESCRIPTION}</p>
          <div className="flex flex-wrap gap-3">
            {first && (
              <Button size="lg" asChild>
                <a href={`/${first.slug}`}>
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

        <section id="games" className="mx-auto w-full max-w-5xl scroll-mt-20 px-4 pb-16">
          <h2 className="mb-6 font-heading text-2xl font-semibold tracking-tight">Games</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <Card key={game.slug}>
                <CardHeader>
                  <CardTitle className="text-lg">{game.name}</CardTitle>
                  <CardDescription>{game.tagline}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />
                    {game.players.min}–{game.players.max} players
                  </Badge>
                  <Badge variant="outline">
                    <HugeiconsIcon icon={Globe02Icon} strokeWidth={2} />
                    Online
                  </Badge>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" asChild>
                    <a href={`/${game.slug}`}>
                      Play
                      <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-24">
          <h2 className="mb-6 font-heading text-2xl font-semibold tracking-tight">How it works</h2>
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

      <footer className="mx-auto w-full max-w-5xl px-4 pb-10">
        <Separator className="mb-6" />
        <p className="text-sm text-muted-foreground">
          Unofficial, free online adaptations. Every game belongs to its authors and publisher.
        </p>
      </footer>
    </div>
  )
}
