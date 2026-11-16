"use client"

import * as React from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { cn } from "../utils"
import { ToggleGroup, ToggleGroupItem } from "./toggle-group"

// The switch at the top of the signed-in home's play zone: one case for each thing the zone does (Normal, Ranked, Custom), each with its icon and its name, and nothing else. It is a segmented toggle (`ToggleGroup`) a step bigger than the one of a form, and it fits
// what it holds: it is as wide as its cases, centred in its column unless the page says otherwise (`className`), never the width of the page. The thumb glides to the case that is picked. In a column too narrow for every name, the cases that are not picked are an icon alone, their names being for a screen reader and the pointer
// (`title`). A switch that is `disabled` shows the case that is picked as strong as when it is set. It decides nothing: `onValueChange` is how the page keeps the mode.

/** A case of the switch: the value the page keeps, its name and its icon. */
type ModeOption<T extends string = string> = { value: T; label: string; icon: IconSvgElement }

type ModeSwitchProps<T extends string> = Omit<React.ComponentProps<"div">, "onChange" | "children" | "role" | "defaultValue"> & {
  options: readonly ModeOption<T>[]
  value: T
  onValueChange: (value: T) => void
  /** The switch cannot be pressed (a search is on): it shows the case that is picked. */
  disabled?: boolean
  /** Names the switch for a screen reader. */
  "aria-label": string
}

function ModeSwitch<T extends string>({ options, value, onValueChange, disabled = false, className, "aria-label": label, ...props }: ModeSwitchProps<T>) {
  return (
    <div data-slot="mode-switch" className={cn("@container/mode-switch flex w-full justify-center", className)} {...props}>
      <ToggleGroup type="single" variant="segmented" value={value} disabled={disabled} onValueChange={(next) => next && onValueChange(next as T)} aria-label={label} className="w-fit max-w-full rounded-2xl p-1.5">
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            fit
            title={option.label}
            className="h-12 gap-3 rounded-xl px-5 text-base data-[state=on]:disabled:opacity-100 @max-md/mode-switch:px-3"
          >
            <HugeiconsIcon icon={option.icon} strokeWidth={2} aria-hidden="true" className="size-5" />
            <span className="@max-xl/mode-switch:group-data-[state=off]/toggle-item:sr-only">{option.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

export { ModeSwitch }
export type { ModeOption, ModeSwitchProps }
