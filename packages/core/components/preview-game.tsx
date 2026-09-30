"use client"

import { Game } from "@pgo/binding-ui"
import type { PublicGame } from "../lib/game-types"
import type { RulesContent } from "../lib/rules"

/** Plateau de l'aperçu de l'admin : partie fictive, aucune action n'est envoyée. */
export function PreviewGame({ game, rules, data }: { game: PublicGame; rules: RulesContent; data?: unknown }) {
  return <Game game={game} rules={rules} data={data} onUpdate={() => {}} onLeave={() => {}} />
}
