import type { NextRequest } from "next/server"
import { MAX_JOUEURS } from "@/lib/partie-types"
import { ApiError, handle, lireJson } from "@/server/api"
import { getOrCreateJoueurId } from "@/server/joueur"
import { modifierPartie, partiePublique } from "@/server/parties"
import { type ProfilInput, validerProfil } from "@/server/profil"

export const POST = handle(async (request: NextRequest, ctx: RouteContext<"/api/parties/[code]/rejoindre">) => {
  const { code } = await ctx.params
  const profil = validerProfil(await lireJson<ProfilInput>(request))
  const id = await getOrCreateJoueurId()

  const row = await modifierPartie(code, (partie) => {
    const existant = partie.joueurs.find((j) => j.id === id)
    if (existant) {
      if (partie.statut !== "lobby") return null
      return { joueurs: partie.joueurs.map((j) => (j.id === id ? { id, ...profil } : j)) }
    }
    if (partie.statut !== "lobby") throw new ApiError("PARTIE_EN_COURS", 409)
    if (partie.joueurs.length >= MAX_JOUEURS) throw new ApiError("PARTIE_COMPLETE", 409)
    return { joueurs: [...partie.joueurs, { id, ...profil }] }
  })
  return partiePublique(row, id)
})
