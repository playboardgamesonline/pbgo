"use client"

import { useRef, useState, type ReactNode } from "react"

import { MAX_QUERY_LENGTH } from "@pbgo/catalog/filter"
import { SearchBar, SearchBarClear, SearchBarField, SearchBarInput, SearchBarSubmit } from "@pbgo/ui/platform/search-bar"

/**
 * The search bar of a page of the navbar that lists something: one glass bar with the magnifier, the field and, once there is a text, the button that clears it, then what the page puts at its end
 * (`inBar`: the category of the games) and, under it, centred on a line of their own, the filters of what it lists (`below`). It is the same bar for the games, the tables and the tournaments, which
 * differ by what they search (`label`, and `placeholder`, which says it) and by their filters, which each page gives for itself. The page owns the text (`query`) and what it finds. The magnifier, or
 * Enter in the field, takes the visitor down to the results (`#results`); on a phone it also puts the keyboard away, which hid them.
 */
export function PageSearch({
  label,
  placeholder,
  query,
  onQueryChange,
  inBar,
  below,
}: {
  /** What a screen reader hears of the bar and of the field: "Search games". */
  label: string
  /** What the field says while it is empty: "Search games...". */
  placeholder: string
  query: string
  onQueryChange: (query: string) => void
  /** What is at the end of the bar, after the field. */
  inBar?: ReactNode
  /** The filters of the page, under the bar. */
  below?: ReactNode
}) {
  const field = useRef<HTMLInputElement>(null)

  return (
    <>
      <SearchBar
        aria-label={label}
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
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            aria-label={label}
            placeholder={placeholder}
            maxLength={MAX_QUERY_LENGTH}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          {query !== "" && (
            <SearchBarClear
              aria-label="Clear the search"
              onClick={() => {
                onQueryChange("")
                field.current?.focus()
              }}
            />
          )}
        </SearchBarField>
        {inBar}
      </SearchBar>
      {below}
    </>
  )
}

/**
 * The search of a page whose list is not there yet (the tables, the tournaments): the bar of its tab with the text the visitor types, which it keeps, and no filters until the list has some. The page that
 * lists them takes the text, and gives its filters, in its place.
 */
export function ListSearch({ label, placeholder }: { label: string; placeholder: string }) {
  const [query, setQuery] = useState("")
  return <PageSearch label={label} placeholder={placeholder} query={query} onQueryChange={setQuery} />
}
