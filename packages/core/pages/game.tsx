import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { GameClient } from "../components/game/game-client"
import type { PlayableGame } from "../lib/binding"
import { getLocale } from "../lib/locale-server"
import { tableTitle } from "../lib/settings"
import { loadSettings } from "../lib/settings-server"
import { tablePath } from "../lib/site-url"
import { loadGameData, readGame } from "../server/games"

/** `generateMetadata` of `/<slug>/game/[code]`: title of the table, not indexed. */
export async function gameMetadata(game: PlayableGame, code: string): Promise<Metadata> {
  const { title } = await loadSettings(game)
  return { title: { absolute: tableTitle(title, code) }, robots: { index: false, follow: true } }
}

/**
 * A table (`/<slug>/game/<code>`). The board receives the game's own data (`loadGameData` of its server binding). A table that waits for players has no screen here: it is opened, joined and started on the platform's page of the game, so its
 * link, the one that is shared to invite, leads to the page of that table on the hub (`/game/<slug>/<code>`, PLT-106). A table that was started shows its board; one that does not exist is the client's to say (`GameClient`).
 */
export async function GamePage({ game, code }: { game: PlayableGame; code: string }) {
  const row = await readGame(game, code).catch(() => null)
  if (row?.status === "lobby") redirect(tablePath(game.slug, row.code))
  const data = await loadGameData(game, await getLocale())
  return <GameClient code={code.toUpperCase()} data={data} />
}
