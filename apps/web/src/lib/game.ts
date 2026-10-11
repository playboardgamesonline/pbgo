import "server-only"
import { notFound } from "next/navigation"
import { getGame, getPlayableGame } from "@pbgo/games"

type GameParams = Promise<{ game: string }>

/** Game of the `[game]` segment; unknown slug → 404. */
export async function gameOf(params: GameParams) {
  return (await getGame((await params).game)) ?? notFound()
}

/** Game of the `[game]` segment when it can be played here (engine, live in production); else 404. */
export async function playableGameOf(params: GameParams) {
  return (await getPlayableGame((await params).game)) ?? notFound()
}
