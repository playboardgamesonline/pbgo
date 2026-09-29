export const FAMILLES = ["papillon", "crapaud", "rossignol", "lievre", "cerf", "carpe"] as const
export type Famille = (typeof FAMILLES)[number]

export const ROLES = ["noble", "espion", "assassin", "garde"] as const
export type Role = (typeof ROLES)[number]

export type Courtisan = {
  id: string
  famille: Famille
  role: Role | null
}

export type Niveau = "haut" | "bas"
export type Statut = "lumiere" | "disgrace" | "neutre"
export type ZoneJeu = "table" | "domaine" | "domaineAdverse"

export type Cible = { zone: "table"; niveau: Niveau } | { zone: "domaine"; joueurId: string }

export type Comparateur = "eq" | "gte" | "lte" | "gt" | "lt"

export type FiltreCartes = {
  famille?: Famille
  role?: Role | "sansRole"
}

export type ModeComptage = "cartes" | "poids"

export type Adversaire = "voisinGauche" | "voisinDroite" | "tousLesAdversaires" | "auMoinsUnAdversaire"

export type Condition =
  | { type: "statutFamille"; famille: Famille; statut: Statut }
  | { type: "nombreFamillesStatut"; statut: Statut; comparateur: Comparateur; valeur: number }
  | { type: "nombreCartesDomaine"; filtre: FiltreCartes; comparateur: Comparateur; valeur: number; mode?: ModeComptage }
  | { type: "nombreCartesTable"; filtre: FiltreCartes; niveau?: Niveau; comparateur: Comparateur; valeur: number; mode?: ModeComptage }
  | { type: "comparaisonJoueurs"; filtre: FiltreCartes; comparateur: Comparateur; adversaire: Adversaire; mode?: ModeComptage }
  | { type: "et"; conditions: Condition[] }
  | { type: "ou"; conditions: Condition[] }
  | { type: "non"; condition: Condition }

export type CouleurMission = "blanche" | "bleue"

export type Mission = {
  id: string
  couleur: CouleurMission
  texte: string
  condition: Condition
}

export type JoueurInfo = {
  id: string
  pseudo: string
  chateau: string
}

export type Joueur = JoueurInfo & {
  main: Courtisan[]
  domaine: Courtisan[]
  missions: Mission[]
  missionsLues: boolean
}

export type Placement = {
  carte: Courtisan
  niveau: Niveau
}

export type Phase = "missions" | "jeu" | "fin"

export type Evenement =
  | { type: "carteJouee"; joueurId: string; carte: Courtisan; cible: Cible }
  | { type: "carteEliminee"; joueurId: string; carte: Courtisan; cible: Cible }
  | { type: "pioche"; joueurId: string; nombre: number }
  | { type: "finDePartie" }

export type GameState = {
  joueurs: Joueur[]
  pioche: Courtisan[]
  ecartees: Courtisan[]
  eliminees: Courtisan[]
  table: Placement[]
  joueurActif: number
  zonesJouees: ZoneJeu[]
  numeroTour: number
  phase: Phase
  journal: Evenement[]
}

export type Action =
  | { type: "lireMissions"; joueurId: string }
  | { type: "jouerCarte"; joueurId: string; carteId: string; cible: Cible; cibleAssassinat?: string }
