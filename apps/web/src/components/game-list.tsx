"use client"

import { DEFAULT_FILTER } from "@pbgo/catalog/filter"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { GameCard } from "@pbgo/ui/platform/game-card"
import { useGameSearch } from "@/components/game-search"

// The platform speaks English (a game's own pages are localized by the game)

/** "31 games", or "5 of 31 games" once the list is cut. */
function countText(shown: number, total: number): string {
  const games = total === 1 ? "game" : "games"
  return shown === total ? `${total} ${games}` : `${shown} of ${total} ${games}`
}

/**
 * The hub's list of games: the cards of the games that match the search bar of the home (`HeroSearch`: its text and its filters, held by
 * `GameSearch`), in the order of the catalog, or "No game matches" with a button that clears the search when none does. The count is for
 * screen readers (`role="status"`, so a change is announced): the cards are the answer for everyone else. The rules are
 * `@pbgo/catalog/filter`'s and this draws them. See docs/catalog.md.
 */
export function GameList() {
  const { games, shown, pick } = useGameSearch()

  // `data-game` only on the live games: analytics counts the games opened from the hub, and a game to come is not one
  return (
    <>
      <p role="status" className="sr-only">
        {countText(shown.length, games.length)}
      </p>

      {shown.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {shown.map(({ slug, live, props }) => (
            <GameCard key={slug} {...props} data-game={live ? slug : undefined} />
          ))}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No game matches</EmptyTitle>
            <EmptyDescription>Try another word, or put the filters back where they start.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => pick(DEFAULT_FILTER)}>
              Reset filters
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </>
  )
}
