"use client"

import { useId, type ComponentProps } from "react"

import { ChildIcon, GridViewIcon, HourglassIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import {
  AGE_LIMITS,
  DURATION_LIMITS,
  FIRST_PICKS,
  MANY_PLAYERS,
  PLAYER_COUNTS,
  canStep,
  optionOf,
  stepOption,
  type GameFilter,
} from "@pbgo/catalog/filter"
import { Button } from "@pbgo/ui/platform/button"
import { Combobox } from "@pbgo/ui/platform/combobox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@pbgo/ui/platform/dropdown-menu"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@pbgo/ui/platform/popover"
import { SearchBarSegment, SearchBarSegments, SearchBarStepper } from "@pbgo/ui/platform/search-bar"
import { useGameSearch } from "@/components/game-search"

// The platform speaks English (a game's own pages are localized by the game)

/** What a screen reader hears of a pick, and what a pointer shows over it. */
const playersText = (count: number): string => (count >= MANY_PLAYERS ? `${count}+ players` : count === 1 ? "1 player" : `${count} players`)
const durationText = (limit: number): string => `Up to ${limit} min`
/** "+8 yrs": from 8 years old, which is how the box of a game says it. */
const ageText = (age: number): string => `+${age} yrs`
/** The first category picked, then how many more: "Cards", "Cards +2". */
const categoryText = (picked: readonly string[]): string => (picked.length > 1 ? `${picked[0]} +${picked.length - 1}` : (picked[0] ?? ""))

/**
 * A number of the bar, as a stepper: a minus button, the number and a plus button, with no panel (`SearchBarStepper`). Nothing is picked until a
 * press: the number it shows then (`first`, dimmed) is the one the first press on either button picks, and the buttons move along `options` from
 * there, one place at a time (`stepOption`). Pressing the number picks it, or clears the pick once it is picked.
 */
export function NumberStepper({
  icon,
  label,
  options,
  first,
  current,
  onPick,
  chip,
  says,
  decrease,
  increase,
}: {
  icon: ComponentProps<typeof SearchBarStepper>["icon"]
  label: string
  options: readonly number[]
  /** The number the first press picks, one of the options. */
  first: number
  /** The pick, null for none. */
  current: number | null
  onPick: (next: number | null) => void
  /** The number as the chip writes it, with its unit when the icon alone does not say it: "3", "8+", "45 min", "8 yrs". */
  chip: (value: number) => string
  /** The number as a screen reader hears it: "3 players". */
  says: (value: number) => string
  /** What the two buttons do: "Fewer players", "More players". */
  decrease: string
  increase: string
}) {
  const shown = current ?? first
  return (
    <SearchBarStepper
      icon={icon}
      label={label}
      value={chip(shown)}
      idle={current === null}
      valueLabel={says(shown)}
      valueTitle={current === null ? says(first) : `Clear: ${says(current)}`}
      onValueClick={() => onPick(current === null ? first : null)}
      decreaseLabel={decrease}
      increaseLabel={increase}
      canDecrease={canStep(options, current, -1)}
      canIncrease={canStep(options, current, 1)}
      onDecrease={() => onPick(stepOption(options, current, -1, first))}
      onIncrease={() => onPick(stepOption(options, current, 1, first))}
    />
  )
}

/**
 * The category filter: a segment that opens a panel with the categories as a list with a search field (`Combobox`), several of which can be
 * picked, and a Clear button above it. Its panel says so when no game has a category yet.
 */
function CategoryFilter({
  categories,
  picked,
  onPick,
}: {
  categories: readonly string[]
  picked: readonly string[]
  onPick: (next: string[]) => void
}) {
  const titleId = useId()
  const none = picked.length === 0
  return (
    <Popover>
      <PopoverTrigger asChild>
        <SearchBarSegment icon={GridViewIcon} label="Category" value={none ? "Any category" : categoryText(picked)} idle={none} />
      </PopoverTrigger>
      <PopoverContent aria-labelledby={titleId} className="w-80">
        <PopoverHeader>
          <PopoverTitle id={titleId}>Categories</PopoverTitle>
          <Button type="button" variant="ghost" size="sm" disabled={none} onClick={() => onPick([])}>
            Clear
          </Button>
        </PopoverHeader>
        {categories.length > 0 ? (
          <Combobox
            options={categories}
            value={picked}
            onValueChange={onPick}
            aria-label="Categories"
            placeholder="Search categories..."
            empty="No category matches."
          />
        ) : (
          <p className="text-sm text-muted-foreground">No category yet.</p>
        )}
      </PopoverContent>
    </Popover>
  )
}

/**
 * The age filter: a segment, like the category's, that opens a menu with one age to pick ("+8 yrs": the youngest player is 8, so a game stays when
 * its minimum age is at most that) or none, since the ages are a short list to read and not a number to step through.
 */
function AgeFilter({ current, onPick }: { current: number | null; onPick: (next: number | null) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SearchBarSegment icon={ChildIcon} label="Age" value={current === null ? "Any age" : ageText(current)} idle={current === null} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        {/* "any" is not one of the ages, so `optionOf` reads it as none */}
        <DropdownMenuRadioGroup value={current === null ? "any" : String(current)} onValueChange={(next) => onPick(optionOf(AGE_LIMITS, next))}>
          <DropdownMenuRadioItem value="any">Any age</DropdownMenuRadioItem>
          {AGE_LIMITS.map((age) => (
            <DropdownMenuRadioItem key={age} value={String(age)}>
              {ageText(age)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The four segments of the search bar, from the picks they are given and the way to change them (so `/design` can draw them with picks of its
 * own): the category (several at once, from a list with a search field), then the number of players and the longest duration, each a stepper,
 * and the age of the youngest player, from a menu. A pick filters the list at once and goes into the address. The rules are `@pbgo/catalog/filter`'s. See
 * docs/catalog.md.
 */
export function FilterSegments({
  categories,
  filter,
  onFilterChange,
}: {
  categories: readonly string[]
  filter: GameFilter
  onFilterChange: (next: GameFilter) => void
}) {
  return (
    <SearchBarSegments aria-label="Filter the games">
      <CategoryFilter categories={categories} picked={filter.categories} onPick={(next) => onFilterChange({ ...filter, categories: next })} />
      <NumberStepper
        icon={UserMultipleIcon}
        label="Players"
        options={PLAYER_COUNTS}
        first={FIRST_PICKS.players}
        current={filter.players}
        onPick={(players) => onFilterChange({ ...filter, players })}
        chip={(count) => (count >= MANY_PLAYERS ? `${count}+` : String(count))}
        says={playersText}
        decrease="Fewer players"
        increase="More players"
      />
      <NumberStepper
        icon={HourglassIcon}
        label="Duration"
        options={DURATION_LIMITS}
        first={FIRST_PICKS.duration}
        current={filter.duration}
        onPick={(duration) => onFilterChange({ ...filter, duration })}
        chip={(limit) => `${limit} min`}
        says={durationText}
        decrease="Shorter games"
        increase="Longer games"
      />
      <AgeFilter current={filter.age} onPick={(age) => onFilterChange({ ...filter, age })} />
    </SearchBarSegments>
  )
}

/** The filters of the search of the page (`GameSearch`): the segments of the search bar, on the picks it holds. */
export function SearchFilters() {
  const { categories, filter, pick } = useGameSearch()
  return <FilterSegments categories={categories} filter={filter} onFilterChange={pick} />
}
