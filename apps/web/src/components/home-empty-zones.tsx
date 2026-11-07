import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { Section } from "@pbgo/ui/platform/section"
import { EmptySection } from "@/components/home-sections"

// The zones of the signed-in home that have nothing to list yet, drawn with their empty state so that the shape of the home is there to see, as the public home's tables and tournaments are: the tables open to the games a member plays, their history
// and stats, their ranks, and their tournaments. Each empty state says what will be listed there, in the words of the platform as it will be, and the rows or cards will take its place. They are server components.

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

/** The member's history and stats, and their rank on each game. Two blocks side by side, one above the other on a phone. */
export function HomeYourGames() {
  return (
    <Section aria-labelledby="home-your-games">
      <h2 id="home-your-games" className="sr-only">
        Your games
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Empty className="border p-6">
          <EmptyHeader>
            <EmptyTitle>No game yet</EmptyTitle>
            <EmptyDescription>Your last games and your stats are listed here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <Empty className="border p-6">
          <EmptyHeader>
            <EmptyTitle>No rank yet</EmptyTitle>
            <EmptyDescription>Your rank on each game is shown here once you have played ranked.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </Section>
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
