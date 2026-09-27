import "server-only"
import { ApiError } from "./api"

export type ProfilInput = { pseudo?: unknown; chateau?: unknown }

export function validerProfil(input: ProfilInput): { pseudo: string; chateau: string } {
  const pseudo = typeof input.pseudo === "string" ? input.pseudo.trim().slice(0, 20) : ""
  const chateau = typeof input.chateau === "string" ? input.chateau.slice(0, 100) : ""
  if (pseudo.length < 1) throw new ApiError("PSEUDO_INVALIDE")
  if (!chateau) throw new ApiError("CHATEAU_INVALIDE")
  return { pseudo, chateau }
}
