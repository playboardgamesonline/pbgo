import { type Action, applyAction } from "@courtisans/engine"
import type { NextRequest } from "next/server"
import { ApiError, handle, lireJson } from "@/server/api"
import { getJoueurId } from "@/server/joueur"
import { modifierPartie, partiePublique } from "@/server/parties"

type ActionClient = Action extends infer A ? (A extends { joueurId: string } ? Omit<A, "joueurId"> : never) : never

export const POST = handle(async (request: NextRequest, ctx: RouteContext<"/api/parties/[code]/action">) => {
  const { code } = await ctx.params
  const id = await getJoueurId()
  if (!id) throw new ApiError("JOUEUR_INCONNU", 401)
  const action = await lireJson<ActionClient>(request)
  if (action.type !== "lireMissions" && action.type !== "jouerCarte") throw new ApiError("ACTION_INVALIDE")

  const row = await modifierPartie(code, (partie) => {
    if (!partie.etat || partie.statut !== "jeu") throw new ApiError("PARTIE_NON_LANCEE", 409)
    const etat = applyAction(partie.etat, { ...action, joueurId: id } as Action)
    return { etat, statut: etat.phase === "fin" ? "fin" : "jeu" }
  })
  return partiePublique(row, id)
})
