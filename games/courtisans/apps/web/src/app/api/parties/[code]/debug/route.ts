import { appliquerDebug, type CommandeDebug, setupPartie } from "@courtisans/engine"
import type { NextRequest } from "next/server"
import { MAX_JOUEURS } from "@/lib/partie-types"
import { ApiError, handle, lireJson } from "@/server/api"
import { getJoueurId } from "@/server/joueur"
import { chargerMissions } from "@/server/missions"
import { modifierPartie, partiePublique } from "@/server/parties"

const COMMANDES = ["debut", "missions", "tour", "fin"] as const
type Commande = (typeof COMMANDES)[number]

export const POST = handle(async (request: NextRequest, ctx: RouteContext<"/api/parties/[code]/debug">) => {
  if (process.env.NODE_ENV === "production" && process.env.DEBUG_PARTIES !== "1") throw new ApiError("DEBUG_DESACTIVE", 403)
  const { code } = await ctx.params
  const id = await getJoueurId()
  const { commande } = await lireJson<{ commande: Commande }>(request)
  if (!COMMANDES.includes(commande)) throw new ApiError("ACTION_INVALIDE")
  const missions = commande === "debut" ? await chargerMissions(MAX_JOUEURS) : []

  const row = await modifierPartie(code, (partie) => {
    if (!id || !partie.joueurs.some((j) => j.id === id)) throw new ApiError("JOUEUR_INCONNU", 403)
    if (commande === "debut") return { statut: "jeu", etat: setupPartie({ joueurs: partie.joueurs, missions }), rejouer: [] }
    if (!partie.etat) throw new ApiError("PARTIE_NON_LANCEE", 409)
    const etat = appliquerDebug(partie.etat, commande as CommandeDebug)
    return { etat, statut: etat.phase === "fin" ? "fin" : "jeu" }
  })
  return partiePublique(row, id)
})
