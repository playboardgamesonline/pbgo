import type { Metadata } from "next"
import { GamePageView } from "@/components/game-page-view"
import { getGamePage } from "@/lib/game-page"

// The page of a table that waits for players, on the hub (PLT-106): where the link `/<slug>/game/<code>` of such a table leads (`GamePage` of core redirects there), and so the link that is shared to invite. It is the page of the game with the table picked
// (`GamePageView`). A table is private to those who have its link: the page is never indexed and robots.txt keeps crawlers out of it (`/game/*/`). The title names the table by its code, as the table's own page does.

/** "ABC234" is written "ABC-234", as everywhere a table's code is shown. */
const codeLabel = (code: string) => (code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code).toUpperCase()

export async function generateMetadata({ params }: PageProps<"/game/[slug]/[code]">): Promise<Metadata> {
  const { slug, code } = await params
  const game = await getGamePage(slug)
  if (!game) return {}
  return { title: `${game.name} · Table #${codeLabel(code)}`, robots: { index: false, follow: false } }
}

export default async function GameTablePage({ params }: PageProps<"/game/[slug]/[code]">) {
  const { slug, code } = await params
  return <GamePageView slug={slug} code={code} />
}
