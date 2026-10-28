"use client"

import { useRef } from "react"

import { MAX_QUERY_LENGTH } from "@pbgo/catalog/filter"
import { SearchBar, SearchBarClear, SearchBarInput, SearchBarSubmit } from "@pbgo/ui/platform/search-bar"
import { useGameSearch } from "@/components/game-search"

/**
 * The big search pill of the home, under its title: it types into the search of the list (`GameSearch`), and the list
 * under it follows what is typed, so there is nothing to submit. The button, or Enter, takes the visitor down to the list; on a phone it also
 * puts the keyboard away, which hid the list.
 */
export function HeroSearch() {
  const { filter, setQuery } = useGameSearch()
  const field = useRef<HTMLInputElement>(null)

  return (
    <SearchBar
      aria-label="Search the games"
      onSubmit={(event) => {
        event.preventDefault()
        if (window.matchMedia("(pointer: coarse)").matches) field.current?.blur()
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        document.getElementById("games")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
      }}
    >
      <SearchBarInput
        ref={field}
        value={filter.query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search a game"
        placeholder="Search a game"
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
      <SearchBarSubmit aria-label="Search" />
    </SearchBar>
  )
}
