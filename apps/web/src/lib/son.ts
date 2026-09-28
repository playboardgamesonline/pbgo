"use client"

export type NomSon = "survol" | "selection" | "pose" | "glisse" | "clic" | "tour" | "mission" | "assassin" | "elimine" | "victoire" | "revele"

const REGLAGES: Record<NomSon, { volume: number; ecart: number; delaiMin: number }> = {
  survol: { volume: 0.22, ecart: 0.025, delaiMin: 0.045 },
  selection: { volume: 0.5, ecart: 0.02, delaiMin: 0.05 },
  pose: { volume: 0.65, ecart: 0.03, delaiMin: 0.03 },
  glisse: { volume: 0.45, ecart: 0.03, delaiMin: 0.03 },
  clic: { volume: 0.35, ecart: 0.015, delaiMin: 0.04 },
  tour: { volume: 0.45, ecart: 0, delaiMin: 0.5 },
  mission: { volume: 0.4, ecart: 0, delaiMin: 0.2 },
  assassin: { volume: 0.5, ecart: 0.015, delaiMin: 0.2 },
  elimine: { volume: 0.5, ecart: 0.02, delaiMin: 0.1 },
  victoire: { volume: 0.55, ecart: 0, delaiMin: 1 },
  revele: { volume: 0.45, ecart: 0.03, delaiMin: 0.03 },
}

export const MUSIQUES = { danse: 68.5714, estampie: 60.6316, pavane: 120, branle: 66.2069 } as const
export type NomMusique = keyof typeof MUSIQUES
const DUREE_AMBIANCE = 48

export type Volumes = { general: number; musique: number; effets: number; ambiance: number }
export const VOLUMES_DEFAUT: Volumes = { general: 1, musique: 0.1, effets: 0.8, ambiance: 0.18 }
const CLE_VOLUMES = "courtisans:volumes"
const CLE_MUSIQUE = "courtisans:musique"

function lireVolumes(): Volumes {
  try {
    return { ...VOLUMES_DEFAUT, ...JSON.parse(localStorage.getItem(CLE_VOLUMES) ?? "{}") }
  } catch {
    return { ...VOLUMES_DEFAUT }
  }
}

function lireMusique(): NomMusique {
  try {
    const m = localStorage.getItem(CLE_MUSIQUE)
    if (m && m in MUSIQUES) return m as NomMusique
  } catch {}
  return "danse"
}

let contexte: AudioContext | null = null
let maitre: GainNode | null = null
let bus: GainNode | null = null
let busMusique: GainNode | null = null
let busAmbiance: GainNode | null = null
let musique: { nom: NomMusique; source: AudioBufferSourceNode; gain: GainNode } | null = null
let ambiance: AudioBufferSourceNode | null = null
let actif = true
let volumes: Volumes = typeof window === "undefined" ? VOLUMES_DEFAUT : lireVolumes()
let piste: NomMusique = typeof window === "undefined" ? "danse" : lireMusique()
const tampons = new Map<string, Promise<AudioBuffer | null>>()
const derniers = new Map<NomSon, number>()

const FICHIERS_SONS: Record<string, string> = {
  ambiance: "AMBIENCE",
  assassin: "ASSASSIN",
  clic: "CLICK",
  elimine: "ELIMINATE",
  glisse: "SLIDE",
  mission: "MISSION",
  pose: "PLACE",
  revele: "REVEAL",
  selection: "SELECT",
  survol: "HOVER",
  tour: "TURN",
  victoire: "VICTORY",
  "musique-branle": "MUSIC_BRANLE",
  "musique-danse": "MUSIC_DANCE",
  "musique-estampie": "MUSIC_ESTAMPIE",
  "musique-pavane": "MUSIC_PAVANE",
}

function charger(nom: string) {
  let p = tampons.get(nom)
  if (!p && contexte) {
    const ctx = contexte
    p = fetch(`/sounds/${FICHIERS_SONS[nom] ?? nom}.mp3`)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx.decodeAudioData(b))
      .catch(() => null)
    tampons.set(nom, p)
  }
  return p ?? Promise.resolve(null)
}

function boucle(tampon: AudioBuffer, fin: number, sortie: AudioNode) {
  const source = contexte!.createBufferSource()
  source.buffer = tampon
  source.loop = true
  source.loopEnd = Math.min(fin, tampon.duration)
  source.connect(sortie)
  source.start()
  return source
}

function lancerMusique() {
  if (!contexte || !busMusique || musique?.nom === piste) return
  const ctx = contexte
  const nom = piste
  const ancienne = musique
  charger(`musique-${nom}`).then((tampon) => {
    if (!tampon || piste !== nom || musique?.nom === nom) return
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(busMusique!)
    gain.gain.setTargetAtTime(1, ctx.currentTime, 0.8)
    musique = { nom, source: boucle(tampon, MUSIQUES[nom], gain), gain }
    if (ancienne) {
      ancienne.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5)
      ancienne.source.stop(ctx.currentTime + 3)
    }
  })
}

function lancerAmbiance() {
  if (!contexte || !busAmbiance || ambiance) return
  charger("ambiance").then((tampon) => {
    if (!tampon || ambiance) return
    ambiance = boucle(tampon, DUREE_AMBIANCE, busAmbiance!)
  })
}

function appliquerVolumes(lissage = 0.15) {
  if (!contexte || !maitre || !bus || !busMusique || !busAmbiance) return
  const t = contexte.currentTime
  maitre.gain.setTargetAtTime(actif ? volumes.general : 0, t, lissage)
  bus.gain.setTargetAtTime(volumes.effets, t, lissage)
  busMusique.gain.setTargetAtTime(volumes.musique, t, lissage)
  busAmbiance.gain.setTargetAtTime(volumes.ambiance, t, lissage)
}

export function initialiserSon() {
  if (typeof window === "undefined") return
  if (!contexte) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    contexte = new Ctx()
    maitre = contexte.createGain()
    maitre.gain.value = 0
    maitre.connect(contexte.destination)
    bus = contexte.createGain()
    bus.connect(maitre)
    busMusique = contexte.createGain()
    busMusique.connect(maitre)
    busAmbiance = contexte.createGain()
    busAmbiance.connect(maitre)
    appliquerVolumes(1)
    for (const nom of Object.keys(REGLAGES)) charger(nom)
  }
  if (contexte.state === "suspended") contexte.resume().catch(() => null)
  lancerMusique()
  lancerAmbiance()
}

export function reglerSon(on: boolean) {
  actif = on
  appliquerVolumes(0.12)
}

export function volumesActuels() {
  return volumes
}

export function reglerVolumes(v: Partial<Volumes>) {
  volumes = { ...volumes, ...v }
  try {
    localStorage.setItem(CLE_VOLUMES, JSON.stringify(volumes))
  } catch {}
  appliquerVolumes()
}

export function musiqueActuelle() {
  return piste
}

export function changerMusique(nom: NomMusique) {
  piste = nom
  try {
    localStorage.setItem(CLE_MUSIQUE, nom)
  } catch {}
  lancerMusique()
}

export function jouerSon(nom: NomSon, { volume = 1, delai = 0 }: { volume?: number; delai?: number } = {}) {
  if (!contexte || !bus || !actif) return
  const ctx = contexte
  const sortie = bus
  const r = REGLAGES[nom]
  const quand = ctx.currentTime + delai
  const precedent = derniers.get(nom)
  if (precedent !== undefined && Math.abs(quand - precedent) < r.delaiMin) return
  const rapproche = precedent !== undefined && Math.abs(quand - precedent) < 0.4
  derniers.set(nom, quand)
  charger(nom).then((tampon) => {
    if (!tampon) return
    const source = ctx.createBufferSource()
    source.buffer = tampon
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * r.ecart
    const gain = ctx.createGain()
    gain.gain.value = r.volume * volume * (0.88 + Math.random() * 0.12) * (rapproche ? 0.85 : 1)
    source.connect(gain).connect(sortie)
    source.start(Math.max(quand, ctx.currentTime))
  })
}
