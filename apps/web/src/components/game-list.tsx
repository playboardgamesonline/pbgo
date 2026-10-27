"use client"

import {
  AVAILABILITIES,
  DURATION_LIMITS,
  MANY_PLAYERS,
  NO_FILTER,
  PLAYER_COUNTS,
  isFiltered,
  optionOf,
  type Availability,
} from "@pbgo/catalog/filter"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { GameCard } from "@pbgo/ui/platform/game-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { useGameSearch } from "@/components/game-search"

// The platform speaks English (a game's own pages are localized by the game)
const AVAILABILITY_TEXTS: Record<Availability, string> = { all: "All games", play: "Play now", soon: "Coming soon" }
const ANY_PLAYERS = "Any players"
const ANY_DURATION = "Any duration"

// The value of the option of a select that is no pick. A select has no empty value (the empty one is its placeholder), and no option spells this.
const ANY = "any"

// Where the picks of a select go in the toolbar: a row of its own on a phone, the width of a third of it on a tablet, a fixed one on a desktop
const SELECT_WIDTH = "w-full lg:w-44"

function playersText(count: number): string {
  if (count >= MANY_PLAYERS) return `${count}+ players`
  return count === 1 ? "1 player" : `${count} players`
}

function durationText(limit: number): string {
  return `Up to ${limit} min`
}

/** "31 games", or "5 of 31 games" once the list is cut. */
function countText(shown: number, total: number): string {
  const games = total === 1 ? "game" : "games"
  return shown === total ? `${total} ${games}` : `${shown} of ${total} ${games}`
}

/** A select of the toolbar for a pick among numbers: "any" (no pick), then one option for each of `options`. */
function NumberSelect({
  label,
  anyText,
  options,
  text,
  value,
  onPick,
  className,
}: {
  /** What a screen reader says of the select, which shows no label of its own: its value says what it holds. */
  label: string
  anyText: string
  options: readonly number[]
  text: (option: number) => string
  value: number | null
  onPick: (option: number | null) => void
  className?: string
}) {
  return (
    <Select value={value === null ? ANY : String(value)} onValueChange={(next) => onPick(optionOf(options, next))}>
      <SelectTrigger aria-label={label} className={className}>
        {/* The text is given here, not read from the chosen item: the items are not in the page until the select opens, so the server would draw the trigger empty */}
        <SelectValue>{value === null ? anyText : text(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectItem value={ANY}>{anyText}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={String(option)}>
            {text(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * The hub's list of games: under the search of the home (`GameSearch`), the three filters (availability, number of players, duration), the
 * count, then the cards of the games that match, in the order of the catalog, or "No game matches" when none does. The text of the search is
 * the pill of the header (`HeroSearch`); the rules are `@pbgo/catalog/filter`'s and this draws them. See docs/catalog.md.
 */
export function GameList() {
  const { games, filter, shown, pick } = useGameSearch()

  // `data-game` only on the live games: analytics counts the games opened from the hub, and a game to come is not one
  return (
    <>
      <div
        role="group"
        aria-label="Filter the games"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center"
      >
        <Select
          value={filter.availability}
          onValueChange={(next) => pick({ ...filter, availability: optionOf(AVAILABILITIES, next) ?? "all" })}
        >
          <SelectTrigger aria-label="Availability" className={SELECT_WIDTH}>
            <SelectValue>{AVAILABILITY_TEXTS[filter.availability]}</SelectValue>
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            {AVAILABILITIES.map((availability) => (
              <SelectItem key={availability} value={availability}>
                {AVAILABILITY_TEXTS[availability]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <NumberSelect
          label="Number of players"
          anyText={ANY_PLAYERS}
          options={PLAYER_COUNTS}
          text={playersText}
          value={filter.players}
          onPick={(players) => pick({ ...filter, players })}
          className={SELECT_WIDTH}
        />

        <NumberSelect
          label="Duration"
          anyText={ANY_DURATION}
          options={DURATION_LIMITS}
          text={durationText}
          value={filter.duration}
          onPick={(duration) => pick({ ...filter, duration })}
          className={`${SELECT_WIDTH} col-span-2 sm:col-span-1`}
        />
      </div>

      <div className="mt-3 flex min-h-8 items-center justify-between gap-4">
        <p role="status" className="text-sm text-muted-foreground">
          {countText(shown.length, games.length)}
        </p>
        {isFiltered(filter) && (
          <Button variant="ghost" size="sm" onClick={() => pick(NO_FILTER)}>
            Clear filters
          </Button>
        )}
      </div>

      {shown.length > 0 ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {shown.map(({ slug, live, props }) => (
            <GameCard key={slug} {...props} data-game={live ? slug : undefined} />
          ))}
        </div>
      ) : (
        <Empty className="mt-3 border">
          <EmptyHeader>
            <EmptyTitle>No game matches</EmptyTitle>
            <EmptyDescription>Try another word, or clear the filters to see every game.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </>
  )
}
