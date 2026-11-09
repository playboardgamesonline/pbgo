import { EmptySection } from "@/components/home-sections"

// The zones of the signed-in home that have nothing to list yet, drawn with their empty state so that the shape of the home is there to see, as the public home's tables and tournaments are: the tables open to the games a member plays and their
// tournaments. Each empty state says what will be listed there, in the words of the platform as it will be, and the rows or cards will take its place. They are server components. The member's history, stats and ranks are `home-your-games.tsx`'s.

/** The tables open now on the games the member plays (PLT-21), their own first. */
export function HomeOpenTables() {
  return (
    <EmptySection
      id="home-open-tables"
      label="Open tables"
      href="/tables"
      action="See all tables"
      heading="No table to join yet"
      description="The tables open to everyone on your games are listed here, yours first."
    />
  )
}

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
