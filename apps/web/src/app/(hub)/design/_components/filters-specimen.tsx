"use client"

import { useState } from "react"

import { NO_FILTER, type GameFilter } from "@pbgo/catalog/filter"
import { SearchBar, SearchBarClear, SearchBarField, SearchBarInput, SearchBarSubmit } from "@pbgo/ui/platform/search-bar"
import { CategoryFilter, MoreFilters } from "@/components/search-filters"
import { SAMPLE_CATEGORIES } from "./sample-categories"

/**
 * The search bar with its filters as the home draws them (`CategoryFilter` at the end of the bar, `MoreFilters` under it: the same components), on
 * picks of its own: the steppers step, the category list and the age menu open, and nothing is filtered. With `picked` it starts with a text and a
 * pick of each kind.
 */
export function FiltersSpecimen({ picked = false }: { picked?: boolean }) {
  const [filter, setFilter] = useState<GameFilter>(
    picked ? { ...NO_FILTER, categories: ["Cards", "Party"], players: 4, duration: 30, age: 8 } : NO_FILTER,
  )
  return (
    <div>
      <SearchBar method="dialog" aria-label="Search the games">
        <SearchBarField>
          <SearchBarSubmit aria-label="Search" />
          <SearchBarInput aria-label="Search a game" placeholder="Search a game" defaultValue={picked ? "Flip" : undefined} />
          {picked && <SearchBarClear aria-label="Clear the search" />}
        </SearchBarField>
        <CategoryFilter categories={SAMPLE_CATEGORIES} picked={filter.categories} onPick={(categories) => setFilter({ ...filter, categories })} />
      </SearchBar>
      <MoreFilters filter={filter} onFilterChange={setFilter} />
    </div>
  )
}
