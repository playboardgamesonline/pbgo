import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, MinusSignIcon, PlusSignIcon, Search01Icon } from "@hugeicons/core-free-icons"
import { cn } from "../utils"

import { Button } from "./button"

// The big search bar of a page: one glass bar, rounded like a surface (`rounded-3xl`) and not a pill, with the magnifier at its start (a plain icon that is the button that sends the search), the text, a
// button that clears it once there is one and, at its end, what a page puts there: the category of the games, a button that opens a panel
// (`SearchBarSegment`). The other filters are not in the bar: they stand bare under it, centred on a line of their own (`SearchBarFilters`), each in
// a place of its own with no background, no outline and no shadow (`SearchBarGroup`, with its `SearchBarIcon` and, where a filter has a value to
// read, a `SearchBarValue`): a stepper for a number (`SearchBarStepper`: less, the number and its icon, more), a slider (`Slider`) or a bar that fills
// (`Meter`) in a group of your own, or a button that opens a menu (a `SearchBarSegment` that is `boxed`). It only draws the bar and the row. The
// page owns the text, the picks and what they find. The filters are always at work, so what they are set to is read from the control itself, and
// nothing is filled in to say it.

function SearchBar({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <div data-slot="search-bar-container" className="@container w-full">
      <form
        data-slot="search-bar"
        role="search"
        className={cn(
          "group/search-bar flex h-16 w-full items-center gap-2 rounded-3xl border bg-background/60 p-2 pl-3 shadow-float backdrop-blur-xl",
          className
        )}
        {...props}
      />
    </div>
  )
}

/** What the text is made of: the magnifier that sends it, the input and, once there is a text, its clear button. The input takes the room the others leave. */
function SearchBarField({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="search-bar-field" className={cn("flex h-12 min-w-0 flex-1 items-center gap-2", className)} {...props} />
}

/**
 * The input, small and dim like a placeholder: what is typed has the colour of the placeholder (`text-muted-foreground`). `text-base` on a touch
 * screen, since a smaller text makes iOS zoom the page in on focus, and `text-sm` where the pointer is fine. The placeholder is another matter (the
 * zoom looks at the input's own size): it is `text-sm`, and `text-xs` under 24rem of room, so a long one such as the home's "Search games, tables &
 * tournaments..." fits a phone. The bar draws no ring or border around itself when the field has the focus: the caret says where the text goes.
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
        "h-full min-w-0 flex-1 bg-transparent text-base text-muted-foreground outline-none placeholder:text-sm placeholder:text-muted-foreground pointer-fine:text-sm @max-sm:placeholder:text-xs [&::-webkit-search-cancel-button]:appearance-none",
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
 * Sends the search: the magnifier, a plain icon that is a button, at the start of the field. A visitor who presses Enter in the field sends it too.
 */
function SearchBarSubmit({ className, ...props }: SearchBarButtonProps) {
  return (
    <Button
      data-slot="search-bar-submit"
      type="submit"
      variant="ghost"
      size="icon-sm"
      className={cn("shrink-0 text-muted-foreground [&_svg:not([class*='size-'])]:size-5", className)}
      {...props}
    >
      <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
    </Button>
  )
}

type SearchBarSegmentProps = Omit<React.ComponentProps<"button">, "children" | "type"> & {
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
  /** What the segment filters by: "Category". It is not drawn, the icon says what it is: it is what a screen reader hears before the value. */
  label: string
  /** What is picked: "Cards +1". */
  value: string
  /** Nothing is picked: the value is dimmed ("Any category"). */
  idle?: boolean
  /** Under the bar (`SearchBarFilters`), bare like the other filters there, and not at the end of the bar. */
  boxed?: boolean
}

/**
 * A filter that opens something: an icon and what is picked, in a button. It opens nothing itself: the page wraps it in a `PopoverTrigger asChild` or
 * a `DropdownMenuTrigger asChild`, which gives it `aria-expanded` and the open state this paints. At the end of the bar it is a button without a
 * frame, 48px high and rounded one step less than the bar (`rounded-xl`: the bar's 26px less its 8px of padding); the value of a segment with nothing picked is left out under 48rem of room, so the field keeps its room on a phone and the icon
 * stands for it. `boxed`, under the bar, it is bare like the other filters there, 56px high with no frame, and it goes gray, like the one at the end of
 * the bar, under the pointer and while its menu is open.
 */
function SearchBarSegment({ className, icon, label, value, idle = false, boxed = false, ...props }: SearchBarSegmentProps) {
  return (
    <button
      data-idle={idle ? "" : undefined}
      type="button"
      aria-label={`${label}: ${value}`}
      className={cn(
        "flex shrink-0 items-center gap-2 text-left outline-none select-none hover:bg-input/30 focus-visible:ring-3 focus-visible:ring-ring/30 aria-expanded:bg-muted",
        boxed ? "h-14 rounded-2xl px-4" : "h-12 max-w-52 rounded-xl px-3",
        className
      )}
      {...props}
      // After the props: a `PopoverTrigger asChild` hands its own slot name down, which would hide this one
      data-slot="search-bar-segment"
    >
      <SearchBarIcon icon={icon} />
      <span className={cn("truncate text-sm", idle && "text-muted-foreground", !boxed && idle && "hidden @3xl:inline")}>{value}</span>
    </button>
  )
}

/**
 * The filters that stand under the bar: a row, centred, on a line of its own, that goes on another line when the room runs out. Each is in a place of
 * its own with no background of its own (a `SearchBarGroup`, a `SearchBarStepper`, or a `SearchBarSegment` that is `boxed`). Name the group with an `aria-label`.
 */
function SearchBarFilters({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="search-bar-filters" role="group" className={cn("mt-3 flex flex-wrap items-center justify-center gap-3", className)} {...props} />
}

type SearchBarStepperProps = Omit<React.ComponentProps<"div">, "children" | "role"> & {
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
  /** What the stepper filters by: "Players". It is not drawn, the icon says what the number is: it is what a screen reader calls the group. */
  label: string
  /** The number as it is written: "4", "8+". */
  value: string
  /** What a screen reader hears for the number: "4 players". It is read again each time the number changes. */
  valueLabel: string
  /** What the two buttons do, for a screen reader: "Fewer players", "More players". */
  decreaseLabel: string
  increaseLabel: string
  onDecrease: () => void
  onIncrease: () => void
  /** False at the end of the options: the button is dimmed and does nothing. */
  canDecrease?: boolean
  canIncrease?: boolean
}

type SearchBarGroupProps = Omit<React.ComponentProps<"div">, "role" | "aria-label"> & {
  /** What the filter filters by: "Duration". It is not drawn, the icon says what it is: it is what a screen reader calls the group. */
  label: string
}

/**
 * The place of a filter under the bar: 56px high, a rem of room on each side, and nothing painted, no background, no outline, no shadow. What it holds
 * is up to the filter: the icon that says what it is (`SearchBarIcon`, wherever the filter wants it), a control (buttons, a slider, bars that fill)
 * and, where there is a value to read, a `SearchBarValue`. A group, so a screen reader names it.
 */
function SearchBarGroup({ className, label, ...props }: SearchBarGroupProps) {
  return <div data-slot="search-bar-group" role="group" aria-label={label} className={cn("flex h-14 items-center gap-2 px-4", className)} {...props} />
}

type SearchBarIconProps = Omit<React.ComponentProps<typeof HugeiconsIcon>, "icon" | "strokeWidth"> & {
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
}

/** The icon that says what a filter of the row is: the same size and colour everywhere, and decorative, since the label of its group says it to a screen reader. */
function SearchBarIcon({ className, icon, ...props }: SearchBarIconProps) {
  return (
    <HugeiconsIcon data-slot="search-bar-icon" aria-hidden="true" icon={icon} strokeWidth={2} className={cn("size-5 shrink-0 text-muted-foreground", className)} {...props} />
  )
}

/**
 * What a filter of the row is set to, written plainly: a range or a number, with no unit where the icon beside it says what it is (`30–60` beside an
 * hourglass). Give it a width of its own when its text changes and the rest of the group must stay where it is.
 */
function SearchBarValue({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="search-bar-value" className={cn("text-sm whitespace-nowrap tabular-nums", className)} {...props} />
}

/**
 * A filter that is a number, which needs no panel, in a place of its own under the bar: a minus button, the number with the icon that says what it is
 * just after it, and a plus button. No label is drawn and no background is painted, under the pointer or anywhere; the buttons are outlined so they
 * read as buttons. The number is plain text and is never empty: it has a value from the start, so the filter is always at work, and the buttons move it.
 * The page owns the options and what a press does. A group, so a screen reader names it.
 */
function SearchBarStepper({
  icon,
  label,
  value,
  valueLabel,
  decreaseLabel,
  increaseLabel,
  onDecrease,
  onIncrease,
  canDecrease = true,
  canIncrease = true,
  ...props
}: SearchBarStepperProps) {
  return (
    <SearchBarGroup label={label} {...props} data-slot="search-bar-stepper">
      <span className="flex min-w-0 items-center gap-1">
        <Button type="button" variant="outline" size="icon-xs" className="rounded-lg" aria-label={decreaseLabel} disabled={!canDecrease} onClick={onDecrease}>
          <HugeiconsIcon icon={MinusSignIcon} strokeWidth={2} />
        </Button>
        <span className="flex items-center gap-1 px-1">
          {/* What is seen is not what is heard: "4" for the eye, "4 players" for a screen reader, which hears it again when the number changes */}
          <SearchBarValue aria-live="polite" className="w-6 text-center">
            <span aria-hidden="true">{value}</span>
            <span className="sr-only">{valueLabel}</span>
          </SearchBarValue>
          <SearchBarIcon icon={icon} />
        </span>
        <Button type="button" variant="outline" size="icon-xs" className="rounded-lg" aria-label={increaseLabel} disabled={!canIncrease} onClick={onIncrease}>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
        </Button>
      </span>
    </SearchBarGroup>
  )
}

export {
  SearchBar,
  SearchBarField,
  SearchBarInput,
  SearchBarClear,
  SearchBarSubmit,
  SearchBarSegment,
  SearchBarFilters,
  SearchBarGroup,
  SearchBarIcon,
  SearchBarValue,
  SearchBarStepper,
}
