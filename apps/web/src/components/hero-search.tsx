"use client"

import { useRef } from "react"

import { MAX_QUERY_LENGTH } from "@pbgo/catalog/filter"
import { SearchBar, SearchBarClear, SearchBarField, SearchBarInput, SearchBarSubmit } from "@pbgo/ui/platform/search-bar"
import { useGameSearch } from "@/components/game-search"
import { SearchCategory, SearchMoreFilters } from "@/components/search-filters"

/**
 * The search bar of a page that lists games: one glass bar with the magnifier, the field and, at its end, the category (`SearchCategory`), and under it,
 * centred on a line of their own and each in a container of its own, the other filters (`SearchMoreFilters`). It types and picks into the search of
 * the page (`GameSearch`), and what is under it follows what is typed and picked, so there is nothing to submit. The magnifier, or Enter in the
 * field, takes the visitor down to the results; on a phone it also puts the keyboard away, which hid them.
 */
export function HeroSearch() {
  const { filter, setQuery } = useGameSearch()
  const field = useRef<HTMLInputElement>(null)

  return (
    <>
      <SearchBar
        aria-label="Search games, tables and tournaments"
        onSubmit={(event) => {
          event.preventDefault()
          if (window.matchMedia("(pointer: coarse)").matches) field.current?.blur()
          const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
          document.getElementById("results")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
        }}
      >
        <SearchBarField>
          <SearchBarSubmit aria-label="Search" />
          <SearchBarInput
            ref={field}
            value={filter.query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search games, tables and tournaments"
            placeholder="Search games, tables & tournaments..."
            maxLength={MAX_QUERY_LENGTH}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          {filter.query !== "" && (
            <SearchBarClear
              aria-label="Clear the search"
              onClick={() => {
                setQuery("")
                field.current?.focus()
              }}
            />
          )}
        </SearchBarField>
        <SearchCategory />
      </SearchBar>
      <SearchMoreFilters />
    </>
  )
}
