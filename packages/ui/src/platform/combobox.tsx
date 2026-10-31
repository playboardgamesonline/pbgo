"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { cn } from "../utils"
import { matchOptions } from "../match-options"
import { Input } from "./input"

// A list of options with a search field above it, for a panel (a `Popover` with no padding of its own, which draws its title above) whose options are more
// than chips can hold, and may be more tomorrow: the categories of the games. An option is a name and, if it wants one, an icon that stands before it; the
// check of a pick is at the other end of the row. The rows are rounded like the rows of a menu and 4px from each edge of the panel (`px-1`), and the field has a
// margin of its own and no ring: it has the focus when the panel opens and the caret says where the text goes. Typing keeps
// the options that hold the text, whatever the case and the accents (`matchOptions`). The arrow keys move along the list without leaving the field, Enter
// picks or unpicks the option they are on, and so does a click: the list stays open, since any number of options can be picked. The field takes the focus
// the moment the panel opens (`autoFocus`: React focuses it as it mounts, before anything is painted), except on a screen that is touched, where the keyboard
// would hide the list. The list has no scrollbar and scrolls all the same (wheel, touch, arrow keys): a row cut by its bottom edge says there is more. It
// names itself (`aria-label`) and draws nothing around itself: the panel does.

type ComboboxOption = {
  /** The name that is shown and compared. */
  value: string
  /** The icon that stands before the name, if the option has one. */
  icon?: React.ComponentProps<typeof HugeiconsIcon>["icon"]
}

type ComboboxProps = Omit<React.ComponentProps<"div">, "children" | "onChange" | "role"> & {
  /** Every option: its name, and its icon if it has one. */
  options: readonly ComboboxOption[]
  /** The names of the ones that are picked, in the order they were picked. */
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
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  // A screen that is touched does not focus the field: its keyboard would hide the list. Read once, as the panel opens
  const [touched] = React.useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches)
  const shown = React.useMemo(() => {
    const byName = new Map(options.map((option) => [option.value, option]))
    return matchOptions([...byName.keys()], query).flatMap((name) => byName.get(name) ?? [])
  }, [options, query])
  // The option the arrow keys are on: the list can get shorter under it as the text grows
  const current = shown.length === 0 ? -1 : Math.min(active, shown.length - 1)

  // The option the arrow keys are on stays in view
  React.useEffect(() => {
    if (current >= 0) document.getElementById(`${id}-option-${current}`)?.scrollIntoView({ block: "nearest" })
  }, [id, current])

  function toggle(name: string) {
    onValueChange(value.includes(name) ? value.filter((picked) => picked !== name) : [...value, name])
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (shown.length === 0) return
    if (event.key === "ArrowDown") setActive((current + 1) % shown.length)
    else if (event.key === "ArrowUp") setActive((current - 1 + shown.length) % shown.length)
    else if (event.key === "Home") setActive(0)
    else if (event.key === "End") setActive(shown.length - 1)
    else if (event.key === "Enter") {
      const option = shown[current]
      if (option !== undefined) toggle(option.value)
    } else return
    event.preventDefault()
  }

  return (
    <div data-slot="combobox" className={cn("flex min-h-0 flex-col", className)} {...props}>
      <div className="px-2 pb-2">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            autoFocus={!touched}
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
            className="pl-9 focus-visible:border-transparent focus-visible:ring-0"
          />
        </div>
      </div>
      {shown.length > 0 ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
          className="flex max-h-60 flex-col overflow-y-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {shown.map((option, index) => {
            const picked = value.includes(option.value)
            return (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={picked}
                data-active={index === current ? "" : undefined}
                // The pointer keeps the focus in the field: a click on an option is not a click away from it
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggle(option.value)}
                onPointerMove={() => setActive(index)}
                className="flex h-9 shrink-0 cursor-default items-center gap-3 rounded-2xl px-3 text-sm select-none data-active:bg-input/50"
              >
                {option.icon && <HugeiconsIcon icon={option.icon} strokeWidth={2} aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate">{option.value}</span>
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {picked && <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4" />}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p role="status" className="px-4 py-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </div>
  )
}

export { Combobox }
export type { ComboboxOption }
