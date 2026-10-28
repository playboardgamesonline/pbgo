"use client"

import { useId, type ComponentProps } from "react"

import { Brain02Icon, ChildIcon, GridViewIcon, HourglassIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import {
  AGE_LIMITS,
  COMPLEXITY_LEVELS,
  DURATION_STOPS,
  FIRST_PICKS,
  MANY_PLAYERS,
  PLAYER_COUNTS,
  canStep,
  durationRangeOf,
  durationStopsOf,
  optionOf,
  stepOption,
  type DurationRange,
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
import { Meter } from "@pbgo/ui/platform/meter"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@pbgo/ui/platform/popover"
import { SearchBarFilters, SearchBarGroup, SearchBarIcon, SearchBarSegment, SearchBarStepper, SearchBarValue } from "@pbgo/ui/platform/search-bar"
import { Slider } from "@pbgo/ui/platform/slider"
import { useGameSearch } from "@/components/game-search"

// The platform speaks English (a game's own pages are localized by the game)

/** What a screen reader hears of a pick, and what a pointer shows over it. */
const playersText = (count: number): string => (count >= MANY_PLAYERS ? `${count}+ players` : count === 1 ? "1 player" : `${count} players`)
/** "+8 yrs": from 8 years old, which is how the box of a game says it. */
const ageText = (age: number): string => `+${age} yrs`
/** The first category picked, then how many more: "Cards", "Cards +2". */
const categoryText = (picked: readonly string[]): string => (picked.length > 1 ? `${picked[0]} +${picked.length - 1}` : (picked[0] ?? ""))

const LAST_STOP = DURATION_STOPS.length - 1

/**
 * The range the two thumbs stand for, as the duration filter writes it, with no unit since the hourglass beside it says it: "30–60", "0–45", "60–120+".
 * The first stop is 0, no lower limit, and the last is no upper limit: the thumbs on the two ends write "0–120+", every game.
 */
const durationText = (from: number, to: number): string => `${DURATION_STOPS[from]}–${DURATION_STOPS[to]}${to >= LAST_STOP ? "+" : ""}`

/** A thumb of the duration slider on a stop of the scale, as a screen reader hears it: the position alone would be "2". The two ends are no limit. */
const stopSays = (stop: number): string => (stop <= 0 ? "No minimum" : stop >= LAST_STOP ? "No maximum" : `${DURATION_STOPS[stop]} minutes`)

/** BoardGameGeek's word for each level of weight, from 1 to 5. */
const COMPLEXITY_NAMES = ["light", "medium light", "medium", "medium heavy", "heavy"] as const

/** What a screen reader hears for the bar of a level, and a pointer shows over it: "Complexity up to 3 of 5, medium". A game stays when its level is at most that. */
const complexitySays = (level: number): string => `Complexity up to ${level} of ${COMPLEXITY_LEVELS.length}, ${COMPLEXITY_NAMES[level - 1] ?? ""}`

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
  text,
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
  /** The number as it is written: "3", "8+". */
  text: (value: number) => string
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
      value={text(shown)}
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
export function CategoryFilter({
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
      <PopoverContent aria-labelledby={titleId} align="end" className="w-80">
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
 * The duration filter: the range written on the left with no unit, the hourglass right after it, then a slider with two thumbs along a scale of stops
 * (`DURATION_STOPS`), the range between them lit. The thumb on the first stop leaves the lower limit open and the one on the last the upper limit, so
 * "at most 30 minutes", "60 minutes or more" and "between 30 and 60" are all one gesture, and the thumbs on the two ends are no filter: that is how
 * it is cleared. The text has a width of its own, so the hourglass and the slider stay where they are while it changes.
 */
function DurationFilter({ current, onPick }: { current: DurationRange | null; onPick: (next: DurationRange | null) => void }) {
  const [from, to] = durationStopsOf(current)
  return (
    <SearchBarGroup label="Duration">
      <span className="flex items-center gap-2">
        {/* The thumbs say it to a screen reader, and the group names the filter */}
        <SearchBarValue aria-hidden="true" className="w-14 text-right">
          {durationText(from, to)}
        </SearchBarValue>
        <SearchBarIcon icon={HourglassIcon} />
      </span>
      <Slider
        className="mx-2 w-36"
        min={0}
        max={LAST_STOP}
        step={1}
        minStepsBetweenThumbs={1}
        value={[from, to]}
        onValueChange={([start = 0, end = LAST_STOP]) => onPick(durationRangeOf(start, end))}
        thumbLabels={["Shortest duration", "Longest duration"]}
        valueText={stopSays}
        ticks
      />
    </SearchBarGroup>
  )
}

/**
 * The complexity filter: its icon, then five bars of the same height that fill up to the level pressed, on the scale of the weight that BoardGameGeek gives
 * a game (1, light, to 5, heavy), with nothing written beside them. A game stays when its level, its weight rounded, is at most the one picked.
 * Pressing the picked level again clears it.
 */
function ComplexityFilter({ current, onPick }: { current: number | null; onPick: (next: number | null) => void }) {
  return (
    <SearchBarGroup label="Complexity">
      <SearchBarIcon icon={Brain02Icon} />
      <Meter levels={COMPLEXITY_LEVELS.length} value={current} onValueChange={onPick} levelLabel={complexitySays} />
    </SearchBarGroup>
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
        <SearchBarSegment icon={ChildIcon} label="Age" value={current === null ? "Any age" : ageText(current)} idle={current === null} boxed />
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
 * The four filters that stand under the bar, from the picks they are given and the way to change them (so `/design` can draw them with picks of its
 * own), each in a container of its own: the number of players, as a stepper; the duration, as a slider with two thumbs; the complexity, as bars that
 * fill; and the age of the youngest player, from a menu. A pick filters the list at once and goes into the address. The rules are
 * `@pbgo/catalog/filter`'s. See docs/catalog.md.
 */
export function MoreFilters({ filter, onFilterChange }: { filter: GameFilter; onFilterChange: (next: GameFilter) => void }) {
  return (
    <SearchBarFilters aria-label="More filters">
      <NumberStepper
        icon={UserMultipleIcon}
        label="Players"
        options={PLAYER_COUNTS}
        first={FIRST_PICKS.players}
        current={filter.players}
        onPick={(players) => onFilterChange({ ...filter, players })}
        text={(count) => (count >= MANY_PLAYERS ? `${count}+` : String(count))}
        says={playersText}
        decrease="Fewer players"
        increase="More players"
      />
      <DurationFilter current={filter.duration} onPick={(duration) => onFilterChange({ ...filter, duration })} />
      <ComplexityFilter current={filter.complexity} onPick={(complexity) => onFilterChange({ ...filter, complexity })} />
      <AgeFilter current={filter.age} onPick={(age) => onFilterChange({ ...filter, age })} />
    </SearchBarFilters>
  )
}

/** The category filter of the search of the page (`GameSearch`), for the end of the bar. */
export function SearchCategory() {
  const { categories, filter, pick } = useGameSearch()
  return <CategoryFilter categories={categories} picked={filter.categories} onPick={(next) => pick({ ...filter, categories: next })} />
}

/** The other filters of the search of the page (`GameSearch`), for the row under the bar. */
export function SearchMoreFilters() {
  const { filter, pick } = useGameSearch()
  return <MoreFilters filter={filter} onFilterChange={pick} />
}
