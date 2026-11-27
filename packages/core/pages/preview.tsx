import { canPlayFor, playFor, waitingPlayers } from "@pbgo/engine-kit"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SandboxClient } from "../components/game/sandbox"
import { PreviewGame } from "../components/preview-game"
import type { PlayableGame } from "../lib/binding"
import { getLocale } from "../lib/locale-server"
import { gameOptions } from "../lib/settings"
import { loadSettings } from "../lib/settings-server"
import { sandboxParams } from "../lib/sandbox"
import { isAdmin } from "../server/admin"
import { type GameRow, loadGameData, loadSetupData, newGame, publicGame } from "../server/games"
import { sandboxAllowed, sandboxNew, sandboxView } from "../server/sandbox"

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
    // The made-up players are at the table: seen just now, so that no seat fades as an absent player's
    seen: Object.fromEntries(players.map((j) => [j.id, new Date().toISOString()])),
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

type Search = Record<string, string | string[] | undefined>

/**
 * The previews of a game (`/<slug>/preview/<kind>`):
 * - `game`: the board at a sample game, still, in the gamemaster's iframe that sends it the draft of the Setup pages. The gamemaster only.
 * - `play`: a made-up game to play against the real engine, with no database (`SandboxClient`, `lib/sandbox.ts`): `?players=4&turns=6&scenario=princessInHand&seat=1&seed=42`, and `bare` for no bar. Anybody on a preview deployment and
 *   in development, the gamemaster only on the production deployment (`/gamemaster/<slug>/preview/play`, where the session is sent).
 */
export async function PreviewPage({ game, kind, searchParams = {} }: { game: PlayableGame; kind: string; searchParams?: Search }) {
  if (kind === "play") {
    if (!(await sandboxAllowed())) notFound()
    const { GAME } = game.binding
    const setup = sandboxParams(searchParams, GAME)
    const [{ options }, locale] = await Promise.all([loadSettings(game), getLocale()])
    const [setupData, data] = await Promise.all([loadSetupData(game, {}), loadGameData(game, locale)])
    const table = sandboxNew(game, setup, options, setupData)
    const viewer = table.players[setup.seat]!.id
    return <SandboxClient initial={{ table, game: sandboxView(game, table, viewer) }} setup={setup} data={data} bare={searchParams.bare !== undefined} />
  }
  if (!(await isAdmin())) notFound()
  if (kind === "game") {
    const [view, data] = await Promise.all([previewGame(game), loadGameData(game, await getLocale())])
    return <PreviewGame game={view} data={data} />
  }
  notFound()
}
