import { GAME, type State } from "@pgo/binding"
import * as serverBinding from "@pgo/binding-server"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Home } from "../components/home/home"
import { PreviewGame } from "../components/preview-game"
import { loadRules } from "../lib/rules-server"
import { gameOptions } from "../lib/settings"
import { loadSettings } from "../lib/settings-server"
import { isAdmin } from "../server/admin"
import { type GameRow, loadSetupData, newGame, publicGame } from "../server/games"

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

const NAMES = ["ALIX", "BASILE", "CAMILLE", "DORIAN", "ELISE", "FÉLIX", "GABRIEL", "HÉLOÏSE"]
const gameDataLoader = (serverBinding as { loadGameData?: () => Promise<unknown> }).loadGameData

/** Partie fictive en cours, vue par le premier joueur : quelques tours joués automatiquement pour remplir la table. */
async function previewGame() {
  const settings = await loadSettings()
  const count = Math.max(GAME.minPlayers, Math.min(GAME.maxPlayers, 4))
  const players = NAMES.slice(0, count).map((nickname, i) => ({ id: `preview-${i}`, nickname }))
  const row: GameRow = { code: "APERCU", host_id: players[0]!.id, status: "lobby", players, options: gameOptions(settings.options), state: null, replay: [], version: 1 }
  const started = { ...row, ...newGame(row, await loadSetupData(row.options)) }
  const play = GAME.autoPlay ?? GAME.debug?.turn
  let state = started.state as State
  for (let i = 0; play && i < count * 2; i++) {
    const next = play(state)
    if (GAME.isOver(next)) break
    state = next
  }
  return publicGame({ ...started, state, updated_at: new Date().toISOString() }, players[0]!.id)
}

/** Aperçus de l'admin (/preview/home, /preview/game), affichés dans une iframe qui reçoit le brouillon. */
export default async function PreviewPage({ params }: { params: Promise<{ kind: string }> }) {
  if (!(await isAdmin())) notFound()
  const { kind } = await params
  const rules = await loadRules()
  if (kind === "home") return <Home rules={rules} />
  if (kind === "game") {
    const [game, data] = await Promise.all([previewGame(), gameDataLoader?.()])
    return <PreviewGame game={game} rules={rules} data={data} />
  }
  notFound()
}
