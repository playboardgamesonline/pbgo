import type { Metadata } from "next"
import { GameClient } from "../components/game/game-client"
import { loadRules } from "../lib/rules-server"

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  return { title: `[${code.toUpperCase()}]`, robots: { index: false, follow: true } }
}

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <GameClient code={code.toUpperCase()} rules={await loadRules()} />
}
