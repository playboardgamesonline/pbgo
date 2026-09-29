import type { Metadata } from "next"
import { GameClient } from "../components/game/game-client"
import * as serverBinding from "@pgo/binding-server"
import { loadRules } from "../lib/rules-server"

/** Données propres au jeu passées au plateau (`Game`, prop `data`) : export facultatif `loadGameData()` de @pgo/binding-server. */
const gameDataLoader = (serverBinding as { loadGameData?: () => Promise<unknown> }).loadGameData

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  return { title: `[${code.toUpperCase()}]`, robots: { index: false, follow: true } }
}

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const [rules, data] = await Promise.all([loadRules(), gameDataLoader?.()])
  return <GameClient code={code.toUpperCase()} rules={rules} data={data} />
}
