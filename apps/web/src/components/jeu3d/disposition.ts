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

export type Pose = { position: Vector3; quaternion: Quaternion; echelle: number }

const pose = (x: number, y: number, z: number, q: Quaternion, echelle = 1): Pose => ({ position: new Vector3(x, y, z), quaternion: q.clone(), echelle })

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
  1: [[0, -12]],
  2: [
    [-6.5, -12],
    [6.5, -12],
  ],
  3: [
    [-12.5, -3],
    [0, -12],
    [12.5, -3],
  ],
  4: [
    [-12.5, -2.5],
    [-6, -12],
    [6, -12],
    [12.5, -2.5],
  ],
}

export const MON_SIEGE = new Vector3(-10.5, 0, 5.2)
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
const DL = CARTE_L * DOMAINE_ECHELLE
const DH = CARTE_H * DOMAINE_ECHELLE

export const DOMAINE_ZONE = { largeur: 3 * (DL + 0.75) + 0.4, profondeur: 2 * (DH + 0.25) + 0.3 }

export function posesDomaine(siege: Vector3, domaine: CarteVisible[]): Map<string, Pose> {
  const groupes = [...ORDRE_FAMILLES.map((f) => domaine.filter((c) => c.famille === f)), domaine.filter((c) => !c.famille)].filter((g) => g.length > 0)
  const poses = new Map<string, Pose>()
  groupes.forEach((groupe, g) => {
    const col = g % 3
    const ligne = Math.floor(g / 3)
    const x0 = siege.x - DOMAINE_ZONE.largeur / 2 + 0.2 + col * (DL + 0.75) + DL / 2
    const z0 = siege.z + 0.5 + ligne * (DH + 0.25) + DH / 2
    groupe.forEach((carte, k) => {
      poses.set(carte.id, pose(x0 + k * 0.22, 0.03 + k * EPAISSEUR, z0, carte.famille ? FACE_HAUT : FACE_BAS, DOMAINE_ECHELLE))
    })
  })
  return poses
}

export const centreDomaine = (siege: Vector3) => new Vector3(siege.x, 0.01, siege.z + 0.5 + DOMAINE_ZONE.profondeur / 2 - 0.15)
