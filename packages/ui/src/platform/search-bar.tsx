import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, MinusSignIcon, PlusSignIcon, Search01Icon } from "@hugeicons/core-free-icons"
import { cn } from "../utils"

import { Button } from "./button"

// The big search bar of a page: a field (`SearchBarField`: the text and a button that clears it once there is one) and the round
// button that submits it, in one pill. Filters can sit in the same bar, as segments (`SearchBarSegments`): each one shows an icon, a
// small label and what is picked, and is either a button that opens whatever the page puts behind it (`SearchBarSegment`, with a `Popover`) or a
// stepper for a number (`SearchBarStepper`: less, the number, more, with no panel). The bar then has two floors, whatever its width: the field
// and the button on top, a line, the segments below. They sit in a row when the room the bar has is 42rem wide or more (the width of its
// container, not of the window), in a 2 × 2 grid under that and in one column under 24rem, where a stepper's number would be cut. In a row a short line stands in the middle of the gap
// between two segments, so that what a hover paints never touches it. It only draws the bar. The page owns the text, the picks and what they find.

function SearchBar({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <div data-slot="search-bar-container" className="@container w-full">
      <form
        data-slot="search-bar"
        role="search"
        className={cn(
          "group/search-bar flex h-14 w-full items-center gap-1 rounded-full border bg-background/60 p-2 pl-6 shadow-float backdrop-blur-xl transition-[border-color,box-shadow] has-[[data-slot=search-bar-input]:focus-visible]:border-ring has-[[data-slot=search-bar-input]:focus-visible]:ring-3 has-[[data-slot=search-bar-input]:focus-visible]:ring-ring/30",
          "has-data-[slot=search-bar-segments]:h-auto has-data-[slot=search-bar-segments]:flex-wrap has-data-[slot=search-bar-segments]:gap-x-2 has-data-[slot=search-bar-segments]:gap-y-3 has-data-[slot=search-bar-segments]:rounded-4xl has-data-[slot=search-bar-segments]:p-3",
          className
        )}
        {...props}
      />
    </div>
  )
}

/** What the text is made of: the input and, once there is a text, its clear button. It takes the room the button leaves. */
function SearchBarField({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="search-bar-field"
      className={cn(
        "flex h-10 min-w-0 flex-1 items-center gap-1 group-has-data-[slot=search-bar-segments]/search-bar:h-12 group-has-data-[slot=search-bar-segments]/search-bar:pl-2",
        className
      )}
      {...props}
    />
  )
}

/**
 * The input. `text-base` at least, on every screen: a smaller text makes iOS zoom the page in on focus. The placeholder is another matter (the zoom
 * looks at the input's own size): in a bar with segments it steps down to `text-sm`, and to `text-xs` under 21rem of room, so a long one such as the
 * home's "Search games, tables & tournaments..." fits a phone, and is back to the size of the text from 32rem (`@lg`).
 */
function SearchBarInput({
  className,
  type = "search",
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="search-bar-input"
      type={type}
      className={cn(
        "h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground group-has-data-[slot=search-bar-segments]/search-bar:@lg:text-lg group-has-data-[slot=search-bar-segments]/search-bar:placeholder:text-sm group-has-data-[slot=search-bar-segments]/search-bar:@max-[21rem]:placeholder:text-xs group-has-data-[slot=search-bar-segments]/search-bar:@lg:placeholder:text-lg [&::-webkit-search-cancel-button]:appearance-none",
        className
      )}
      {...props}
    />
  )
}

type SearchBarButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "variant" | "size" | "type" | "asChild" | "children"
> & { "aria-label": string }

/** Empties the field: the page shows it only once there is a text, and puts the focus back in the field. */
function SearchBarClear({ className, ...props }: SearchBarButtonProps) {
  return (
    <Button
      data-slot="search-bar-clear"
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("text-muted-foreground", className)}
      {...props}
    >
      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
    </Button>
  )
}

/**
 * The filters of the bar: the lower floor, under the field and a line that runs from edge to edge of the bar. A row of equal columns when the bar has
 * the room for it, a 2 × 2 grid when it has not, one column when it has very little (under 24rem, a phone of 415 px or less). Name the group with an `aria-label`. Put no more than four
 * segments in it: they share the width of the bar.
 */
function SearchBarSegments({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="search-bar-segments"
      role="group"
      className={cn(
        "order-last -mx-3 grid basis-full grow grid-cols-2 gap-2 border-t border-border px-3 pt-3 @max-sm:grid-cols-1 @2xl:auto-cols-fr @2xl:grid-flow-col @2xl:grid-cols-none @2xl:gap-4",
        className
      )}
      {...props}
    />
  )
}

// What a segment is, whether it opens something or steps a number: a box with an icon and two lines. In a grid the box has a border. In a row the
// boxes have none and a line of 1px stands in the middle of the gap between two of them (the `before` of every one but the first, 0.5rem to the left
// of the box, half of the `gap-4` of the row), so that the background a hover paints keeps its distance from it.
const SEGMENT =
  "relative flex h-14 min-w-0 items-center gap-2.5 rounded-3xl border border-border px-3 text-left transition-all outline-none select-none hover:bg-input/30 @2xl:border-transparent @2xl:not-first:before:absolute @2xl:not-first:before:top-1/2 @2xl:not-first:before:-left-2 @2xl:not-first:before:h-8 @2xl:not-first:before:w-px @2xl:not-first:before:-translate-y-1/2 @2xl:not-first:before:bg-border"

type SearchBarSegmentProps = Omit<React.ComponentProps<"button">, "children" | "type"> & {
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
  /** What the segment filters by, small, above the value: "Category". */
  label: string
  /** What is picked: "Cards +1". */
  value: string
  /** Nothing is picked: the value is dimmed ("Any category"). */
  idle?: boolean
}

/**
 * One filter of the bar that opens a panel: a button that shows what it filters by and what is picked. It opens nothing itself: the page wraps it
 * in a `PopoverTrigger asChild`, which gives it `aria-expanded` and the open state this paints.
 */
function SearchBarSegment({ className, icon, label, value, idle = false, ...props }: SearchBarSegmentProps) {
  return (
    <button
      data-idle={idle ? "" : undefined}
      type="button"
      className={cn(
        SEGMENT,
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-expanded:bg-muted",
        className
      )}
      {...props}
      // After the props: a `PopoverTrigger asChild` hands its own slot name down, which would hide this one
      data-slot="search-bar-segment"
    >
      <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className={cn("truncate text-sm", idle && "text-muted-foreground")}>{value}</span>
      </span>
    </button>
  )
}

type SearchBarStepperProps = Omit<React.ComponentProps<"div">, "children" | "role"> & {
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
  /** What the stepper filters by: "Players". It is not drawn, the icon says what the number is: it is what a screen reader calls the group. */
  label: string
  /** The number as it is written: "3", "8+", "45 min". While nothing is picked it is the one a first press picks, dimmed (`idle`). */
  value: string
  /** Nothing is picked: the number is dimmed. */
  idle?: boolean
  /** What a screen reader hears for the number: "3 players". The number is a button: it picks itself, and, once picked, clears the pick. */
  valueLabel: string
  /** What a pointer shows over the number: what it picks, or what it clears. */
  valueTitle: string
  onValueClick: () => void
  /** What the two buttons do, for a screen reader: "Fewer players", "More players". */
  decreaseLabel: string
  increaseLabel: string
  onDecrease: () => void
  onIncrease: () => void
  /** False at the end of the options: the button is dimmed and does nothing. */
  canDecrease?: boolean
  canIncrease?: boolean
}

/**
 * One filter of the bar that is a number, which needs no panel: the icon that says what the number is, then a minus button, the number and a plus
 * button, in the segment itself. No label is drawn, so the row sits in the middle of the segment; the buttons are outlined so they read as buttons.
 * The number is a chip like the ones of a panel (`bg-primary` once picked), and pressing it picks it, or clears it once it is. The page owns the
 * options and what a press does, and `idle` says nothing is picked: the number then shows the one the first press picks. A group, so a screen
 * reader names it.
 */
function SearchBarStepper({
  className,
  icon,
  label,
  value,
  idle = false,
  valueLabel,
  valueTitle,
  onValueClick,
  decreaseLabel,
  increaseLabel,
  onDecrease,
  onIncrease,
  canDecrease = true,
  canIncrease = true,
  ...props
}: SearchBarStepperProps) {
  return (
    <div data-slot="search-bar-stepper" role="group" aria-label={label} className={cn(SEGMENT, className)} {...props}>
      <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 items-center gap-1">
        <Button type="button" variant="outline" size="icon-xs" aria-label={decreaseLabel} disabled={!canDecrease} onClick={onDecrease}>
          <HugeiconsIcon icon={MinusSignIcon} strokeWidth={2} />
        </Button>
        <button
          type="button"
          aria-pressed={!idle}
          aria-label={valueLabel}
          title={valueTitle}
          onClick={onValueClick}
          className="h-6 min-w-8 truncate rounded-full px-1.5 text-sm whitespace-nowrap text-muted-foreground transition-all outline-none hover:bg-input/60 focus-visible:ring-3 focus-visible:ring-ring/30 aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/80"
        >
          {value}
        </button>
        <Button type="button" variant="outline" size="icon-xs" aria-label={increaseLabel} disabled={!canIncrease} onClick={onIncrease}>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
        </Button>
      </span>
    </div>
  )
}

/** Sends the search. A visitor who presses Enter in the field sends it too. */
function SearchBarSubmit({ className, ...props }: SearchBarButtonProps) {
  return (
    <Button
      data-slot="search-bar-submit"
      type="submit"
      variant="secondary"
      size="icon-lg"
      className={className}
      {...props}
    >
      <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
    </Button>
  )
}

export {
  SearchBar,
  SearchBarField,
  SearchBarInput,
  SearchBarClear,
  SearchBarSegments,
  SearchBarSegment,
  SearchBarStepper,
  SearchBarSubmit,
}
