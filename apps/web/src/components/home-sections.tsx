import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, DiceIcon, Link01Icon, UserGroupIcon } from "@hugeicons/core-free-icons"

import { Card, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { GameCard } from "@pbgo/ui/platform/game-card"
import { Section, SectionAction, SectionHeader, SectionRail, SectionTitle } from "@pbgo/ui/platform/section"
import type { SearchedGame } from "@/components/game-search"

// The sections of the home under its search bar, in the order of the page. They are server components: the HTML of the home carries them.

/** The "See all" of a section: the words and an arrow, to the page of the section's tab. `label` names it for a screen reader, since a page has several. */
function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <SectionAction asChild>
      <Link href={href} aria-label={label}>
        See all
        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" />
      </Link>
    </SectionAction>
  )
}

/** How many games the home's row of popular games holds. */
export const POPULAR_COUNT = 16

/**
 * The popular games: a row of cards that scrolls sideways, then "See all" to `/games`. There is no count of plays to rank them by yet, one
 * live game and the rest to come, so they come in the order of the catalog (the live games first, then the games to come by how soon they
 * are): the day there is a count, this is the one place that ranks. A live game is a "play" card, the others say "Coming soon".
 */
export function PopularGames({ games }: { games: readonly SearchedGame[] }) {
  return (
    <Section aria-labelledby="popular-games" className="pt-10">
      <SectionHeader>
        <SectionTitle id="popular-games">Popular games</SectionTitle>
        <SeeAll href="/games" label="See all games" />
      </SectionHeader>
      {/* `data-game` only on the live games: analytics counts the games opened from the hub, and a game to come is not one */}
      <SectionRail aria-label="Popular games">
        {games.slice(0, POPULAR_COUNT).map(({ slug, live, props }) => (
          <GameCard key={slug} {...props} data-game={live ? slug : undefined} />
        ))}
      </SectionRail>
    </Section>
  )
}

/**
 * A section with nothing to list yet (the tables and the tournaments in progress, what's new): its title, "See all", and a line that says
 * what is to come (`COMING_SOON`). The page of its tab says the same. It stays on the home so the shape of the platform is there to see.
 */
export function EmptySection({
  id,
  title,
  href,
  label,
  heading,
  description,
}: {
  id: string
  title: string
  /** The page of the section's tab. */
  href: string
  /** What "See all" is for a screen reader: "See all tables". */
  label: string
  heading: string
  description: string
}) {
  return (
    <Section aria-labelledby={id}>
      <SectionHeader>
        <SectionTitle id={id}>{title}</SectionTitle>
        <SeeAll href={href} label={label} />
      </SectionHeader>
      {/* Compact (`p-6`, not the `p-12` of a page with nothing else): the home stacks three of them */}
      <Empty className="border p-6">
        <EmptyHeader>
          <EmptyTitle>{heading}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </Section>
  )
}

const STEPS = [
  { icon: DiceIcon, title: "Pick a game", text: "Choose a board or card game and open a table in one click." },
  { icon: Link01Icon, title: "Share the link", text: "Send the table link or code to your friends so they can join you." },
  { icon: UserGroupIcon, title: "Play together", text: "Everyone plays from their own browser, rules and scoring handled for you." },
]

/** Three steps for a first visit, between the platform's sections and what's new. */
export function HowItWorks() {
  return (
    <Section aria-labelledby="how-it-works">
      <SectionHeader>
        <SectionTitle id="how-it-works">How it works</SectionTitle>
      </SectionHeader>
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
    </Section>
  )
}
