"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { cn } from "../utils"
import { Button } from "./button"
import { Combobox, type ComboboxOption } from "./combobox"
import { CoverTile } from "./cover-tile"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

// A limited multiple choice: what is picked stands in a row of chips (each with its small cover and a button that puts it back), a counter says how many are picked of how many can be ("2 of 5"), and a button opens a panel with a search field to pick
// more (a `Combobox` with `max`). When `max` are picked the panel closes and the button is off: there is no sixth. The chips keep the order in which the options were picked. The panel is modal, so that its list scrolls with the
// wheel inside a window (a `Dialog`) too.

type MultiSelectProps = Omit<React.ComponentProps<"div">, "onChange" | "role" | "children"> & {
  options: readonly ComboboxOption[]
  /** The `value` of the options that are picked, in the order they were picked. */
  value: readonly string[]
  onValueChange: (next: string[]) => void
  /** How many options can be picked at most. */
  max: number
  /** What the button that opens the panel says: "Add a game". */
  placeholder: string
  /** What the search field says while it is empty: "Search games...". */
  searchPlaceholder: string
  /** What the list says when no option holds the text: "No game matches.". */
  empty: string
  /** Names the field, its chips and its list: "Favourite games". */
  "aria-label": string
  /** What the counter says, from how many are picked and how many can be: "2 of 5". */
  counter?: (count: number, max: number) => string
  disabled?: boolean
}

const OF = (count: number, max: number) => `${count} of ${max}`

function MultiSelect({ options, value, onValueChange, max, placeholder, searchPlaceholder, empty, counter = OF, disabled = false, className, "aria-label": label, ...props }: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const byValue = new Map(options.map((option) => [option.value, option]))
  const full = value.length >= max
  return (
    <div data-slot="multi-select" className={cn("flex flex-wrap items-center gap-2 rounded-xl bg-input/50 p-2", className)} {...props}>
      <ul aria-label={label} className="contents">
        {value.map((slug) => {
          const option = byValue.get(slug)
          const name = option?.label ?? slug
          return (
            <li key={slug} className="flex h-8 max-w-full items-center gap-2 rounded-lg bg-secondary pr-1 pl-1 text-sm">
              {option?.cover !== undefined && option.cover !== null && <CoverTile className="size-6" {...option.cover} />}
              <span className="min-w-0 truncate">{name}</span>
              <button
                type="button"
                aria-label={`Remove ${name}`}
                disabled={disabled}
                onClick={() => onValueChange(value.filter((picked) => picked !== slug))}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
              </button>
            </li>
          )
        })}
      </ul>
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled || full}>
            {placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent aria-label={label} align="start" className="w-64 gap-0 p-0 pt-2">
          <Combobox
            options={options}
            value={value}
            onValueChange={onValueChange}
            // The pick that fills the last place leaves nothing to pick: the panel closes with it
            onPick={() => value.length + 1 >= max && setOpen(false)}
            max={max}
            aria-label={label}
            placeholder={searchPlaceholder}
            empty={empty}
          />
        </PopoverContent>
      </Popover>
      <span aria-live="polite" className="ml-auto pr-1 text-xs tabular-nums text-muted-foreground">
        {counter(value.length, max)}
      </span>
    </div>
  )
}

export { MultiSelect }
export type { MultiSelectProps }
