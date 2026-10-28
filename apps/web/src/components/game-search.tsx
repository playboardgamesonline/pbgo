"use client"

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react"

import {
  filterFromParams,
  filterGames,
  filterToParams,
  type GameFilter,
  type GameIndex,
} from "@pbgo/catalog/filter"
import type { GameCardProps } from "@pbgo/ui/platform/game-card"

/** A game as the home holds it: what the search reads of it (`GameIndex`) beside the props of its card. */
export type SearchedGame = GameIndex & { props: GameCardProps }

type GameSearchValue = {
  /** Every game of the catalog, in the order of the catalog. */
  games: readonly SearchedGame[]
  filter: GameFilter
  /** The games that match `filter`, in the same order. */
  shown: SearchedGame[]
  /** Types into the search. Only the state holds the text: it is never written into the address. */
  setQuery: (query: string) => void
  /** Changes the picks, or empties them all (`NO_FILTER`). The three picks are written into the address, in place. */
  pick: (next: GameFilter) => void
}

const GameSearchContext = createContext<GameSearchValue | null>(null)

// The query string of the address, read once the page is in the browser. The home is static, so the server does not know it: the server and the
// first render of the browser both see none (`getServerSnapshot`), which keeps the hydration whole, and the list opens on the picks of the link
// right after. Nothing changes the address under the page (the picks rewrite it, but by then they are in the state), so nothing is subscribed to.
const subscribeToNothing = () => () => {}
const readSearch = () => window.location.search
const readNoSearch = () => ""

/** Writes the picks into the address of the page, in place: the list as the visitor has it is not a page to come back to with the back button. */
function writeAddress(filter: GameFilter) {
  try {
    const url = new URL(window.location.href)
    url.search = filterToParams(filter).toString()
    window.history.replaceState(null, "", url)
  } catch {
    // The address is a convenience: a browser can refuse to rewrite it (Safari past 100 calls in 30 s, a page in a sandboxed frame)
  }
}

/**
 * The search of the hub's home: one state for the text and the three picks, shared by the pill in the header (`HeroSearch`) and by the list under
 * it (`GameList`), which draws the filters, the count and the cards of the games that match, in the order of the catalog. The rules are
 * `@pbgo/catalog/filter`'s; this holds the state. It all happens in the browser on the index that the page sends with the cards, so nothing is
 * asked of the server, the home stays static, and the HTML of the page lists every game. The children are the page's own markup and stay
 * server-rendered: only the two components that read the search draw again when it changes.
 * The three picks are in the address of the page (`?show=soon&players=4&duration=30`), so that a link opens the list as it was left. The text of
 * the search is not: the address goes to analytics with every event, and what a visitor types is theirs. See docs/catalog.md.
 */
export function GameSearch({ games, children }: { games: readonly SearchedGame[]; children: ReactNode }) {
  const search = useSyncExternalStore(subscribeToNothing, readSearch, readNoSearch)
  // What the visitor has changed since the page opened, else what the address holds
  const [edited, setEdited] = useState<GameFilter | null>(null)
  const filter = edited ?? filterFromParams(new URLSearchParams(search))
  const shown = filterGames(games, filter)

  function setQuery(query: string) {
    setEdited({ ...filter, query })
  }

  function pick(next: GameFilter) {
    setEdited(next)
    writeAddress(next)
  }

  return <GameSearchContext.Provider value={{ games, filter, shown, setQuery, pick }}>{children}</GameSearchContext.Provider>
}

/** The search of the home, for the components that draw it: they sit inside `GameSearch`. */
export function useGameSearch() {
  const value = useContext(GameSearchContext)
  if (value === null) throw new Error("useGameSearch() must be used inside <GameSearch>")
  return value
}
