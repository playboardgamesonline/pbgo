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
export const DOMAINE_ECHELLE = 1.1
const DECALAGE = 0.42
export const EPAISSEUR = 0.032
export const EPAISSEUR_PIOCHE = 0.026

export const FACE_HAUT = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0))
export const FACE_BAS = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0))

export type Pose = {
  position: Vector3
  quaternion: Quaternion
  echelle: number
  delai?: number
}

const pose = (x: number, y: number, z: number, q: Quaternion, echelle = 1): Pose => ({
  position: new Vector3(x, y, z),
  quaternion: q.clone(),
  echelle,
})

export type Colonne = Famille | "reine"

export function alea(cle: string) {
  let h = 2166136261
  for (let i = 0; i < cle.length; i++) h = Math.imul(h ^ cle.charCodeAt(i), 16777619)
  return ((h >>> 0) / 4294967295) * 2 - 1
}

export const penche = (cle: string, amplitude = 0.028) => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), alea(cle) * amplitude)

export const colonneX = (colonne: Colonne) => -TAPIS_L / 2 + MARGE + PAS * (ORDRE_TAPIS.indexOf(colonne) + 0.5)

export function poseTable(colonne: Colonne, niveau: Niveau, rang: number, id?: string): Pose {
  const bord = TAPIS_P / 2 + CARTE_H / 2 + rang * DECALAGE
  return pose(colonneX(colonne), 0.03 + rang * EPAISSEUR, niveau === "haut" ? -bord : bord, id ? penche(id).multiply(FACE_HAUT) : FACE_HAUT)
}

export const colonneDe = (carte: CarteVisible): Colonne => carte.famille ?? "reine"

export const PIOCHE = new Vector3(TAPIS_L / 2 + 1.2, 0, 0)
export const poseDessusPioche = (n: number) =>
  pose(PIOCHE.x, 0.03 + Math.min(n, 60) * EPAISSEUR_PIOCHE, PIOCHE.z, penche(`pioche${n}`, 0.04).multiply(FACE_BAS))

export type Orientation = "bas" | "haut" | "gauche" | "droite"
export type Siege = { position: Vector3; orientation: Orientation; largeurMax: number }

const H = -10.6
const COTE = 13.2
const SIEGES: Record<number, [number, number, Orientation, number][]> = {
  1: [[0, H, "haut", 12]],
  2: [
    [-COTE, -2.2, "gauche", 10],
    [COTE, -2.2, "droite", 10],
  ],
  3: [
    [-COTE, -2.2, "gauche", 10],
    [0, H, "haut", 12],
    [COTE, -2.2, "droite", 10],
  ],
  4: [
    [-COTE, -2.2, "gauche", 10],
    [-6, H, "haut", 9.5],
    [6, H, "haut", 9.5],
    [COTE, -2.2, "droite", 10],
  ],
}

export const MON_SIEGE: Siege = { position: new Vector3(0, 0, 5.4), orientation: "bas", largeurMax: 11 }

export function sieges(vue: VueJoueur): Map<string, Siege> {
  const moiId = vue.moi?.id
  const i = vue.joueurs.findIndex((j) => j.id === moiId)
  const adversaires = [...vue.joueurs.slice(i + 1), ...vue.joueurs.slice(0, Math.max(0, i))].filter((j) => j.id !== moiId)
  const places = SIEGES[adversaires.length] ?? []
  const map = new Map<string, Siege>()
  adversaires.forEach((j, k) => {
    const [x, z, orientation, largeurMax] = places[k] ?? [0, H, "haut", 6]
    map.set(j.id, { position: new Vector3(x, 0, z), orientation, largeurMax })
  })
  if (moiId) map.set(moiId, { ...MON_SIEGE, position: MON_SIEGE.position.clone() })
  return map
}

const ORDRE_FAMILLES = Object.keys(FAMILLES_PAR_DEFAUT) as Famille[]
export const DL = CARTE_L * DOMAINE_ECHELLE
export const DH = CARTE_H * DOMAINE_ECHELLE
const CHEVAUCHEMENT = 0.42
const ECART = 0.35

const LACET: Record<Orientation, number> = { bas: 0, haut: 0, gauche: -Math.PI / 2, droite: Math.PI / 2 }

export type ZoneDomaine = { centre: Vector3; largeur: number; profondeur: number; lacet: number; etiquette: Vector3; lacetEtiquette: number }

export const cleGroupe = (carte: CarteVisible) => carte.famille ?? "espion"

export function disposerDomaine(
  siege: Siege,
  domaine: CarteVisible[],
  deplie: string | null = null,
): { poses: Map<string, Pose>; zone: ZoneDomaine } {
  const { position: p, orientation, largeurMax } = siege
  const groupes = [...ORDRE_FAMILLES.map((f) => domaine.filter((c) => c.famille === f)), domaine.filter((c) => !c.famille)].filter(
    (g) => g.length > 0,
  )
  const naturelle = groupes.reduce((s, g) => s + DL + (g.length - 1) * CHEVAUCHEMENT, 0) + ECART * Math.max(0, groupes.length - 1)
  const fixe = DL * groupes.length
  const f = naturelle > largeurMax && naturelle > fixe ? Math.max(0.3, (largeurMax - fixe) / (naturelle - fixe)) : 1
  const largeur = groupes.length ? fixe + (naturelle - fixe) * f : DL * 2

  const lateral = orientation === "gauche" || orientation === "droite"
  const vers = orientation === "gauche" ? 1 : orientation === "droite" ? -1 : 1
  const centre = lateral ? new Vector3(p.x + vers * (0.4 + DH / 2), 0.02, p.z) : new Vector3(p.x, 0.02, p.z + 0.4 + DH / 2)
  const lacet = new Quaternion().setFromEuler(new Euler(0, LACET[orientation], 0))
  const place = (u: number, y: number, q: Quaternion) =>
    pose(lateral ? centre.x : centre.x + u, y, lateral ? centre.z + u : centre.z, lacet.clone().multiply(q), DOMAINE_ECHELLE)

  const poses = new Map<string, Pose>()
  let u = -largeur / 2 + DL / 2
  groupes.forEach((groupe) => {
    const ouvert = deplie !== null && cleGroupe(groupe[0]) === deplie && groupe.length > 1
    const milieu = u + ((groupe.length - 1) * CHEVAUCHEMENT * f) / 2
    groupe.forEach((carte, k) => {
      const position = ouvert ? milieu + (k - (groupe.length - 1) / 2) * DL * 1.04 : u + k * CHEVAUCHEMENT * f
      poses.set(carte.id, place(position, (ouvert ? 0.5 : 0.03) + k * EPAISSEUR, penche(carte.id).multiply(carte.famille ? FACE_HAUT : FACE_BAS)))
    })
    u += DL + (groupe.length - 1) * CHEVAUCHEMENT * f + ECART * f
  })

  const versTable = lateral ? new Vector3(vers, 0, 0) : new Vector3(0, 0, orientation === "haut" ? 1 : -1)
  const etiquette = centre
    .clone()
    .addScaledVector(versTable, DH / 2 + 0.25)
    .setY(0.02)
  const fond = centre.clone().setY(0.012)
  return {
    poses,
    zone: {
      centre: fond,
      largeur: Math.max(largeur, 3 * DL + 2 * ECART) + 0.6,
      profondeur: DH + 0.5,
      lacet: LACET[orientation],
      etiquette,
      lacetEtiquette: orientation === "haut" ? Math.PI : LACET[orientation],
    },
  }
}
