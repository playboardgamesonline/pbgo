import { CADRE_PICTO_DEFAUT, REGLES_ROLES_DEFAUT, TEXTES_REGLES_DEFAUT, type TextesRegles } from "./regles-defaut"
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
  papillon: { cle: "papillon", nom: "Papillon", pluriel: "Papillons", couleur: "#a3bcc2", pictoUrl: "/pictograms/PICTOGRAM_BUTTERFLY.webp" },
  crapaud: { cle: "crapaud", nom: "Crapaud", pluriel: "Crapauds", couleur: "#8d9431", pictoUrl: "/pictograms/PICTOGRAM_TOAD.webp" },
  rossignol: { cle: "rossignol", nom: "Rossignol", pluriel: "Rossignols", couleur: "#d2415e", pictoUrl: "/pictograms/PICTOGRAM_NIGHTINGALE.webp" },
  lievre: { cle: "lievre", nom: "Lièvre", pluriel: "Lièvres", couleur: "#f5b935", pictoUrl: "/pictograms/PICTOGRAM_HARE.webp" },
  cerf: { cle: "cerf", nom: "Cerf", pluriel: "Cerfs", couleur: "#0f8a69", pictoUrl: "/pictograms/PICTOGRAM_STAG.webp" },
  carpe: { cle: "carpe", nom: "Carpe", pluriel: "Carpes", couleur: "#4a73b5", pictoUrl: "/pictograms/PICTOGRAM_CARP.webp" },
}

export const ROLES_PAR_DEFAUT: Record<Role, RoleInfo> = {
  noble: { cle: "noble", nom: "Noble", pictoUrl: "/pictograms/PICTOGRAM_NOBLE.webp" },
  espion: { cle: "espion", nom: "Espion", pictoUrl: "/pictograms/PICTOGRAM_SPY.webp" },
  assassin: { cle: "assassin", nom: "Assassin", pictoUrl: "/pictograms/PICTOGRAM_ASSASSIN.webp" },
  garde: { cle: "garde", nom: "Garde", pictoUrl: "/pictograms/PICTOGRAM_GUARD.webp" },
}

const FAMILLE_EN: Record<Famille, string> = {
  papillon: "BUTTERFLY",
  crapaud: "TOAD",
  rossignol: "NIGHTINGALE",
  lievre: "HARE",
  cerf: "STAG",
  carpe: "CARP",
}
const ROLE_EN: Record<Role, string> = { noble: "NOBLE", garde: "GUARD", espion: "SPY", assassin: "ASSASSIN" }
const imageCarteDefaut = (f: Famille, r: Role | null) => `/cards/${r ? ROLE_EN[r] : "BASE"}_${FAMILLE_EN[f]}.webp`

const NOMBRE_PAR_FAMILLE: Record<Role, number> = { noble: 4, garde: 3, espion: 2, assassin: 2 }

export type RoleRegles = {
  nom: string
  nombre: number
  texte: string
  letteringUrl: string | null
  pictoUrl: string | null
  cartes: [string, string]
}

export const FAMILLES_VISUEL_ROLE: Record<Role, [Famille, Famille]> = {
  noble: ["papillon", "carpe"],
  garde: ["lievre", "carpe"],
  espion: ["lievre", "crapaud"],
  assassin: ["rossignol", "cerf"],
}

export type FamilleRegles = { cle: Famille; nom: string; couleur: string; pictoUrl: string | null; carteUrl: string }

export const MISSIONS_VISUEL_REGLES: [string, string] = ["mission-dark-7", "mission-light-5"]

export type ContenuRegles = {
  textes: TextesRegles
  roles: Record<Role, RoleRegles>
  familles: FamilleRegles[]
  missions: [string, string]
  cadrePicto: string
}

export const REGLES_PAR_DEFAUT: ContenuRegles = {
  textes: TEXTES_REGLES_DEFAUT,
  cadrePicto: CADRE_PICTO_DEFAUT,
  familles: ORDRE_TAPIS.filter((f): f is Famille => f !== "reine").map((f) => ({
    cle: f,
    nom: FAMILLES_PAR_DEFAUT[f].nom,
    couleur: FAMILLES_PAR_DEFAUT[f].couleur,
    pictoUrl: FAMILLES_PAR_DEFAUT[f].pictoUrl,
    carteUrl: imageCarteDefaut(f, null),
  })),
  missions: MISSIONS_VISUEL_REGLES.map((id) => IMAGES_MISSIONS_PAR_DEFAUT[id]!) as [string, string],
  roles: Object.fromEntries(
    ROLES.map((r) => [
      r,
      {
        nom: ROLES_PAR_DEFAUT[r].nom,
        nombre: NOMBRE_PAR_FAMILLE[r],
        cartes: FAMILLES_VISUEL_ROLE[r].map((f) => imageCarteDefaut(f, r)) as [string, string],
        texte: REGLES_ROLES_DEFAUT[r],
        letteringUrl: null,
        pictoUrl: ROLES_PAR_DEFAUT[r].pictoUrl,
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
  tissuUrl: string
  dosCourtisanUrl: string | null
  dosMissionBlancheUrl: string | null
  dosMissionBleueUrl: string | null
  banquetHautUrl: string | null
  banquetBasUrl: string
  reineUrl: string
  motifUrl: string
  papierUrl: string
  flecheHautUrl: string
  flecheBasUrl: string
  regles: ContenuRegles
  phrasesVainqueur: string[]
  texteBoutonMissions: string
  texteDebutBanquet: string
  texteConvives: string
}

export const PHRASES_PAR_DEFAUT = [
  "L'homme qui sait courtiser est évidemment : {pseudo} ({points} pts)",
  "La Reine n'a d'yeux que pour {pseudo} ({points} pts)",
  "Toute la cour s'incline devant {pseudo} ({points} pts)",
]

export const cleCarte = (famille: Famille, role: Role | null) => `${role ?? "base"}-${famille}`

export const CATALOGUE_PAR_DEFAUT: CatalogueClient = {
  logoUrl: "/LOGO.webp",
  chateaux: CHATEAUX_PAR_DEFAUT,
  familles: FAMILLES_PAR_DEFAUT,
  roles: ROLES_PAR_DEFAUT,
  cartes: Object.fromEntries(FAMILLES.flatMap((f) => [null, ...ROLES].map((r) => [cleCarte(f, r), imageCarteDefaut(f, r)]))),
  missions: IMAGES_MISSIONS_PAR_DEFAUT,
  tapisUrl: "/GAME_MAT.jpg",
  tissuUrl: "/textures/GAME_MAT_TEXTURE.webp",
  dosCourtisanUrl: "/cards/COURTIER_BACK.webp",
  dosMissionBlancheUrl: "/cards/MISSION_BACK_LIGHT.webp",
  dosMissionBleueUrl: "/cards/MISSION_BACK_DARK.webp",
  banquetHautUrl: "/home/DECORATION_BANQUET_TOP.webp",
  banquetBasUrl: "/home/DECORATION_BANQUET_BOTTOM.webp",
  reineUrl: "/home/QUEEN.webp",
  motifUrl: "/home/PATTERN.webp",
  papierUrl: "/home/PAPER.webp",
  flecheHautUrl: "/pictograms/PICTOGRAM_ARROW_UP.svg",
  flecheBasUrl: "/pictograms/PICTOGRAM_ARROW_DOWN.svg",
  regles: REGLES_PAR_DEFAUT,
  phrasesVainqueur: PHRASES_PAR_DEFAUT,
  texteBoutonMissions: "Missions comprises",
  texteDebutBanquet: "Le banquet peut commencer !",
  texteConvives: "Les convives s'installent…",
}
