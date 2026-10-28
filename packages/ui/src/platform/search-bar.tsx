import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { cn } from "../utils"

import { Button } from "./button"

// The big search pill of a page: a field (`SearchBarField`: the text and a button that clears it once there is one) and the round
// button that submits it. Filters can sit in the same bar, as segments (`SearchBarSegments`): each one shows an icon, a small label
// and what is picked, and opens whatever the page puts behind it (a `Popover`). With segments the bar is one row when the room it
// has is wide enough (`@4xl`, 56rem: the width of its container, not of the window) and a card under it, the field and the button
// on top, the segments below. It only draws the bar. The page owns the text, the picks and what they find.

function SearchBar({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <div data-slot="search-bar-container" className="@container w-full">
      <form
        data-slot="search-bar"
        role="search"
        className={cn(
          "flex h-14 w-full items-center gap-1 rounded-full border bg-secondary p-2 pl-6 shadow-float transition-[border-color,box-shadow] has-[[data-slot=search-bar-input]:focus-visible]:border-ring has-[[data-slot=search-bar-input]:focus-visible]:ring-3 has-[[data-slot=search-bar-input]:focus-visible]:ring-ring/30",
          "has-data-[slot=search-bar-segments]:h-auto has-data-[slot=search-bar-segments]:flex-wrap has-data-[slot=search-bar-segments]:gap-2 has-data-[slot=search-bar-segments]:rounded-3xl has-data-[slot=search-bar-segments]:p-3 has-data-[slot=search-bar-segments]:pl-5",
          "@4xl:has-data-[slot=search-bar-segments]:h-14 @4xl:has-data-[slot=search-bar-segments]:flex-nowrap @4xl:has-data-[slot=search-bar-segments]:gap-1 @4xl:has-data-[slot=search-bar-segments]:rounded-full @4xl:has-data-[slot=search-bar-segments]:p-2 @4xl:has-data-[slot=search-bar-segments]:pl-6",
          className
        )}
        {...props}
      />
    </div>
  )
}

/** What the text is made of: the input and, once there is a text, its clear button. It takes the room the segments leave. */
function SearchBarField({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="search-bar-field"
      className={cn("flex h-10 min-w-0 flex-1 items-center gap-1", className)}
      {...props}
    />
  )
}

/** The input. `text-base` on every screen: a smaller text makes iOS zoom the page in on focus. */
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
        "h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none",
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
 * The filters of the bar: in a row when the bar is one, in a grid below the field when it is a card. Name the group with an
 * `aria-label`. Put no more than four segments in it: they share the width of the bar.
 */
function SearchBarSegments({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="search-bar-segments"
      role="group"
      className={cn(
        "order-last grid basis-full grid-cols-2 gap-2 @lg:auto-cols-fr @lg:grid-flow-col @lg:grid-cols-none @4xl:order-none @4xl:flex @4xl:basis-auto @4xl:items-center @4xl:gap-0",
        className
      )}
      {...props}
    />
  )
}

type SearchBarSegmentProps = Omit<React.ComponentProps<"button">, "children" | "type"> & {
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
  /** What the segment filters by, small, above the value: "Players". */
  label: string
  /** What is picked: "4 players". */
  value: string
  /** Nothing is picked: the value is dimmed ("Any players"). */
  idle?: boolean
}

/**
 * One filter of the bar: a button that shows what it filters by and what is picked. It opens nothing itself: the page wraps it in a
 * `PopoverTrigger asChild`, which gives it `aria-expanded` and the open state this paints.
 */
function SearchBarSegment({ className, icon, label, value, idle = false, ...props }: SearchBarSegmentProps) {
  return (
    <button
      data-idle={idle ? "" : undefined}
      type="button"
      className={cn(
        "flex h-12 min-w-0 items-center gap-2.5 rounded-2xl border border-border px-3 text-left transition-all outline-none select-none hover:bg-input/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-expanded:bg-muted @4xl:h-10 @4xl:max-w-48 @4xl:rounded-full @4xl:border-transparent @4xl:px-4",
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

/** Sends the search. A visitor who presses Enter in the field sends it too. */
function SearchBarSubmit({ className, ...props }: SearchBarButtonProps) {
  return (
    <Button
      data-slot="search-bar-submit"
      type="submit"
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
  SearchBarSubmit,
}
