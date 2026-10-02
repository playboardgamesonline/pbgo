"use client"

import { Game } from "@pbgo/binding-ui"
import type { PublicGame } from "../lib/game-types"

/** Plateau de l'aperçu de l'admin : partie fictive, aucune action n'est envoyée. */
export function PreviewGame({ game, data }: { game: PublicGame; data?: unknown }) {
  return <Game game={game} data={data} onUpdate={() => {}} onLeave={() => {}} />
}
