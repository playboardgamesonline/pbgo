import type { NextRequest } from "next/server"
import { handle } from "@/server/api"
import { getJoueurId } from "@/server/joueur"
import { modifierPartie, partiePublique } from "@/server/parties"

export const POST = handle(async (_request: NextRequest, ctx: RouteContext<"/api/parties/[code]/quitter">) => {
  const { code } = await ctx.params
  const id = await getJoueurId()
  const row = await modifierPartie(code, (partie) => {
    if (partie.statut !== "lobby" || !partie.joueurs.some((j) => j.id === id)) return null
    const joueurs = partie.joueurs.filter((j) => j.id !== id)
    const hote_id = partie.hote_id === id ? (joueurs[0]?.id ?? partie.hote_id) : partie.hote_id
    return { joueurs, hote_id }
  })
  return partiePublique(row, id)
})
