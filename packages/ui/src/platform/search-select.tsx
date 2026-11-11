"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { UnfoldMoreIcon } from "@hugeicons/core-free-icons"
import { cn } from "../utils"
import { Button } from "./button"
import { Combobox, type ComboboxOption } from "./combobox"
import { Popover, PopoverContent, PopoverHeader, PopoverTrigger } from "./popover"

// A choice among many options, with a search field: a select whose list is too long to scroll (the countries). It looks like a `Select` and opens a `Popover` that holds a `Combobox` as a single choice: the field has the focus as the panel opens, typing
// keeps the options that hold the text (whatever the case and the accents), a pick closes the panel and puts the focus back on the trigger. The panel is modal, so that the list scrolls with the wheel inside a window (a `Dialog`) too. With `clearLabel` a button at
// the top of the panel takes the choice away. With `onQueryChange` the options are found by the caller as the text is typed (a search on a server: the cities), `selectedLabel` says the pick whatever the options of the moment hold, and the caller is told when the panel opens (`onQueryChange("")`) so that it can forget the last search. The search field keeps the focus when the panel opens even then (the button comes first in the panel), except on a screen that is touched, where the keyboard would hide the list.

type SearchSelectProps = Omit<React.ComponentProps<"button">, "value" | "onChange" | "children" | "role" | "type"> & {
  options: readonly ComboboxOption[]
  /** The `value` of the option picked, or null when none is. */
  value: string | null
  onValueChange: (value: string | null) => void
  /** What the trigger says while none is picked: "Select a country". */
  placeholder: string
  /** What the search field says while it is empty: "Search countries...". */
  searchPlaceholder: string
  /** What the list says when no option holds the text: "No country matches.". */
  empty: string
  /** Names the field and its list: "Country / region". */
  "aria-label": string
  /** When given, a button of this name at the top of the panel takes the choice away: "Clear". */
  clearLabel?: string
  /** Called with what is typed, and with "" when the panel opens: the options are then the caller's to find (a search on a server), and the list filters none. */
  onQueryChange?: (query: string) => void
  /** With `onQueryChange`: what the list says while nothing is typed and there is nothing to show. */
  prompt?: string
  /** With `onQueryChange`: the answer to what was typed is on its way. */
  loading?: boolean
  /** What the trigger says for the pick, in place of the label of its option: the options are the last search's, and the pick may be an older one. */
  selectedLabel?: string
}

function SearchSelect({ options, value, onValueChange, placeholder, searchPlaceholder, empty, clearLabel, onQueryChange, prompt, loading, selectedLabel, className, "aria-label": label, ...props }: SearchSelectProps) {
  const [open, setOpen] = React.useState(false)
  const panel = React.useRef<HTMLDivElement>(null)
  const panelId = React.useId()
  const picked = value === null ? undefined : options.find((option) => option.value === value)
  // `selectedLabel` is how the pick is said whatever the last search holds, so that the trigger never changes with it
  const pickedLabel = value === null ? undefined : (selectedLabel ?? (picked ? (picked.label ?? picked.value) : undefined))
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) onQueryChange?.("")
      }}
      modal
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={panelId}
          aria-haspopup="listbox"
          aria-label={label}
          data-slot="search-select-trigger"
          data-placeholder={pickedLabel === undefined ? "" : undefined}
          className={cn(
            "bg-input/50 border-transparent data-placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/40 aria-invalid:border-destructive/50 flex h-9 w-full items-center justify-between gap-1.5 rounded-xl border px-3 py-2 text-sm whitespace-nowrap transition-[color,box-shadow,background-color] outline-none focus-visible:ring-3 aria-invalid:ring-3 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
            className,
          )}
          {...props}
        >
          <span className="min-w-0 flex-1 truncate text-left">{pickedLabel ?? placeholder}</span>
          <HugeiconsIcon icon={UnfoldMoreIcon} strokeWidth={2} aria-hidden="true" className="pointer-events-none size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={panel}
        id={panelId}
        aria-label={label}
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-52 gap-0 p-0 pt-2"
        onOpenAutoFocus={(event) => {
          if (window.matchMedia("(pointer: coarse)").matches) return
          event.preventDefault()
          panel.current?.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus()
        }}
      >
        {clearLabel && value !== null && (
          <PopoverHeader className="justify-end px-2 pb-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onValueChange(null)
                setOpen(false)
              }}
            >
              {clearLabel}
            </Button>
          </PopoverHeader>
        )}
        <Combobox
          options={options}
          value={value === null ? [] : [value]}
          onValueChange={([next]) => onValueChange(next ?? null)}
          onPick={() => setOpen(false)}
          max={1}
          aria-label={label}
          placeholder={searchPlaceholder}
          empty={empty}
          onQueryChange={onQueryChange}
          prompt={prompt}
          loading={loading}
        />
      </PopoverContent>
    </Popover>
  )
}

export { SearchSelect }
export type { SearchSelectProps }
