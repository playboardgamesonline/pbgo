import type { CarteVisible, Famille, Niveau, VueJoueur } from "@courtisans/engine"
import { Euler, Quaternion, Vector3 } from "three"
import { FAMILLES_PAR_DEFAUT, ORDRE_TAPIS } from "@/lib/catalogue"

export const TAPIS_L = 12
export const TAPIS_P = TAPIS_L / (2362 / 579)
const MARGE = 0.033 * TAPIS_L
const PAS = (TAPIS_L - 2 * MARGE) / 7
export const CARTE_L = PAS * 0.92
export const CARTE_H = (CARTE_L * 890) / 472
export const MISSION_L = 2.4
export const MISSION_H = (MISSION_L * 452) / 688
export const DOMAINE_ECHELLE = 0.55
const DECALAGE = 0.42
const EPAISSEUR = 0.014

export const FACE_HAUT = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0))
export const FACE_BAS = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0))

export type Pose = {
  position: Vector3
  quaternion: Quaternion
  echelle: number
}

const pose = (x: number, y: number, z: number, q: Quaternion, echelle = 1): Pose => ({
  position: new Vector3(x, y, z),
  quaternion: q.clone(),
  echelle,
})

export type Colonne = Famille | "reine"

export const colonneX = (colonne: Colonne) => -TAPIS_L / 2 + MARGE + PAS * (ORDRE_TAPIS.indexOf(colonne) + 0.5)

export function poseTable(colonne: Colonne, niveau: Niveau, rang: number): Pose {
  const bord = TAPIS_P / 2 + 0.12 + CARTE_H / 2 + rang * DECALAGE
  return pose(colonneX(colonne), 0.03 + rang * EPAISSEUR, niveau === "haut" ? -bord : bord, FACE_HAUT)
}

export const colonneDe = (carte: CarteVisible): Colonne => carte.famille ?? "reine"

export const PIOCHE = new Vector3(TAPIS_L / 2 + 1.6, 0, 0)
export const poseDessusPioche = (n: number) => pose(PIOCHE.x, 0.03 + Math.min(n, 60) * 0.006, PIOCHE.z, FACE_BAS)

const SIEGES: Record<number, [number, number][]> = {
  1: [[0, -11.5]],
  2: [
    [-6.5, -11.5],
    [6.5, -11.5],
  ],
  3: [
    [-10, -9.5],
    [0, -11.5],
    [10, -9.5],
  ],
  4: [
    [-11, -4],
    [-5.5, -11.5],
    [5.5, -11.5],
    [11, -4],
  ],
}

export const MON_SIEGE = new Vector3(-9.5, 0, 5.4)
export const MISSIONS_POS = new Vector3(10.5, 0, 5)

export function sieges(vue: VueJoueur): Map<string, Vector3> {
  const moiId = vue.moi?.id
  const i = vue.joueurs.findIndex((j) => j.id === moiId)
  const adversaires = [...vue.joueurs.slice(i + 1), ...vue.joueurs.slice(0, Math.max(0, i))].filter((j) => j.id !== moiId)
  const places = SIEGES[adversaires.length] ?? []
  const map = new Map<string, Vector3>()
  adversaires.forEach((j, k) => {
    const [x, z] = places[k] ?? [0, -12]
    map.set(j.id, new Vector3(x, 0, z))
  })
  if (moiId) map.set(moiId, MON_SIEGE.clone())
  return map
}

const ORDRE_FAMILLES = Object.keys(FAMILLES_PAR_DEFAUT) as Famille[]
export const DL = CARTE_L * DOMAINE_ECHELLE
export const DH = CARTE_H * DOMAINE_ECHELLE
const CHEVAUCHEMENT = 0.24
const ECART = 0.35

export const largeurMaxDomaine = (nombreAdversaires: number) => (nombreAdversaires >= 3 ? 6.4 : 8.5)

export type ZoneDomaine = {
  centre: Vector3
  largeur: number
  profondeur: number
}

export function disposerDomaine(siege: Vector3, domaine: CarteVisible[], largeurMax: number): { poses: Map<string, Pose>; zone: ZoneDomaine } {
  const groupes = [...ORDRE_FAMILLES.map((f) => domaine.filter((c) => c.famille === f)), domaine.filter((c) => !c.famille)].filter(
    (g) => g.length > 0,
  )
  const naturelle = groupes.reduce((s, g) => s + DL + (g.length - 1) * CHEVAUCHEMENT, 0) + ECART * Math.max(0, groupes.length - 1)
  const fixe = DL * groupes.length
  const f = naturelle > largeurMax && naturelle > fixe ? Math.max(0.25, (largeurMax - fixe) / (naturelle - fixe)) : 1
  const largeur = groupes.length ? fixe + (naturelle - fixe) * f : DL * 2
  const z = siege.z + 0.4 + DH / 2
  const poses = new Map<string, Pose>()
  let x = siege.x - largeur / 2 + DL / 2
  groupes.forEach((groupe) => {
    groupe.forEach((carte, k) => {
      poses.set(carte.id, pose(x + k * CHEVAUCHEMENT * f, 0.03 + k * EPAISSEUR, z, carte.famille ? FACE_HAUT : FACE_BAS, DOMAINE_ECHELLE))
    })
    x += DL + (groupe.length - 1) * CHEVAUCHEMENT * f + ECART * f
  })
  return {
    poses,
    zone: {
      centre: new Vector3(siege.x, 0.02, z),
      largeur: largeur + 0.6,
      profondeur: DH + 1.1,
    },
  }
}
