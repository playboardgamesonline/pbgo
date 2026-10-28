"use client"

import { useId, useState, type ReactNode } from "react"

import { Baby01Icon, Clock01Icon, GridViewIcon, UserGroupIcon } from "@hugeicons/core-free-icons"
import { AGE_LIMITS, DURATION_LIMITS, MANY_PLAYERS, PLAYER_COUNTS, optionOf } from "@pbgo/catalog/filter"
import { Button } from "@pbgo/ui/platform/button"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@pbgo/ui/platform/popover"
import { SearchBarSegment, SearchBarSegments } from "@pbgo/ui/platform/search-bar"
import { ToggleGroup, ToggleGroupItem } from "@pbgo/ui/platform/toggle-group"
import { useGameSearch } from "@/components/game-search"

// The platform speaks English (a game's own pages are localized by the game)

/** What a segment says of a pick, and of no pick: its value, dimmed in the second case. */
function playersText(count: number): string {
  if (count >= MANY_PLAYERS) return `${count}+ players`
  return count === 1 ? "1 player" : `${count} players`
}
const durationText = (limit: number): string => `Up to ${limit} min`
const ageText = (age: number): string => `${age} years old`
/** The first category picked, then how many more: "Cards", "Cards +2". */
const categoryText = (picked: readonly string[]): string => (picked.length > 1 ? `${picked[0]} +${picked.length - 1}` : (picked[0] ?? ""))

/**
 * One filter of the bar: its segment and the panel it opens, a title and a Clear button above what there is to pick. `children` draws the
 * picks and is given the way to close the panel, for the filters that take a single pick and have nothing more to do once it is made.
 */
function Filter({
  icon,
  label,
  title,
  value,
  idle,
  onClear,
  wide = false,
  children,
}: {
  icon: React.ComponentProps<typeof SearchBarSegment>["icon"]
  /** What the segment shows above its value, and what a screen reader hears the panel is for. */
  label: string
  title: string
  value: string
  /** Nothing is picked: the value is dimmed and there is nothing to clear. */
  idle: boolean
  onClear: () => void
  /** A panel for a long list of chips. */
  wide?: boolean
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SearchBarSegment icon={icon} label={label} value={value} idle={idle} />
      </PopoverTrigger>
      <PopoverContent aria-labelledby={titleId} className={wide ? "w-80" : undefined}>
        <PopoverHeader>
          <PopoverTitle id={titleId}>{title}</PopoverTitle>
          <Button type="button" variant="ghost" size="sm" disabled={idle} onClick={onClear}>
            Clear
          </Button>
        </PopoverHeader>
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  )
}

/**
 * The filters of the home's search bar: the category (several at once, only when some game has one), the number of players, the duration
 * and the age of the youngest player. Each is a segment that opens a panel of chips; a pick filters the list at once and goes into the address.
 * The category panel stays open, since a visitor picks several; the others close on the pick. They are the lower floor of the bar, under the
 * field and the round button (`SearchBar`). The rules are `@pbgo/catalog/filter`'s. See docs/catalog.md.
 */
export function SearchFilters() {
  const { categories, filter, pick } = useGameSearch()

  return (
    <SearchBarSegments aria-label="Filter the games">
      {categories.length > 0 && (
        <Filter
          icon={GridViewIcon}
          label="Category"
          title="Categories"
          value={filter.categories.length === 0 ? "Any category" : categoryText(filter.categories)}
          idle={filter.categories.length === 0}
          onClear={() => pick({ ...filter, categories: [] })}
          wide
        >
          {() => (
            <ToggleGroup
              type="multiple"
              value={[...filter.categories]}
              onValueChange={(next) => pick({ ...filter, categories: next })}
              aria-label="Categories"
            >
              {categories.map((category) => (
                <ToggleGroupItem key={category} value={category}>
                  {category}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </Filter>
      )}

      <Filter
        icon={UserGroupIcon}
        label="Players"
        title="Number of players"
        value={filter.players === null ? "Any players" : playersText(filter.players)}
        idle={filter.players === null}
        onClear={() => pick({ ...filter, players: null })}
      >
        {(close) => (
          <ToggleGroup
            type="single"
            value={filter.players === null ? "" : String(filter.players)}
            onValueChange={(next) => {
              pick({ ...filter, players: optionOf(PLAYER_COUNTS, next) })
              close()
            }}
            aria-label="Number of players"
          >
            {PLAYER_COUNTS.map((count) => (
              <ToggleGroupItem key={count} value={String(count)} aria-label={playersText(count)}>
                {count >= MANY_PLAYERS ? `${count}+` : count}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </Filter>

      <Filter
        icon={Clock01Icon}
        label="Duration"
        title="Longest game"
        value={filter.duration === null ? "Any duration" : durationText(filter.duration)}
        idle={filter.duration === null}
        onClear={() => pick({ ...filter, duration: null })}
      >
        {(close) => (
          <ToggleGroup
            type="single"
            value={filter.duration === null ? "" : String(filter.duration)}
            onValueChange={(next) => {
              pick({ ...filter, duration: optionOf(DURATION_LIMITS, next) })
              close()
            }}
            aria-label="Longest game"
          >
            {DURATION_LIMITS.map((limit) => (
              <ToggleGroupItem key={limit} value={String(limit)} aria-label={durationText(limit)}>
                {limit} min
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </Filter>

      <Filter
        icon={Baby01Icon}
        label="Age"
        title="Age of the youngest player"
        value={filter.age === null ? "Any age" : ageText(filter.age)}
        idle={filter.age === null}
        onClear={() => pick({ ...filter, age: null })}
      >
        {(close) => (
          <ToggleGroup
            type="single"
            value={filter.age === null ? "" : String(filter.age)}
            onValueChange={(next) => {
              pick({ ...filter, age: optionOf(AGE_LIMITS, next) })
              close()
            }}
            aria-label="Age of the youngest player"
          >
            {AGE_LIMITS.map((age) => (
              <ToggleGroupItem key={age} value={String(age)} aria-label={ageText(age)}>
                {age}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </Filter>
    </SearchBarSegments>
  )
}
