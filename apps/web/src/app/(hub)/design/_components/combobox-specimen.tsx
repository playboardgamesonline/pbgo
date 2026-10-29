"use client"

import { useState } from "react"

import { Button } from "@pbgo/ui/platform/button"
import { Combobox } from "@pbgo/ui/platform/combobox"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@pbgo/ui/platform/popover"
import { SAMPLE_CATEGORIES } from "./sample-categories"

/** A `Combobox` in the `Popover` it is made for, with a Clear button in the header: it keeps its picks as long as the page is open. */
export function ComboboxSpecimen() {
  const [picked, setPicked] = useState<string[]>(["Cards"])
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Categories{picked.length > 0 ? ` (${picked.length})` : ""}</Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Categories" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Categories</PopoverTitle>
          <Button type="button" variant="ghost" size="sm" disabled={picked.length === 0} onClick={() => setPicked([])}>
            Clear
          </Button>
        </PopoverHeader>
        <Combobox
          options={SAMPLE_CATEGORIES}
          value={picked}
          onValueChange={setPicked}
          aria-label="Categories"
          placeholder="Search categories..."
          empty="No category matches."
        />
      </PopoverContent>
    </Popover>
  )
}
