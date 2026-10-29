import { indexEntry } from "@pbgo/catalog/filter"
import { getCatalog } from "@pbgo/catalog/server"
import { Tabletop } from "@pbgo/ui/platform/tabletop"
import { GameSearch } from "@/components/game-search"
import { HeroSearch } from "@/components/hero-search"
import { HomeBody } from "@/components/home-body"
import { EmptySection, PopularGames } from "@/components/home-sections"
import { SiteFooter } from "@/components/site-footer"
import { catalogCardProps } from "@/lib/game-card-props"
import { COMING_SOON } from "@/lib/coming-soon"

// Plain <a> to the games (GameCard): `@pbgo/ui` is framework-free, and the hub never prefetches a game's code.
// A card opens the game's page on the hub, `/game/<slug>`.

/**
 * The home: the title with the search bar under it, then the sections of the platform, each with a button to the page of its tab
 * (popular games, tables and tournaments in progress, what's new), then the footer. Once the visitor starts a search the sections give way
 * to its results (`HomeBody`); the list of every game is `/games`.
 */
export default async function Home() {
  // The live games of the registry, then the games to come, already in their order (docs/catalog.md). Without Notion (no key, or
  // Notion down) the catalog is the live games alone, each from the registry.
  const { entries } = await getCatalog()
  // Each card is the game's Notion row, a live game's included (its logo, or icon, and its background come from the catalog's picture
  // route; a picture the row does not have leaves the frame plain): the hub reads no game's Sanity project, only entering a game does.
  // The registry decides the card's variant alone. Each game goes to the browser with what the search reads of it (`indexEntry`)
  // beside its card: a search is answered there (`GameSearch`, which the bar of the hero and the results read), in the order of the
  // catalog, and this page stays static.
  const games = entries.map((entry) => ({ ...indexEntry(entry), props: catalogCardProps(entry) }))

  // The page ends above the consent banner (`--consent-h`, set on <body>; 0px without a banner). It starts at the top of the window: the
  // fixed navbar is two containers with nothing between them, and the backdrop of the hero runs under both (`pt-navbar` keeps its text clear of them)
  return (
    <GameSearch games={games}>
      <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
        <main className="flex-1">
          {/* The hero: the title in capitals, on three lines of the same size, all in Geist Black (`display-title`), narrowing as they go down, and the
              search bar 32px under it (the field with the category, then the filters, bare, in a row; glass),
              on a backdrop that is lighter at the top and fades into the black the sections sit on, with a table under a lamp laid over it (`Tabletop`: a chessboard
              in perspective, the glow of the lamp and a fine grain; neither the grid of thin lines of `pattern-grid` nor the game pieces of `BoardPattern` are drawn) */}
          <section className="relative bg-linear-to-b from-card to-background pt-navbar">
            <Tabletop />
            <div className="relative mx-auto flex w-full max-w-page flex-col items-center px-gutter pt-14 pb-12 text-center">
              <h1 className="display-title">
                <span className="block text-display">Board games</span> <span className="block text-display">w/ friends</span>{" "}
                <span className="block text-display">& rivals</span>
              </h1>
              {/* 32px under the title, which it covers none of */}
              <div className="mt-8 w-full max-w-3xl">
                <HeroSearch />
              </div>
            </div>
          </section>

          <HomeBody>
            <PopularGames games={games} />
            <EmptySection
              id="tables-in-progress"
              label="Tables in progress"
              href="/tables"
              action="See all tables"
              {...COMING_SOON.tables}
            />
            <EmptySection
              id="tournaments-in-progress"
              label="Tournaments in progress"
              href="/tournaments"
              action="See all tournaments"
              {...COMING_SOON.tournaments}
            />
            <EmptySection id="whats-new" label="What's new" href="/whats-new" action="See what's new" {...COMING_SOON.whatsNew} />
          </HomeBody>
        </main>

        <SiteFooter />
      </div>
    </GameSearch>
  )
}
