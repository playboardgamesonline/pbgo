"use client"

import type { ReactNode } from "react"
import Link from "next/link"

import { isFiltered } from "@pbgo/catalog/filter"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { Section } from "@pbgo/ui/platform/section"
import { GameList } from "@/components/game-list"
import { useGameSearch } from "@/components/game-search"
import { COMING_SOON } from "@/lib/coming-soon"

/**
 * What the home shows under its search bar. Before a search is started, the sections of the platform (`children`: popular games, tables and
 * tournaments in progress, how it works, what's new), which stay server-rendered. Once the visitor types or picks a filter, the list of
 * the games that match (`GameList`) takes their place; and when the bar looks through tables or tournaments, which have no list yet, a line
 * that says what is to come and the way to their page. The bar's button scrolls to `#results`, whichever of the three is there.
 */
export function HomeBody({ children }: { children: ReactNode }) {
  const { scope, filter } = useGameSearch()

  let body: ReactNode
  if (scope === "tables" || scope === "tournaments") {
    const { heading, description } = COMING_SOON[scope]
    body = (
      <Section aria-label={scope === "tables" ? "Tables" : "Tournaments"} className="pt-10">
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{heading}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline">
              <Link href={`/${scope}`}>{scope === "tables" ? "See all tables" : "See all tournaments"}</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </Section>
    )
  } else if (isFiltered(filter)) {
    body = (
      <Section aria-label="Games" className="pt-10">
        <GameList />
      </Section>
    )
  } else {
    body = children
  }

  return (
    <div id="results" className="scroll-mt-navbar">
      {body}
    </div>
  )
}
