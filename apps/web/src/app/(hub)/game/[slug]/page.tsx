import type { Metadata } from "next"
import { gameMetadata } from "@pbgo/catalog/seo"
import { GamePageView } from "@/components/game-page-view"
import { getGamePage } from "@/lib/game-page"
import { SITE_NAME, SITE_URL } from "@/site"

// The page of a game on the hub, where every card of the list leads, and where `/<slug>` leads: the platform is the door of the games (PLT-106). Everything it draws is `GamePageView`; this file says what search engines
// make of it: robots.txt does not cover `/game/<slug>` (it keeps crawlers out of `/*/game/`, the tables), so the page says itself whether it may be indexed, in its `robots` meta (`game.seo.indexable`: a live game follows the registry's flag,
// a game to come needs a description in its game in the Studio), and carries its JSON-LD only when it may. The rule and the metadata are `@pbgo/catalog/seo`.

export async function generateMetadata({ params }: PageProps<"/game/[slug]">): Promise<Metadata> {
  const game = await getGamePage((await params).slug)
  if (!game) return {}
  return gameMetadata(game.seo, { url: SITE_URL, name: SITE_NAME })
}

export default async function GameDescription({ params }: PageProps<"/game/[slug]">) {
  return <GamePageView slug={(await params).slug} />
}
