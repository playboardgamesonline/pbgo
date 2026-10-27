"use client"

import { useRef, useState, useSyncExternalStore } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons"

import {
  AVAILABILITIES,
  DURATION_LIMITS,
  MANY_PLAYERS,
  MAX_QUERY_LENGTH,
  NO_FILTER,
  PLAYER_COUNTS,
  filterFromParams,
  filterGames,
  filterToParams,
  isFiltered,
  optionOf,
  type Availability,
  type GameFilter,
  type GameIndex,
} from "@pbgo/catalog/filter"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { GameCard, type GameCardProps } from "@pbgo/ui/platform/game-card"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@pbgo/ui/platform/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"

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

// The query string of the address, read once the page is in the browser. The home is static, so the server does not know it: the server and the
// first render of the browser both see none (`getServerSnapshot`), which keeps the hydration whole, and the list opens on the picks of the link
// right after. Nothing changes the address under the page (the picks rewrite it, but by then they are in the state), so nothing is subscribed to.
const subscribeToNothing = () => () => {}
const readSearch = () => window.location.search
const readNoSearch = () => ""

/** Writes the picks into the address of the page, in place: the list as the visitor has it is not a page to come back to with the back button. */
function writeAddress(filter: GameFilter) {
  try {
    const url = new URL(window.location.href)
    url.search = filterToParams(filter).toString()
    window.history.replaceState(null, "", url)
  } catch {
    // The address is a convenience: a browser can refuse to rewrite it (Safari past 100 calls in 30 s, a page in a sandboxed frame)
  }
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
 * The hub's list of games with its search and its filters: the cards of the games that match, in the order of the catalog, under a field and
 * three selects (availability, number of players, duration). The rules are `@pbgo/catalog/filter`'s; this draws them. It all happens in the
 * browser on the index that the page sends with the cards, so nothing is asked of the server, the home stays static, and the HTML of the page
 * lists every game.
 * The three picks are in the address of the page (`?show=soon&players=4&duration=30`), so that a link opens the list as it was left. The text of
 * the search is not: the address goes to analytics with every event, and what a visitor types is theirs. See docs/catalog.md.
 */
export function GameBrowser({ games }: { games: readonly (GameIndex & { props: GameCardProps })[] }) {
  const search = useSyncExternalStore(subscribeToNothing, readSearch, readNoSearch)
  // What the visitor has changed since the page opened, else what the address holds
  const [edited, setEdited] = useState<GameFilter | null>(null)
  const filter = edited ?? filterFromParams(new URLSearchParams(search))
  const shown = filterGames(games, filter)
  const field = useRef<HTMLInputElement>(null)

  function pick(next: GameFilter) {
    setEdited(next)
    writeAddress(next)
  }

  // `data-game` only on the live games: analytics counts the games opened from the hub, and a game to come is not one
  return (
    <>
      <div
        role="search"
        aria-label="Search and filter the games"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center"
      >
        <form
          className="col-span-2 sm:col-span-3 lg:w-80"
          onSubmit={(event) => {
            event.preventDefault()
            // The list follows what is typed, so there is nothing to submit. On a phone the search key puts the keyboard away, which hid the list.
            if (window.matchMedia("(pointer: coarse)").matches) field.current?.blur()
          }}
        >
          <InputGroup>
            <InputGroupAddon>
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
            </InputGroupAddon>
            <InputGroupInput
              ref={field}
              type="search"
              value={filter.query}
              onChange={(event) => setEdited({ ...filter, query: event.target.value })}
              aria-label="Search a game"
              placeholder="Search a game"
              maxLength={MAX_QUERY_LENGTH}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              // The browser's own clear button, where it has one, is replaced by the one below, so that the field looks the same everywhere
              className="[&::-webkit-search-cancel-button]:appearance-none"
            />
            {filter.query !== "" && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear the search"
                  onClick={() => {
                    setEdited({ ...filter, query: "" })
                    field.current?.focus()
                  }}
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </form>

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
