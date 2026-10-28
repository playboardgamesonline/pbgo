import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { cn } from "../utils"

import { Button } from "./button"

// The big search pill of a page: one field, a button that clears it once there is a text, and the round button that submits it.
// It only draws the pill. The page owns the text and what it finds, and the filters stay with the list they cut.

function SearchBar({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <form
      data-slot="search-bar"
      role="search"
      className={cn(
        "flex h-14 w-full items-center gap-1 rounded-full border bg-secondary p-2 pl-6 shadow-float transition-[border-color,box-shadow] has-[[data-slot=search-bar-input]:focus-visible]:border-ring has-[[data-slot=search-bar-input]:focus-visible]:ring-3 has-[[data-slot=search-bar-input]:focus-visible]:ring-ring/30",
        className
      )}
      {...props}
    />
  )
}

/** The field. `text-base` on every screen: a smaller text makes iOS zoom the page in on focus. */
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

export { SearchBar, SearchBarInput, SearchBarClear, SearchBarSubmit }
