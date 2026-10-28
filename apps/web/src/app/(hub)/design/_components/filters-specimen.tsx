"use client"

import { useState } from "react"

import { NO_FILTER, type GameFilter } from "@pbgo/catalog/filter"
import { SearchBar, SearchBarClear, SearchBarField, SearchBarInput, SearchBarSubmit } from "@pbgo/ui/platform/search-bar"
import { FilterSegments } from "@/components/search-filters"
import { SAMPLE_CATEGORIES } from "./sample-categories"

/**
 * The search bar with its filters as the home draws them (`FilterSegments`, the same component), on picks of its own: the steppers step, the
 * category list opens and searches, and nothing is filtered. With `picked` it starts with a text and a pick of each kind.
 */
export function FiltersSpecimen({ picked = false }: { picked?: boolean }) {
  const [filter, setFilter] = useState<GameFilter>(
    picked ? { ...NO_FILTER, categories: ["Cards", "Party"], players: 4, duration: 30, age: 8 } : NO_FILTER,
  )
  return (
    <SearchBar method="dialog" aria-label="Search the games">
      <SearchBarField>
        <SearchBarInput aria-label="Search a game" placeholder="Search a game" defaultValue={picked ? "Flip" : undefined} />
        {picked && <SearchBarClear aria-label="Clear the search" />}
      </SearchBarField>
      <FilterSegments categories={SAMPLE_CATEGORIES} filter={filter} onFilterChange={setFilter} />
      <SearchBarSubmit aria-label="Search" />
    </SearchBar>
  )
}
