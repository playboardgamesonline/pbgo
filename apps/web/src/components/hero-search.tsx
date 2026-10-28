"use client"

import { useRef } from "react"

import { MAX_QUERY_LENGTH } from "@pbgo/catalog/filter"
import { SearchBar, SearchBarClear, SearchBarField, SearchBarInput, SearchBarSubmit } from "@pbgo/ui/platform/search-bar"
import { SEARCH_SCOPES, useGameSearch } from "@/components/game-search"
import { SearchFilters } from "@/components/search-filters"

/**
 * The search bar of a page that lists games, on two floors: the field and the round button above the segments (`SearchFilters`). It types
 * and picks into the search of the page (`GameSearch`), and what is under it follows what is typed and picked, so there is nothing to submit.
 * The button, or Enter in the field, takes the visitor down to the results; on a phone it also puts the keyboard away, which hid them.
 * With `scopes` (the home's bar) its first segment lets the visitor search the games, the tables or the tournaments, and the words follow.
 */
export function HeroSearch({ scopes = false }: { scopes?: boolean }) {
  const { filter, scope, setQuery } = useGameSearch()
  const field = useRef<HTMLInputElement>(null)
  const noun = SEARCH_SCOPES.find((candidate) => candidate.id === scope)?.noun ?? "game"

  return (
    <SearchBar
      aria-label={`Search the ${scope}`}
      onSubmit={(event) => {
        event.preventDefault()
        if (window.matchMedia("(pointer: coarse)").matches) field.current?.blur()
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        document.getElementById("results")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
      }}
    >
      <SearchBarField>
        <SearchBarInput
          ref={field}
          value={filter.query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={`Search a ${noun}`}
          placeholder={`Search a ${noun}`}
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
      <SearchFilters scopes={scopes} />
      <SearchBarSubmit aria-label="Search" />
    </SearchBar>
  )
}
