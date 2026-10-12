import { AdminPage, adminMetadata } from "@pbgo/core/pages/admin"
import { findGame, GAMES } from "@pbgo/games"
import { gameOf } from "@/lib/game"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: PageProps<"/gamemaster/[game]/[[...section]]">) {
  const { game, section } = await params
  return adminMetadata(findGame(game), section)
}

/** `/gamemaster/<slug>/<page>`: any game of the registry, playable here or not (`gameOf`, never `playableGameOf`). */
export default async function GamemasterGame({ params }: PageProps<"/gamemaster/[game]/[[...section]]">) {
  return <AdminPage game={await gameOf(params)} section={(await params).section} games={GAMES} />
}
