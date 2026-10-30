import { pageMetadata } from "../_components/pages"
import { PageHead } from "../_components/page-head"
import { InGameUi } from "../_sections/in-game-ui"

export const metadata = pageMetadata("in-game")

/**
 * The components every game shares, drawn in the theme of two games, side by side, each inside its own `GameScope` (`_components/game-scope.tsx`): the one exception to the platform's look, since each game owns its universe.
 */
export default function InGamePage() {
  return (
    <>
      <PageHead slug="in-game" />
      <InGameUi />
    </>
  )
}
