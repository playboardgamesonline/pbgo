import { canPlayFor, playFor, waitingPlayers } from "@pbgo/engine-kit"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Home } from "../components/home/home"
import { PreviewGame } from "../components/preview-game"
import type { PlayableGame } from "../lib/binding"
import { getLocale } from "../lib/locale-server"
import { gameOptions } from "../lib/settings"
import { loadSettings } from "../lib/settings-server"
import { isAdmin } from "../server/admin"
import { type GameRow, loadGameData, loadSetupData, newGame, publicGame } from "../server/games"

export const previewMetadata: Metadata = { title: "Preview", robots: { index: false, follow: false } }

const NAMES = ["ALIX", "BASILE", "CAMILLE", "DORIAN", "ELISE", "FÉLIX", "GABRIEL", "HÉLOÏSE"]

/** Made-up game in progress, seen by the first player: a few turns are played automatically to fill the table. */
async function previewGame(game: PlayableGame) {
  const { GAME } = game.binding
  const settings = await loadSettings(game)
  const count = Math.max(GAME.minPlayers, Math.min(GAME.maxPlayers, 4))
  const players = NAMES.slice(0, count).map((nickname, i) => ({ id: `preview-${i}`, nickname }))
  const row: GameRow = {
    code: "SAMPLE",
    host_id: players[0]!.id,
    status: "lobby",
    players,
    options: gameOptions(game.binding, settings.options),
    state: null,
    replay: [],
    takeover_votes: [],
    seen: {},
    version: 1,
  }
  const started = { ...row, ...newGame(game, row, await loadSetupData(game, row.options)) }
  let state = started.state
  for (let i = 0; canPlayFor(GAME) && i < count * 2; i++) {
    const [waiting] = waitingPlayers(GAME, state)
    if (waiting === undefined) break
    const next = playFor(GAME, state, waiting)
    if (GAME.isOver(next)) break
    state = next
  }
  return publicGame(game, { ...started, state, updated_at: new Date().toISOString() }, players[0]!.id)
}

/** Admin previews (`/<slug>/preview/home`, `/<slug>/preview/game`), shown in an iframe that receives the draft. */
export async function PreviewPage({ game, kind }: { game: PlayableGame; kind: string }) {
  if (!(await isAdmin())) notFound()
  if (kind === "home") return <Home />
  if (kind === "game") {
    const [view, data] = await Promise.all([previewGame(game), loadGameData(game, await getLocale())])
    return <PreviewGame game={view} data={data} />
  }
  notFound()
}
