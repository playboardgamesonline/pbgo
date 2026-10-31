"use client"

import { useState } from "react"

import { Button } from "@pbgo/ui/platform/button"
import { Combobox } from "@pbgo/ui/platform/combobox"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@pbgo/ui/platform/popover"
import { categoryIcon } from "@/lib/category-icons"
import { SAMPLE_CATEGORIES } from "./sample-categories"

const OPTIONS = SAMPLE_CATEGORIES.map((name) => ({ value: name, icon: categoryIcon(name) }))

/** A `Combobox` in the `Popover` it is made for, with a Clear button in the header: it keeps its picks as long as the page is open. */
export function ComboboxSpecimen() {
  const [picked, setPicked] = useState<string[]>(["Cooperation", "Deduction"])
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Categories{picked.length > 0 ? ` (${picked.length})` : ""}</Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Categories" className="w-52 gap-0 p-0">
        <PopoverHeader className="pt-2 pr-2 pb-1 pl-4">
          <PopoverTitle>Categories</PopoverTitle>
          <Button type="button" variant="ghost" size="sm" disabled={picked.length === 0} onClick={() => setPicked([])}>
            Clear
          </Button>
        </PopoverHeader>
        <Combobox
          options={OPTIONS}
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
