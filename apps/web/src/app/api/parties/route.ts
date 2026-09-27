import { handle, lireJson } from "@/server/api"
import { getOrCreateJoueurId } from "@/server/joueur"
import { creerPartie, partiePublique } from "@/server/parties"
import { type ProfilInput, validerProfil } from "@/server/profil"

export const POST = handle(async (request: Request) => {
  const profil = validerProfil(await lireJson<ProfilInput>(request))
  const id = await getOrCreateJoueurId()
  const row = await creerPartie({ id, ...profil })
  return partiePublique(row, id)
})
