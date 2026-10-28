import { indexEntry } from "@pbgo/catalog/filter"
import { getCatalog } from "@pbgo/catalog/server"
import { LetterMix } from "@pbgo/ui/platform/letter-mix"
import { GameSearch } from "@/components/game-search"
import { HeroSearch } from "@/components/hero-search"
import { HomeBody } from "@/components/home-body"
import { EmptySection, HowItWorks, PopularGames } from "@/components/home-sections"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { catalogCardProps } from "@/lib/game-card-props"
import { COMING_SOON } from "@/lib/coming-soon"

// Plain <a> to the games (GameCard): `@pbgo/ui` is framework-free, and the hub never prefetches a game's code.
// A card opens the game's page on the hub, `/game/<slug>`.

/**
 * The home: the title with the search bar laid over it, then the sections of the platform, each with a "See all" to the page of its tab
 * (popular games, tables and tournaments in progress, how it works, what's new), then the footer. Once the visitor starts a search the
 * sections give way to its results (`HomeBody`); the list of every game is `/games`.
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
        <SiteHeader current="home" />

        <main className="flex-1">
          {/* The hero: the title, each letter in one of four display faces (`LetterMix`), and the search bar laid over it (two floors: the field
              and the round button, then what to search and its filters), on a backdrop that is lighter at the top and fades into the black the sections sit on */}
          <section className="bg-linear-to-b from-secondary via-card to-background pt-navbar">
            <div className="mx-auto flex w-full max-w-page flex-col items-center px-gutter pt-section pb-12 text-center">
              <h1 className="font-heading text-3xl leading-tight sm:text-5xl lg:text-7xl xl:text-8xl">
                <LetterMix seed={1} className="block">
                  Play board games
                </LetterMix>{" "}
                <LetterMix seed={2} className="block">
                  with friends & rivals
                </LetterMix>
              </h1>
              {/* Laid over the bottom of the title: its top edge sits on the baseline of the last line (the 0.265em the line keeps under it, in
                  px for each size of the title), so the tails of the script letters pass behind it. `relative` paints it over the text. */}
              <div className="relative -mt-2 w-full max-w-4xl sm:-mt-3 lg:-mt-5 xl:-mt-6">
                <HeroSearch scopes />
              </div>
            </div>
          </section>

          <HomeBody>
            <PopularGames games={games} />
            <EmptySection
              id="tables-in-progress"
              title="Tables in progress"
              href="/tables"
              label="See all tables"
              {...COMING_SOON.tables}
            />
            <EmptySection
              id="tournaments-in-progress"
              title="Tournaments in progress"
              href="/tournaments"
              label="See all tournaments"
              {...COMING_SOON.tournaments}
            />
            <HowItWorks />
            <EmptySection id="whats-new" title="What's new" href="/whats-new" label="See what's new" {...COMING_SOON.whatsNew} />
          </HomeBody>
        </main>

        <SiteFooter />
      </div>
    </GameSearch>
  )
}
