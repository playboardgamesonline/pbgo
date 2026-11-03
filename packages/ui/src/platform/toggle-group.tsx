"use client"

import * as React from "react"
import { cn } from "../utils"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

/**
 * A set of chips to pick from. `type="single"` keeps one picked (a second click on it unpicks it: the value then reports an empty
 * string) and `type="multiple"` any number. The arrow keys move between the chips, one tab stop for the whole group. `variant="segmented"`
 * puts them in one container the width of its parent, on the `muted` fill like the track of a tab list, each chip the same width
 * (`flex-1`; give one `flex-none` and a width to make it narrower, an icon alone).
 */
function ToggleGroup({
  className,
  variant = "chips",
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & { variant?: "chips" | "segmented" }) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      className={cn("group/toggle-group flex flex-wrap gap-1.5", variant === "segmented" && "w-full flex-nowrap gap-1 rounded-xl bg-muted p-1", className)}
      {...props}
    />
  )
}

/** `fit` is for a chip of a segmented group that keeps the width of what it holds (an icon alone, with a width of its own) instead of sharing the width of the group with the others. */
function ToggleGroupItem({
  className,
  fit = false,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & { fit?: boolean }) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-sm whitespace-nowrap text-foreground transition-all outline-none select-none hover:bg-input/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:border-transparent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/80 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 group-data-[variant=segmented]/toggle-group:border-transparent",
        !fit && "group-data-[variant=segmented]/toggle-group:flex-1",
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
