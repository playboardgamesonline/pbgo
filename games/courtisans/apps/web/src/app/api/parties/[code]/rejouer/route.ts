import { setupPartie } from "@courtisans/engine"
import type { NextRequest } from "next/server"
import { MAX_JOUEURS } from "@/lib/partie-types"
import { ApiError, handle } from "@/server/api"
import { getJoueurId } from "@/server/joueur"
import { chargerMissions } from "@/server/missions"
import { modifierPartie, partiePublique } from "@/server/parties"

export const POST = handle(async (_request: NextRequest, ctx: RouteContext<"/api/parties/[code]/rejouer">) => {
  const { code } = await ctx.params
  const id = await getJoueurId()
  const missions = await chargerMissions(MAX_JOUEURS)

  const row = await modifierPartie(code, (partie) => {
    if (partie.statut !== "fin") throw new ApiError("PARTIE_NON_TERMINEE", 409)
    if (!id || !partie.joueurs.some((j) => j.id === id)) throw new ApiError("JOUEUR_INCONNU", 403)
    if (partie.rejouer.includes(id)) return null
    const rejouer = [...partie.rejouer, id]
    if (rejouer.length < partie.joueurs.length) return { rejouer }
    return { statut: "jeu", etat: setupPartie({ joueurs: partie.joueurs, missions }), rejouer: [] }
  })
  return partiePublique(row, id)
})
