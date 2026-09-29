export type EngineErrorCode =
  | "JOUEURS_INVALIDES"
  | "MISSIONS_INSUFFISANTES"
  | "PHASE_INVALIDE"
  | "PAS_TON_TOUR"
  | "CARTE_INCONNUE"
  | "ZONE_DEJA_JOUEE"
  | "CIBLE_INVALIDE"
  | "ASSASSINAT_INVALIDE"
  | "JOUEUR_INCONNU"

export class EngineError extends Error {
  constructor(
    public code: EngineErrorCode,
    message?: string,
  ) {
    super(message ?? code)
    this.name = "EngineError"
  }
}
