import { FAMILLES, type Famille, ROLES, type Role } from "@courtisans/engine"
import { IMAGES_MISSIONS_PAR_DEFAUT } from "./missions-par-defaut"

export type ChateauOption = { id: string; nom: string; imageUrl: string | null }

export const CHATEAUX_PAR_DEFAUT: ChateauOption[] = [
  { id: "chateau-or", nom: "Château d'Or", imageUrl: null },
  { id: "chateau-pourpre", nom: "Château Pourpre", imageUrl: null },
  { id: "chateau-azur", nom: "Château d'Azur", imageUrl: null },
  { id: "chateau-sylve", nom: "Château de Sylve", imageUrl: null },
  { id: "chateau-ambre", nom: "Château d'Ambre", imageUrl: null },
]

export type FamilleInfo = { cle: Famille; nom: string; pluriel: string; couleur: string; pictoUrl: string | null }
export type RoleInfo = { cle: Role; nom: string; pictoUrl: string | null }

export const ORDRE_TAPIS: (Famille | "reine")[] = ["papillon", "crapaud", "rossignol", "reine", "lievre", "cerf", "carpe"]

export const FAMILLES_PAR_DEFAUT: Record<Famille, FamilleInfo> = {
  papillon: { cle: "papillon", nom: "Papillon", pluriel: "Papillons", couleur: "#a3bcc2", pictoUrl: "/pictos/picto-papillon.png" },
  crapaud: { cle: "crapaud", nom: "Crapaud", pluriel: "Crapauds", couleur: "#8d9431", pictoUrl: "/pictos/picto-crapaud.png" },
  rossignol: { cle: "rossignol", nom: "Rossignol", pluriel: "Rossignols", couleur: "#d2415e", pictoUrl: "/pictos/picto-rossignol.png" },
  lievre: { cle: "lievre", nom: "Lièvre", pluriel: "Lièvres", couleur: "#f5b935", pictoUrl: "/pictos/picto-lievre.png" },
  cerf: { cle: "cerf", nom: "Cerf", pluriel: "Cerfs", couleur: "#0f8a69", pictoUrl: "/pictos/picto-cerf.png" },
  carpe: { cle: "carpe", nom: "Carpe", pluriel: "Carpes", couleur: "#4a73b5", pictoUrl: "/pictos/picto-carpe.png" },
}

export const ROLES_PAR_DEFAUT: Record<Role, RoleInfo> = {
  noble: { cle: "noble", nom: "Noble", pictoUrl: "/pictos/picto-noble.png" },
  espion: { cle: "espion", nom: "Espion", pictoUrl: "/pictos/picto-espion.png" },
  assassin: { cle: "assassin", nom: "Assassin", pictoUrl: "/pictos/picto-assassin.png" },
  garde: { cle: "garde", nom: "Garde", pictoUrl: "/pictos/picto-garde.png" },
}

export type CatalogueClient = {
  logoUrl: string
  chateaux: ChateauOption[]
  familles: Record<Famille, FamilleInfo>
  roles: Record<Role, RoleInfo>
  cartes: Record<string, string>
  missions: Record<string, string>
  tapisUrl: string
  dosCourtisanUrl: string | null
  dosMissionBlancheUrl: string | null
  dosMissionBleueUrl: string | null
  phrasesVainqueur: string[]
}

export const PHRASES_PAR_DEFAUT = [
  "L'homme qui sait courtiser est évidemment : {pseudo} ({points} pts)",
  "La Reine n'a d'yeux que pour {pseudo} ({points} pts)",
  "Toute la cour s'incline devant {pseudo} ({points} pts)",
]

export const cleCarte = (famille: Famille, role: Role | null) => `${role ?? "base"}-${famille}`

export const CATALOGUE_PAR_DEFAUT: CatalogueClient = {
  logoUrl: "/logo.png",
  chateaux: CHATEAUX_PAR_DEFAUT,
  familles: FAMILLES_PAR_DEFAUT,
  roles: ROLES_PAR_DEFAUT,
  cartes: Object.fromEntries(
    FAMILLES.flatMap((f) => [null, ...ROLES].map((r) => [cleCarte(f, r), `/cartes/${(r ?? "base").toUpperCase()}_${f.toUpperCase()}.webp`])),
  ),
  missions: IMAGES_MISSIONS_PAR_DEFAUT,
  tapisUrl: "/tapis.jpg",
  dosCourtisanUrl: "/cartes/DOS_COURTISAN.webp",
  dosMissionBlancheUrl: "/cartes/DOS_MISSION_LIGHT.webp",
  dosMissionBleueUrl: "/cartes/DOS_MISSION_DARK.webp",
  phrasesVainqueur: PHRASES_PAR_DEFAUT,
}
