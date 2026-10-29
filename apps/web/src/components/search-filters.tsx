"use client"

import { useId, type ComponentProps } from "react"

import { Brain02Icon, ChildIcon, GridViewIcon, HourglassIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import {
  AGE_LIMITS,
  COMPLEXITY_LEVELS,
  DEFAULT_AGE,
  DEFAULT_COMPLEXITY,
  DEFAULT_PLAYERS,
  DURATION_LIMITS,
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
import { Meter } from "@pbgo/ui/platform/meter"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@pbgo/ui/platform/popover"
import { SearchBarFilters, SearchBarGroup, SearchBarIcon, SearchBarSegment, SearchBarStepper, SearchBarValue } from "@pbgo/ui/platform/search-bar"
import { Slider } from "@pbgo/ui/platform/slider"
import { useGameSearch } from "@/components/game-search"
import { categoryIcon } from "@/lib/category-icons"

// The platform speaks English (a game's own pages are localized by the game)

/** What a screen reader hears of a pick, and what a pointer shows over it. */
const playersText = (count: number): string => (count >= MANY_PLAYERS ? `${count}+ players` : count === 1 ? "1 player" : `${count} players`)
/** "8+": from 8 years old, which is how the box of a game says it. */
const ageText = (age: number): string => `${age}+`

// The duration slider has a step for each limit and one more, "1h+", which is no limit: the games of an hour or more stay only there
const limits: readonly number[] = DURATION_LIMITS
const LAST_STEP = limits.length

/** Where the thumb of the duration slider sits for a limit: its step, the last for no limit. */
const stepOfLimit = (limit: number | null): number => (limit === null ? LAST_STEP : Math.max(0, limits.indexOf(limit)))
/** The limit a step stands for, none for the last. */
const limitOfStep = (step: number): number | null => limits[step] ?? null
/** What is written next to the hourglass: the minutes and their mark, "5′", "10′" … "55′", and "1h+" for no limit. No unit word, since the hourglass says it. */
const durationText = (step: number): string => (step >= LAST_STEP ? "1h+" : `${limits[step]}′`)
/** What a screen reader hears for the thumb of the duration slider: "Up to 30 minutes", "An hour or more". */
const stepSays = (step: number): string => (step >= LAST_STEP ? "An hour or more" : `Up to ${limits[step]} minutes`)

/** BoardGameGeek's word for each level of weight, from 1 to 5. */
const COMPLEXITY_NAMES = ["light", "medium light", "medium", "medium heavy", "heavy"] as const

/** What a screen reader hears for the bar of a level, and a pointer shows over it: "Complexity up to 3 of 5, medium". A game stays when its level is at most that. */
const complexitySays = (level: number): string => `Complexity up to ${level} of ${COMPLEXITY_LEVELS.length}, ${COMPLEXITY_NAMES[level - 1] ?? ""}`

/**
 * A number of the bar, as a stepper: a minus button, the number with its icon just after it, and a plus button, with no panel (`SearchBarStepper`).
 * The number always has a value, `start` until the visitor moves it, and the buttons move it along `options` one place at a time (`stepOption`), down
 * to the first or up to the last, which they stop at.
 */
export function NumberStepper({
  icon,
  label,
  options,
  start,
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
  /** Where the number starts, one of the options. */
  start: number
  /** The pick, null for none: the number then shows `start`. */
  current: number | null
  onPick: (next: number) => void
  /** The number as it is written: "4", "8+". */
  text: (value: number) => string
  /** The number as a screen reader hears it: "4 players". */
  says: (value: number) => string
  /** What the two buttons do: "Fewer players", "More players". */
  decrease: string
  increase: string
}) {
  const shown = current ?? start
  return (
    <SearchBarStepper
      icon={icon}
      label={label}
      value={text(shown)}
      valueLabel={says(shown)}
      decreaseLabel={decrease}
      increaseLabel={increase}
      canDecrease={canStep(options, shown, -1)}
      canIncrease={canStep(options, shown, 1)}
      onDecrease={() => onPick(stepOption(options, shown, -1, start))}
      onIncrease={() => onPick(stepOption(options, shown, 1, start))}
    />
  )
}

/**
 * The category filter: a segment that opens a panel with the categories as a list with a search field (`Combobox`), each with its icon (`categoryIcon`),
 * several of which can be picked, and a Clear button in the header above it. The segment draws what is picked, up to three categories with their icons
 * (and their names, where the bar has the room), then "+N". Its panel says so when no game has a category yet.
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
        <SearchBarSegment
          icon={GridViewIcon}
          label="Category"
          value={none ? "Any category" : picked.join(", ")}
          idle={none}
          picks={picked.map((name) => ({ label: name, icon: categoryIcon(name) }))}
        />
      </PopoverTrigger>
      <PopoverContent aria-labelledby={titleId} align="end" className="w-52 gap-0 p-0">
        <PopoverHeader className="pt-2 pr-2 pb-1 pl-4">
          <PopoverTitle id={titleId}>Categories</PopoverTitle>
          <Button type="button" variant="ghost" size="sm" disabled={none} onClick={() => onPick([])}>
            Clear
          </Button>
        </PopoverHeader>
        {categories.length > 0 ? (
          <Combobox
            options={categories.map((name) => ({ value: name, icon: categoryIcon(name) }))}
            value={picked}
            onValueChange={onPick}
            aria-label="Categories"
            placeholder="Search categories..."
            empty="No category matches."
          />
        ) : (
          <p className="px-4 pt-2 pb-4 text-sm text-muted-foreground">No category yet.</p>
        )}
      </PopoverContent>
    </Popover>
  )
}

/**
 * The duration filter: the hourglass, the limit written next to it (its minutes and the minute mark, "30′", or "1h+" for no limit), then a slider
 * with one thumb on twelve steps, from 5′ to 55′ five minutes at a time and "1h+". A game stays when it takes at most that long, and the last step
 * is no limit. The slider starts on 20′ (`DEFAULT_DURATION`, which the filter holds) and the fill runs from the first step to the thumb, so the limit can
 * be seen. The text has a width of its own, so the slider stays where it is while the text changes.
 */
function DurationFilter({ current, onPick }: { current: number | null; onPick: (next: number | null) => void }) {
  const step = stepOfLimit(current)
  return (
    <SearchBarGroup label="Duration">
      <span className="flex items-center gap-2">
        <SearchBarIcon icon={HourglassIcon} />
        {/* The thumb says it to a screen reader, and the group names the filter */}
        <SearchBarValue aria-hidden="true" className="w-8">
          {durationText(step)}
        </SearchBarValue>
      </span>
      <Slider
        className="mx-1 w-16"
        min={0}
        max={LAST_STEP}
        step={1}
        value={[step]}
        onValueChange={([next = LAST_STEP]) => onPick(limitOfStep(next))}
        thumbLabels={["Longest duration"]}
        valueText={stepSays}
      />
    </SearchBarGroup>
  )
}

/**
 * The complexity filter: its icon, then five bars of the same height that fill up to the level pressed, on the scale of the weight that BoardGameGeek
 * gives a game (1, light, to 5, heavy), with nothing written beside them. A game stays when its level, its weight rounded, is at most the one picked.
 * There is always a level, `DEFAULT_COMPLEXITY` until the visitor presses another bar, and the bars never go below the first: the meter is not
 * `clearable`, so pressing the picked level keeps it.
 */
function ComplexityFilter({ current, onPick }: { current: number | null; onPick: (next: number) => void }) {
  return (
    <SearchBarGroup label="Complexity">
      <SearchBarIcon icon={Brain02Icon} />
      <Meter
        levels={COMPLEXITY_LEVELS.length}
        value={current ?? DEFAULT_COMPLEXITY}
        clearable={false}
        onValueChange={(next) => next !== null && onPick(next)}
        levelLabel={complexitySays}
      />
    </SearchBarGroup>
  )
}

/**
 * The age filter: a segment, like the category's, that opens a menu with one age to pick ("8+": the youngest player is 8, so a game stays when its
 * minimum age is at most that), since the ages are a short list to read and not a number to step through. One of them is always picked, `DEFAULT_AGE`
 * until the visitor picks another, so there is no "any".
 */
function AgeFilter({ current, onPick }: { current: number | null; onPick: (next: number) => void }) {
  const age = current ?? DEFAULT_AGE
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SearchBarSegment icon={ChildIcon} label="Age" value={ageText(age)} boxed />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-0">
        <DropdownMenuRadioGroup
          value={String(age)}
          onValueChange={(next) => {
            const picked = optionOf(AGE_LIMITS, next)
            if (picked !== null) onPick(picked)
          }}
        >
          {AGE_LIMITS.map((limit) => (
            <DropdownMenuRadioItem key={limit} value={String(limit)}>
              {ageText(limit)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The four filters that stand under the bar, from the picks they are given and the way to change them (so `/design` can draw them with picks of its
 * own), each in a place of its own with no background: the number of players, as a stepper that starts on 4; the duration, as a slider with one
 * thumb that starts on 20′; the complexity, as bars that fill and start on 3; and the age of the youngest player, from a menu that starts on 8+. A pick filters the list at once and
 * goes into the address. The rules are `@pbgo/catalog/filter`'s. See docs/catalog.md.
 */
export function MoreFilters({ filter, onFilterChange }: { filter: GameFilter; onFilterChange: (next: GameFilter) => void }) {
  return (
    <SearchBarFilters aria-label="More filters">
      <NumberStepper
        icon={UserMultipleIcon}
        label="Players"
        options={PLAYER_COUNTS}
        start={DEFAULT_PLAYERS}
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
