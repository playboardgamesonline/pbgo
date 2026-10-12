import "server-only"
import { notFound } from "next/navigation"
import { getGame, getPlayableGame, getPreviewableGame } from "@pbgo/games"

type GameParams = Promise<{ game: string }>

/** Game of the `[game]` segment, null for an unknown slug. For the root layout, which cannot answer 404 itself. */
export async function findGameOf(params: GameParams) {
  return getGame((await params).game)
}

/** Game of the `[game]` segment; unknown slug → 404. */
export async function gameOf(params: GameParams) {
  return (await findGameOf(params)) ?? notFound()
}

/** Game of the `[game]` segment when it can be played here (engine, live in production); else 404. */
export async function playableGameOf(params: GameParams) {
  return (await getPlayableGame((await params).game)) ?? notFound()
}

/** Game of the `[game]` segment when it has an engine, live or not, for the admin previews (the page checks the session); else 404. */
export async function previewableGameOf(params: GameParams) {
  return (await getPreviewableGame((await params).game)) ?? notFound()
}
