import type { PartiePublique } from "./partie-types"

const MESSAGES: Record<string, string> = {
  PSEUDO_INVALIDE: "Choisis un pseudonyme.",
  CHATEAU_INVALIDE: "Choisis un château.",
  CODE_INVALIDE: "Ce code de partie n'est pas valide.",
  PARTIE_INTROUVABLE: "Aucune partie ne correspond à ce code.",
  PARTIE_EN_COURS: "Cette partie a déjà commencé.",
  PARTIE_COMPLETE: "Cette partie est complète (5 joueurs).",
  RESERVE_A_L_HOTE: "Seul l'hôte peut lancer la partie.",
  PAS_ASSEZ_DE_JOUEURS: "Il faut au moins 2 joueurs.",
  PAS_TON_TOUR: "Ce n'est pas ton tour.",
  ZONE_DEJA_JOUEE: "Tu as déjà joué une carte dans cette zone.",
  ASSASSINAT_INVALIDE: "Cette carte ne peut pas être éliminée.",
  CONFLIT: "Quelqu'un a joué en même temps, réessaie.",
}

export class ApiClientError extends Error {
  constructor(public code: string) {
    super(MESSAGES[code] ?? "Une erreur est survenue.")
  }
}

async function requete(path: string, init?: RequestInit): Promise<PartiePublique> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" })
  const data = await response.json().catch(() => ({ erreur: "ERREUR_SERVEUR" }))
  if (!response.ok) throw new ApiClientError(data.erreur ?? "ERREUR_SERVEUR")
  return data as PartiePublique
}

const post = (path: string, body?: unknown) => requete(path, { method: "POST", body: JSON.stringify(body ?? {}) })

export const api = {
  creer: (profil: { pseudo: string; chateau: string }) => post("/api/parties", profil),
  lire: (code: string) => requete(`/api/parties/${code}`),
  rejoindre: (code: string, profil: { pseudo: string; chateau: string }) => post(`/api/parties/${code}/rejoindre`, profil),
  quitter: (code: string) => post(`/api/parties/${code}/quitter`),
  lancer: (code: string) => post(`/api/parties/${code}/lancer`),
  action: (code: string, action: unknown) => post(`/api/parties/${code}/action`, action),
  rejouer: (code: string) => post(`/api/parties/${code}/rejouer`),
}

export const lienPartie = (code: string) => `${window.location.origin}/partie/${code}`
