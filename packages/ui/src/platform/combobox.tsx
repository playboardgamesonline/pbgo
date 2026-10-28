"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { cn } from "../utils"
import { matchOptions } from "../match-options"
import { Input } from "./input"

// A list of options with a search field above it, for a panel (a `Popover`) whose options are more than chips can hold, and may be more tomorrow:
// the categories of the games. Typing keeps the options that hold the text, whatever the case and the accents (`matchOptions`). The arrow keys move
// along the list without leaving the field, Enter picks or unpicks the option they are on, and so does a click: the list stays open, since any number
// of options can be picked. The field takes the focus when the panel opens, except on a screen that is touched, where the keyboard would hide the
// list. It names itself (`aria-label`) and draws nothing around itself: the panel does.

type ComboboxProps = Omit<React.ComponentProps<"div">, "children" | "onChange" | "role"> & {
  /** Every option, by the name that is shown and compared. */
  options: readonly string[]
  /** The ones that are picked, in the order they were picked. */
  value: readonly string[]
  onValueChange: (next: string[]) => void
  /** What the field says while it is empty: "Search categories...". */
  placeholder: string
  /** What the list says when no option holds the text: "No category matches.". */
  empty: string
  /** Names the field and the list: "Categories". */
  "aria-label": string
}

function Combobox({ options, value, onValueChange, placeholder, empty, className, "aria-label": label, ...props }: ComboboxProps) {
  const id = React.useId()
  const field = React.useRef<HTMLInputElement>(null)
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const shown = matchOptions(options, query)
  // The option the arrow keys are on: the list can get shorter under it as the text grows
  const current = shown.length === 0 ? -1 : Math.min(active, shown.length - 1)

  React.useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) field.current?.focus()
  }, [])

  // The option the arrow keys are on stays in view
  React.useEffect(() => {
    if (current >= 0) document.getElementById(`${id}-option-${current}`)?.scrollIntoView({ block: "nearest" })
  }, [id, current])

  function toggle(option: string) {
    onValueChange(value.includes(option) ? value.filter((picked) => picked !== option) : [...value, option])
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (shown.length === 0) return
    if (event.key === "ArrowDown") setActive((current + 1) % shown.length)
    else if (event.key === "ArrowUp") setActive((current - 1 + shown.length) % shown.length)
    else if (event.key === "Home") setActive(0)
    else if (event.key === "End") setActive(shown.length - 1)
    else if (event.key === "Enter") {
      const option = shown[current]
      if (option !== undefined) toggle(option)
    } else return
    event.preventDefault()
  }

  return (
    <div data-slot="combobox" className={cn("flex min-h-0 flex-col gap-2", className)} {...props}>
      <div className="relative">
        <HugeiconsIcon
          icon={Search01Icon}
          strokeWidth={2}
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={field}
          role="combobox"
          aria-label={label}
          aria-expanded={true}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={current >= 0 ? `${id}-option-${current}` : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="pl-9"
        />
      </div>
      {shown.length > 0 ? (
        <ul id={`${id}-list`} role="listbox" aria-label={label} aria-multiselectable="true" className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
          {shown.map((option, index) => {
            const picked = value.includes(option)
            return (
              <li
                key={option}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={picked}
                data-active={index === current ? "" : undefined}
                // The pointer keeps the focus in the field: a click on an option is not a click away from it
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggle(option)}
                onPointerMove={() => setActive(index)}
                className="flex h-9 shrink-0 cursor-default items-center gap-2 rounded-2xl px-3 text-sm select-none data-active:bg-input/50"
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {picked && <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4" />}
                </span>
                <span className="truncate">{option}</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p role="status" className="py-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </div>
  )
}

export { Combobox }
