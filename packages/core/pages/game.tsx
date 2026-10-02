import type { Metadata } from "next"
import { GameClient } from "../components/game/game-client"
import * as serverBinding from "@pbgo/binding-server"
import { tableTitle } from "../lib/settings"
import { loadSettings } from "../lib/settings-server"

/** Données propres au jeu passées au plateau (`Game`, prop `data`) : export facultatif `loadGameData()` de @pbgo/binding-server. */
const gameDataLoader = (serverBinding as { loadGameData?: () => Promise<unknown> }).loadGameData

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const { title } = await loadSettings()
  return { title: { absolute: tableTitle(title, code) }, robots: { index: false, follow: true } }
}

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const data = await gameDataLoader?.()
  return <GameClient code={code.toUpperCase()} data={data} />
}
