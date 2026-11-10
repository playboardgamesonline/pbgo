import { EmptySection } from "@/components/home-sections"

// The zones of the signed-in home that have nothing to list yet, drawn with their empty state so that the shape of the home is there to see, as the public home's tables and tournaments are: the member's tournaments (their tables are
// `home-open-tables.tsx`'s). Each empty state says what will be listed there, in the words of the platform as it will be, and the rows or cards will take its place. They are server components. The member's history, stats and ranks are `home-your-games.tsx`'s.

/** The tournaments the member plays in, and the coming ones on their games, with a way to register. */
export function HomeTournaments() {
  return (
    <EmptySection
      id="home-tournaments"
      label="Tournaments"
      href="/tournaments"
      action="See all tournaments"
      heading="No tournament yet"
      description="Your tournaments, and the coming ones on the games you play, are listed here."
    />
  )
}
