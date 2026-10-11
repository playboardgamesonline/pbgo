"use client"

import { useBinding } from "../lib/binding-context"
import type { PublicGame } from "../lib/game-types"

/** Board of the admin preview: a sample game, no action is sent. */
export function PreviewGame({ game, data }: { game: PublicGame; data?: unknown }) {
  const { Game } = useBinding()
  return Game ? <Game game={game} data={data} onUpdate={() => {}} onLeave={() => {}} /> : null
}
