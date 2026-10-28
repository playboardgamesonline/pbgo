import type { Metadata } from "next"

import { indexEntry } from "@pbgo/catalog/filter"
import { getCatalog } from "@pbgo/catalog/server"
import { GameList } from "@/components/game-list"
import { GameSearch } from "@/components/game-search"
import { HeroSearch } from "@/components/hero-search"
import { SiteFooter } from "@/components/site-footer"
import { catalogCardProps } from "@/lib/game-card-props"

export const metadata: Metadata = {
  title: "Games",
  description: "Every board and card game of PlayBoardGamesOnline, the ones to play now and the ones to come. Filter them by players, duration and age.",
  alternates: { canonical: "/games" },
}

/**
 * Every game of the catalog in one list, the ones to play now first, then the ones to come (docs/catalog.md): the list the home used to be.
 * The search bar above it (`HeroSearch`, with the filters of `SearchFilters`) filters it as the visitor types and picks, in the browser, on the
 * index that the page sends with the cards (`GameSearch`), so the page stays static and its HTML lists every game. The picks are in the address,
 * so a link opens the list as it was left; the text of the search is not. The home links here from its "Popular games" ("See all").
 */
export default async function GamesPage() {
  const { entries } = await getCatalog()
  const games = entries.map((entry) => ({ ...indexEntry(entry), props: catalogCardProps(entry) }))

  // The page ends above the consent banner (`--consent-h`, 0px without one) and starts at the top of the window: the backdrop of its header runs under the navbar
  return (
    <GameSearch games={games}>
      <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
        <main className="flex-1">
          <section className="bg-linear-to-b from-secondary via-card to-background pt-navbar">
            <div className="mx-auto flex w-full max-w-page flex-col items-center gap-8 px-gutter pt-section pb-12 text-center">
              <h1 className="font-heading text-4xl sm:text-5xl">Games</h1>
              <div className="w-full max-w-4xl">
                <HeroSearch />
              </div>
            </div>
          </section>

          <section id="results" aria-label="Games" className="mx-auto w-full max-w-page scroll-mt-navbar px-gutter pt-10 pb-section">
            <GameList />
          </section>
        </main>

        <SiteFooter />
      </div>
    </GameSearch>
  )
}
