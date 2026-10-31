"use client"

import { useGameSearch } from "@/components/game-search"
import { PageSearch } from "@/components/page-search"
import { SearchCategory, SearchMoreFilters } from "@/components/search-filters"

/**
 * The search bar of a page that lists games (the home and `/games`): the bar of `PageSearch` with, at its end, the category (`SearchCategory`), and under it, centred on a line of their own and each in a
 * container of its own, the other filters (`SearchMoreFilters`). It types and picks into the search of the page (`GameSearch`), and what is under it follows what is typed and picked, so there is
 * nothing to submit. The home searches the whole platform, so it says so (the default `label` and `placeholder`); `/games` searches games only and says that.
 */
export function HeroSearch({
  label = "Search games, tables and tournaments",
  placeholder = "Search games, tables & tournaments...",
}: {
  label?: string
  placeholder?: string
}) {
  const { filter, setQuery } = useGameSearch()

  return <PageSearch label={label} placeholder={placeholder} query={filter.query} onQueryChange={setQuery} inBar={<SearchCategory />} below={<SearchMoreFilters />} />
}
