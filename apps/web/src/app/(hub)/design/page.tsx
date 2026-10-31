import type { Metadata } from "next"
import { Code } from "./_components/layout"
import { PageCards } from "./_components/page-cards"
import { PAGES } from "./_components/pages"

export const metadata: Metadata = {
  title: "Design system",
  description: "Tokens and components of the platform. Internal reference.",
  alternates: { canonical: "/design" },
}

/**
 * The way into the design system: every token and every component of `@pbgo/ui/platform`, live, in pages by family (`_components/pages.ts`: the foundations, five pages of components and the in-game UI). A platform screen is built
 * from what is shown here, and a piece that is missing is added to `@pbgo/ui` and to its page before it is used. The shell (header and navigation) is `layout.tsx`. The in-game UI is the one exception to the platform's look:
 * its page draws the components every game shares (seat label, players strip, announcements, game over) in the theme of two games, side by side, each inside its own `GameScope` (`_components/game-scope.tsx`).
 */
export default function DesignPage() {
  return (
    <>
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-4xl md:text-5xl">Design system</h1>
        <p className="max-w-reading text-lg text-muted-foreground">
          The tokens and components of the platform, as they render today, in {PAGES.length} pages. Hub, account, legal, gamemaster and 404 are built from these and from nothing else. The in-game UI is not: its page draws the components every game
          shares in the look of two games, because each game owns its universe.
        </p>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Code>@pbgo/ui/platform/*</Code>
          <Code>@pbgo/ui/styles/platform.css</Code>
          <Code>@pbgo/ui/theme</Code>
        </p>
      </div>
      <PageCards pages={PAGES} />
    </>
  )
}
