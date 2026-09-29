import type { JoueurInfo, VueJoueur } from "@courtisans/engine"

export const MAX_JOUEURS = 5
export const MIN_JOUEURS = 2

export type StatutPartie = "lobby" | "jeu" | "fin"

export type PartiePublique = {
  code: string
  hoteId: string
  statut: StatutPartie
  joueurs: JoueurInfo[]
  moiId: string | null
  rejouer: string[]
  version: number
  vue: VueJoueur | null
}

export const canalPartie = (code: string) => `partie:${code}`
export const EVENEMENT_MAJ = "maj"
