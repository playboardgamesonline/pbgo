"use client"

import * as React from "react"
import { Combobox, type ComboboxOption } from "./combobox"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

// The panel that picks the games of the signed-in home's play zone: a search field and the list of the games, each a row with its small cover and its name and, when it cannot be picked now (a group too large for it), the reason under its name with a warning at its end
// (`ComboboxOption.unavailable`). It is opened by whatever the page gives it as its child, which is the tile that adds a game (`AddGameTile`): the games that are picked are drawn by the page as tiles in the row of that one, each with its settings, so the panel has no field of its own. It picks
// several games at once (`max` more than 1: the panel stays open between picks, so that several can be added, and once `max` are in the games that are not are off and `fullNote` says to take one out) or one (`max` 1: a pick replaces the one before and closes the panel). The panel is a `Popover` that
// holds a `Combobox`, `rounded-2xl` as the other panels of a list are, and it is modal so that its list scrolls with the wheel inside a window too. It decides nothing: `onValueChange` is how the page keeps the games.

type GameSelectProps = {
  /** The games that can be listed, each `value` a slug: its name (`label`), its small picture (`cover`) and `unavailable` when it cannot be picked now. */
  options: readonly ComboboxOption[]
  /** The `value` of the games that are picked, in the order they were picked. */
  value: readonly string[]
  onValueChange: (next: string[]) => void
  /** How many games can be picked at most: 1 is a single choice. */
  max: number
  /** What the search field of the panel says while it is empty: "Search games...". */
  searchPlaceholder: string
  /** What the list says when no game holds the text: "No game matches.". */
  empty: string
  /** What the panel says under its list once `max` games are picked ("A search takes ten games at the most. Take one out to add another."). None: it says nothing. */
  fullNote?: string
  /** Names the panel and its list: "Games". */
  "aria-label": string
  /** What opens the panel when it is pressed: the tile that adds a game, or any element that takes the props and the ref of a button. */
  children: React.ReactElement
}

function GameSelect({ options, value, onValueChange, max, searchPlaceholder, empty, fullNote, "aria-label": label, children }: GameSelectProps) {
  const [open, setOpen] = React.useState(false)
  const panel = React.useRef<HTMLDivElement>(null)
  const full = max > 1 && value.length >= max
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        ref={panel}
        aria-label={label}
        align="center"
        className="w-80 gap-0 rounded-2xl p-0 pt-2"
        onOpenAutoFocus={(event) => {
          if (window.matchMedia("(pointer: coarse)").matches) return
          event.preventDefault()
          panel.current?.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus()
        }}
      >
        <Combobox
          options={options}
          value={value}
          onValueChange={onValueChange}
          // The pick that fills the last place leaves nothing to pick, and a single choice is made: the panel closes with it
          onPick={() => (max === 1 || value.length + 1 >= max) && setOpen(false)}
          max={max}
          aria-label={label}
          placeholder={searchPlaceholder}
          empty={empty}
        />
        {full && fullNote && <p className="px-4 pt-1 pb-3 text-xs text-muted-foreground">{fullNote}</p>}
      </PopoverContent>
    </Popover>
  )
}

export { GameSelect }
export type { GameSelectProps }
