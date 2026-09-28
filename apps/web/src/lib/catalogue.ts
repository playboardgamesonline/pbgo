import { REGLES_ROLES_DEFAUT, TEXTES_REGLES_DEFAUT, type TextesRegles, VISUELS_REGLES_DEFAUT, type VisuelsRegles } from "./regles-defaut"
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
  papillon: { cle: "papillon", nom: "Papillon", pluriel: "Papillons", couleur: "#a3bcc2", pictoUrl: "/pictos/picto-papillon.webp" },
  crapaud: { cle: "crapaud", nom: "Crapaud", pluriel: "Crapauds", couleur: "#8d9431", pictoUrl: "/pictos/picto-crapaud.webp" },
  rossignol: { cle: "rossignol", nom: "Rossignol", pluriel: "Rossignols", couleur: "#d2415e", pictoUrl: "/pictos/picto-rossignol.webp" },
  lievre: { cle: "lievre", nom: "Lièvre", pluriel: "Lièvres", couleur: "#f5b935", pictoUrl: "/pictos/picto-lievre.webp" },
  cerf: { cle: "cerf", nom: "Cerf", pluriel: "Cerfs", couleur: "#0f8a69", pictoUrl: "/pictos/picto-cerf.webp" },
  carpe: { cle: "carpe", nom: "Carpe", pluriel: "Carpes", couleur: "#4a73b5", pictoUrl: "/pictos/picto-carpe.webp" },
}

export const ROLES_PAR_DEFAUT: Record<Role, RoleInfo> = {
  noble: { cle: "noble", nom: "Noble", pictoUrl: "/pictos/picto-noble.webp" },
  espion: { cle: "espion", nom: "Espion", pictoUrl: "/pictos/picto-espion.webp" },
  assassin: { cle: "assassin", nom: "Assassin", pictoUrl: "/pictos/picto-assassin.webp" },
  garde: { cle: "garde", nom: "Garde", pictoUrl: "/pictos/picto-garde.webp" },
}

const NOMBRE_PAR_FAMILLE: Record<Role, number> = { noble: 4, garde: 3, espion: 2, assassin: 2 }

export type RoleRegles = { nom: string; nombre: number; texte: string; letteringUrl: string | null; cartes: [string, string] }

export const FAMILLES_VISUEL_ROLE: Record<Role, [Famille, Famille]> = {
  noble: ["papillon", "carpe"],
  garde: ["lievre", "carpe"],
  espion: ["lievre", "crapaud"],
  assassin: ["rossignol", "cerf"],
}

export type ContenuRegles = {
  textes: TextesRegles
  visuels: VisuelsRegles
  roles: Record<Role, RoleRegles>
}

export const REGLES_PAR_DEFAUT: ContenuRegles = {
  textes: TEXTES_REGLES_DEFAUT,
  visuels: VISUELS_REGLES_DEFAUT,
  roles: Object.fromEntries(
    ROLES.map((r) => [
      r,
      {
        nom: ROLES_PAR_DEFAUT[r].nom,
        nombre: NOMBRE_PAR_FAMILLE[r],
        cartes: FAMILLES_VISUEL_ROLE[r].map((f) => `/cartes/${r.toUpperCase()}_${f.toUpperCase()}.webp`) as [string, string],
        texte: REGLES_ROLES_DEFAUT[r],
        letteringUrl: null,
      },
    ]),
  ) as Record<Role, RoleRegles>,
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
  banquetHautUrl: string | null
  banquetBasUrl: string
  regles: ContenuRegles
  phrasesVainqueur: string[]
  texteBoutonMissions: string
  texteDebutBanquet: string
}

export const PHRASES_PAR_DEFAUT = [
  "L'homme qui sait courtiser est évidemment : {pseudo} ({points} pts)",
  "La Reine n'a d'yeux que pour {pseudo} ({points} pts)",
  "Toute la cour s'incline devant {pseudo} ({points} pts)",
]

export const cleCarte = (famille: Famille, role: Role | null) => `${role ?? "base"}-${famille}`

export const CATALOGUE_PAR_DEFAUT: CatalogueClient = {
  logoUrl: "/logo.webp",
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
  banquetHautUrl: "/accueil/banquet-haut-3200.webp",
  banquetBasUrl: "/accueil/banquet-bas-3200.webp",
  regles: REGLES_PAR_DEFAUT,
  phrasesVainqueur: PHRASES_PAR_DEFAUT,
  texteBoutonMissions: "Missions comprises",
  texteDebutBanquet: "Le banquet peut commencer !",
}
