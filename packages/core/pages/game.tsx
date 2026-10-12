import type { Metadata } from "next"
import { GameClient } from "../components/game/game-client"
import type { PlayableGame } from "../lib/binding"
import { getLocale } from "../lib/locale-server"
import { tableTitle } from "../lib/settings"
import { loadSettings } from "../lib/settings-server"
import { loadGameData } from "../server/games"

/** `generateMetadata` of `/<slug>/game/[code]`: title of the table, not indexed. */
export async function gameMetadata(game: PlayableGame, code: string): Promise<Metadata> {
  const { title } = await loadSettings(game)
  return { title: { absolute: tableTitle(title, code) }, robots: { index: false, follow: true } }
}

/** A table (`/<slug>/game/<code>`). The board receives the game's own data (`loadGameData` of its server binding). */
export async function GamePage({ game, code }: { game: PlayableGame; code: string }) {
  const data = await loadGameData(game, await getLocale())
  return <GameClient code={code.toUpperCase()} data={data} />
}
