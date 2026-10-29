import Link from "next/link"

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { GameCard } from "@pbgo/ui/platform/game-card"
import { Section, SectionAction, SectionPreview } from "@pbgo/ui/platform/section"
import type { SearchedGame } from "@/components/game-search"

// The sections of the home under its search bar, in the order of the page. They are server components: the HTML of the home carries them. None
// has a visible title, what it shows says what it is; each has an `sr-only` heading, so a screen reader still gets the outline of the page.

/** The most cards any width shows: three rows of the widest grid (five columns). */
const POPULAR_COUNT = 15

/**
 * The grid of the popular games is the one of `/games` (one column, then two, three, four and five from the breakpoints), cut to three rows at
 * every width: the cards beyond them are `hidden`, so they are neither drawn nor reached by the keyboard. Three rows are 3, 6, 9, 12 and 15 cards.
 */
const POPULAR_GRID =
  "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 " +
  "max-sm:[&>*:nth-child(n+4)]:hidden sm:max-lg:[&>*:nth-child(n+7)]:hidden lg:max-xl:[&>*:nth-child(n+10)]:hidden " +
  "xl:max-2xl:[&>*:nth-child(n+13)]:hidden 2xl:[&>*:nth-child(n+16)]:hidden"

/**
 * The popular games: the cards of the first games of the catalog in a grid of three rows whose bottom fades out, and "See all games" over the fade,
 * centred (`SectionPreview`), to `/games`. There is no count of plays to rank them by yet, one game being live and the rest to come, so they
 * come in the order of the catalog (the live games first, then the games to come by how soon they are): the day there is a count, this is the one
 * place that ranks. A live game is a "play" card, the others say "Coming soon".
 */
export function PopularGames({ games }: { games: readonly SearchedGame[] }) {
  return (
    <Section aria-labelledby="popular-games" className="pt-10">
      <h2 id="popular-games" className="sr-only">
        Popular games
      </h2>
      <SectionPreview
        action={
          <SectionAction asChild>
            <Link href="/games">See all games</Link>
          </SectionAction>
        }
      >
        {/* `data-game` only on the live games: analytics counts the games opened from the hub, and a game to come is not one */}
        <div className={POPULAR_GRID}>
          {games.slice(0, POPULAR_COUNT).map(({ slug, live, props }) => (
            <GameCard key={slug} {...props} data-game={live ? slug : undefined} />
          ))}
        </div>
      </SectionPreview>
    </Section>
  )
}

/**
 * A section with nothing to list yet (the tables and the tournaments in progress, what's new): an empty state that says what is to come
 * (`COMING_SOON`, the words of the page of its tab too), and the way to that page under it, centred. The rows of tables, or the cards of
 * tournaments, will take its place, with the same fade and the same button as the games. It stays on the home so the shape of the platform is
 * there to see.
 */
export function EmptySection({
  id,
  label,
  href,
  action,
  heading,
  description,
}: {
  id: string
  /** The `sr-only` heading of the section. */
  label: string
  /** The page of the section's tab. */
  href: string
  /** The button: "See all tables". */
  action: string
  heading: string
  description: string
}) {
  return (
    <Section aria-labelledby={id} className="items-center gap-6">
      <h2 id={id} className="sr-only">
        {label}
      </h2>
      <Empty className="border p-6">
        <EmptyHeader>
          <EmptyTitle>{heading}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
      <SectionAction asChild>
        <Link href={href}>{action}</Link>
      </SectionAction>
    </Section>
  )
}
