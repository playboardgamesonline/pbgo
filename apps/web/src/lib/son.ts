"use client"

export type NomSon = "survol" | "selection" | "pose" | "glisse" | "clic" | "tour" | "mission" | "assassin" | "elimine" | "victoire" | "revele"

const REGLAGES: Record<NomSon, { volume: number; ecart: number; delaiMin: number }> = {
  survol: { volume: 0.22, ecart: 0.12, delaiMin: 0.045 },
  selection: { volume: 0.5, ecart: 0.08, delaiMin: 0.05 },
  pose: { volume: 0.65, ecart: 0.1, delaiMin: 0.03 },
  glisse: { volume: 0.45, ecart: 0.12, delaiMin: 0.03 },
  clic: { volume: 0.35, ecart: 0.06, delaiMin: 0.04 },
  tour: { volume: 0.45, ecart: 0.01, delaiMin: 0.5 },
  mission: { volume: 0.4, ecart: 0.03, delaiMin: 0.2 },
  assassin: { volume: 0.5, ecart: 0.05, delaiMin: 0.2 },
  elimine: { volume: 0.5, ecart: 0.06, delaiMin: 0.1 },
  victoire: { volume: 0.55, ecart: 0, delaiMin: 1 },
  revele: { volume: 0.45, ecart: 0.1, delaiMin: 0.03 },
}

const VOLUME_MUSIQUE = 0.22
const FIN_BOUCLE = 68.5714

let contexte: AudioContext | null = null
let maitre: GainNode | null = null
let bus: GainNode | null = null
let busMusique: GainNode | null = null
let musique: AudioBufferSourceNode | null = null
let actif = true
const tampons = new Map<string, Promise<AudioBuffer | null>>()
const derniers = new Map<NomSon, { t: number; serie: number }>()

function charger(nom: string) {
  let p = tampons.get(nom)
  if (!p && contexte) {
    const ctx = contexte
    p = fetch(`/sons/${nom}.mp3`)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx.decodeAudioData(b))
      .catch(() => null)
    tampons.set(nom, p)
  }
  return p ?? Promise.resolve(null)
}

function demarrerMusique() {
  if (!contexte || !busMusique || musique) return
  const ctx = contexte
  const sortie = busMusique
  charger("musique").then((tampon) => {
    if (!tampon || musique) return
    const source = ctx.createBufferSource()
    source.buffer = tampon
    source.loop = true
    source.loopEnd = Math.min(FIN_BOUCLE, tampon.duration)
    source.connect(sortie)
    source.start()
    musique = source
  })
}

export function initialiserSon() {
  if (typeof window === "undefined") return
  if (!contexte) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    contexte = new Ctx()
    maitre = contexte.createGain()
    maitre.gain.value = actif ? 1 : 0
    maitre.connect(contexte.destination)
    bus = contexte.createGain()
    bus.connect(maitre)
    busMusique = contexte.createGain()
    busMusique.gain.value = 0
    busMusique.connect(maitre)
    busMusique.gain.setTargetAtTime(VOLUME_MUSIQUE, contexte.currentTime + 0.3, 1.5)
    for (const nom of Object.keys(REGLAGES)) charger(nom)
  }
  if (contexte.state === "suspended") contexte.resume().catch(() => null)
  demarrerMusique()
}

export function reglerSon(on: boolean) {
  actif = on
  if (contexte && maitre) maitre.gain.setTargetAtTime(on ? 1 : 0, contexte.currentTime, 0.12)
}

export function jouerSon(nom: NomSon, { volume = 1, delai = 0 }: { volume?: number; delai?: number } = {}) {
  if (!contexte || !bus || !actif) return
  const ctx = contexte
  const sortie = bus
  const r = REGLAGES[nom]
  const quand = ctx.currentTime + delai
  const precedent = derniers.get(nom)
  if (precedent && quand - precedent.t < r.delaiMin) return
  const serie = precedent && quand - precedent.t < 0.6 ? precedent.serie + 1 : 0
  derniers.set(nom, { t: quand, serie })
  charger(nom).then((tampon) => {
    if (!tampon) return
    const source = ctx.createBufferSource()
    source.buffer = tampon
    const ecart = r.ecart * (1 + Math.min(serie, 4) * 0.25)
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * ecart
    const gain = ctx.createGain()
    gain.gain.value = r.volume * volume * (0.82 + Math.random() * 0.18) * Math.max(0.6, 1 - serie * 0.08)
    source.connect(gain).connect(sortie)
    source.start(Math.max(quand, ctx.currentTime))
  })
}
