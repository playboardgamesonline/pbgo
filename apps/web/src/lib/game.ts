import "server-only"
import { notFound } from "next/navigation"
import { getGame, getPlayableGame } from "@pbgo/games"

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
