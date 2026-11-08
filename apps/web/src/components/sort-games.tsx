"use client"

import { SORTS, optionOf, type GameSort } from "@pbgo/catalog/filter"
import { Label } from "@pbgo/ui/platform/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { useGameSearch } from "@/components/game-search"

// The platform speaks English (a game's own pages are localized by the game)

/** What each order is called, in the menu and to a screen reader. */
const SORT_NAMES: Record<GameSort, string> = { trending: "Trending", name: "A–Z", newest: "Newest" }

/**
 * The order of the list of games (`/games`): "Sort by" and a menu of the orders `SORTS` offers, Trending first, which is where the list starts. A pick
 * orders the list at once and goes into the address (`?sort=`, left out for Trending), and the filters stay as they are. The rules are
 * `@pbgo/catalog/filter`'s (`sortGames`) and the state is the search's (`GameSearch`). See docs/catalog.md.
 */
export function SortGames() {
  const { sort, setSort } = useGameSearch()

  return (
    <div className="flex items-center justify-end gap-2">
      <Label htmlFor="sort-games" className="text-muted-foreground">
        Sort by
      </Label>
      <Select
        value={sort}
        onValueChange={(next) => {
          const picked = optionOf(SORTS, next)
          if (picked !== null) setSort(picked)
        }}
      >
        <SelectTrigger id="sort-games" size="sm" className="w-32">
          {/* The name is given, not found: the list is only drawn once opened, and the server has to draw the control with its value in it */}
          <SelectValue>{SORT_NAMES[sort]}</SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          {SORTS.map((value) => (
            <SelectItem key={value} value={value}>
              {SORT_NAMES[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
