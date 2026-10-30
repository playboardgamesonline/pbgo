import { indexEntry } from "@pbgo/catalog/filter"
import { getCatalog } from "@pbgo/catalog/server"
import { Perks, Stats } from "@pbgo/ui/platform/stats"
import { TitleCards, TitlePiece } from "@pbgo/ui/platform/title-piece"
import { GameSearch } from "@/components/game-search"
import { HeroSearch } from "@/components/hero-search"
import { HomeBody } from "@/components/home-body"
import { EmptySection, PopularGames } from "@/components/home-sections"
import { SiteFooter } from "@/components/site-footer"
import { catalogCardProps } from "@/lib/game-card-props"
import { figure, getHubFigures } from "@/lib/hub-stats"
import { COMING_SOON } from "@/lib/coming-soon"

// Plain <a> to the games (GameCard): `@pbgo/ui` is framework-free, and the hub never prefetches a game's code.
// A card opens the game's page on the hub, `/game/<slug>`.

/**
 * The home: the title with what the platform is under it (its figures and what is free), then the search bar, then the sections of the platform, each with a button to the page of its tab
 * (popular games, tables and tournaments in progress, what's new), then the footer. Once the visitor starts a search the sections give way
 * to its results (`HomeBody`); the list of every game is `/games`.
 */
export default async function Home() {
  // The live games of the registry, then the games to come, already in their order (docs/catalog.md). Without Notion (no key, or
  // Notion down) the catalog is the live games alone, each from the registry.
  const [{ entries }, figures] = await Promise.all([getCatalog(), getHubFigures()])
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
          {/* The hero, the page of a visitor who is not signed in (signed in, there is no title: the home is built from what they play): the title in two lines of the same size, in sentence case, in Geist
              at a weight of 720 and a tracking of -0.048em (`display-title`), in which some letters are pieces of a game table that move now and then (`TitlePiece`: a coin that spins, the suits of a deck in turn and a die that turns, for three "o", and two
              dark blue cards after "games", `TitleCards`), then what the platform is: its figures in pills (`Stats`: the players connected now, with a green dot, and the members, counted in Supabase, and the games of the catalog) and what
              costs nothing (`Perks`), and the search bar under them (the field with the category, then the filters, bare, in a row; glass), on the page's black,
              flat, and nothing else (no gradient, no table, no grid of thin lines, no game pieces) */}
          <section className="pt-navbar">
            <div className="mx-auto flex w-full max-w-page flex-col items-center px-gutter pt-20 pb-12 text-center sm:pt-28">
              <h1 className="display-title">
                <span className="block text-display">Play y<TitlePiece kind="coin">o</TitlePiece>ur fav<TitlePiece kind="suits">o</TitlePiece>rite</span>{" "}
                <span className="block text-display">b<TitlePiece kind="die">o</TitlePiece>ard games <TitleCards />online</span>
              </h1>
              <Stats
                className="mt-8"
                items={[
                  ...(figures.online === null ? [] : [{ value: figure(figures.online), label: "players online", live: true }]),
                  ...(figures.members === null ? [] : [{ value: figure(figures.members), label: "members" }]),
                  { value: figure(games.length), label: "games" },
                ]}
              />
              <Perks className="mt-6" items={["Free to play", "No sign-up needed"]} />
              {/* 64px under what the platform is, which it covers none of; from `sm` no wider than the title (`max-w-hero-bar`) */}
              <div className="mt-16 w-full max-w-3xl sm:max-w-hero-bar">
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
            <EmptySection id="whats-new" label="What's new" href="/about#whats-new" action="See what's new" {...COMING_SOON.whatsNew} />
          </HomeBody>
        </main>

        <SiteFooter />
      </div>
    </GameSearch>
  )
}
