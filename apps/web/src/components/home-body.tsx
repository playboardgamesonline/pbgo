"use client"

import type { ReactNode } from "react"

import { isFiltered } from "@pbgo/catalog/filter"
import { Section } from "@pbgo/ui/platform/section"
import { GameList } from "@/components/game-list"
import { useGameSearch } from "@/components/game-search"

/**
 * What the home shows under its search bar. Before a search is started, the sections of the platform (`children`: the popular games, the
 * tables, the tournaments, what's new), which stay server-rendered. Once the visitor types or picks a filter (`isFiltered`), the list of the
 * games that match (`GameList`) takes their place. The bar's button scrolls to `#results`, whichever of the two is there.
 */
export function HomeBody({ children }: { children: ReactNode }) {
  const { filter } = useGameSearch()

  return (
    <div id="results" className="scroll-mt-navbar">
      {isFiltered(filter) ? (
        <Section aria-label="Games" className="pt-10">
          <GameList />
        </Section>
      ) : (
        children
      )}
    </div>
  )
}
