"use client"

import * as binding from "@pbgo/binding"

/**
 * Moteur de son commun (WebAudio) : bus effets / musique / ambiance, anti-rafale, variations de hauteur et de volume,
 * musiques bouclées sur un point de fin musical (pas sur la durée du fichier, qui contient la queue de réverbération).
 * Le jeu déclare ses sons via l'export facultatif `SOUNDS` de @pbgo/binding ; fichiers dans /public/sounds/<file>.mp3.
 */
import { CODE_SOUNDS, DEFAULT_VOLUMES, type SoundConfig, type Volumes } from "./sound-config"

export * from "./sound-config"

const { SLUG } = binding
export let SOUNDS: SoundConfig = CODE_SOUNDS
const VOLUMES_KEY = `${SLUG}:volumes`
const MUSIC_KEY = `${SLUG}:music`
const ENABLED_KEY = `${SLUG}:sound`

let baseVolumes = { ...DEFAULT_VOLUMES, ...SOUNDS.volumes }

function readVolumes(): Volumes {
  try {
    return { ...baseVolumes, ...JSON.parse(localStorage.getItem(VOLUMES_KEY) ?? "{}") }
  } catch {
    return { ...baseVolumes }
  }
}

const musicNames = () => Object.keys(SOUNDS.music ?? {})

function readMusic(): string | null {
  try {
    const m = localStorage.getItem(MUSIC_KEY)
    if (m && SOUNDS.music?.[m]) return m
  } catch {}
  return SOUNDS.defaultMusic ?? musicNames()[0] ?? null
}

export function readSoundEnabled() {
  try {
    return localStorage.getItem(ENABLED_KEY) === "on" // coupé par défaut : le joueur l'active lui-même
  } catch {
    return false
  }
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let effectsBus: GainNode | null = null
let musicBus: GainNode | null = null
let ambienceBus: GainNode | null = null
let alertsBus: GainNode | null = null
let music: { name: string; source: AudioBufferSourceNode; gain: GainNode } | null = null
let ambience: AudioBufferSourceNode | null = null
let enabled = false
let volumes: Volumes = typeof window === "undefined" ? baseVolumes : readVolumes()
let track: string | null = typeof window === "undefined" ? null : readMusic()
const buffers = new Map<string, Promise<AudioBuffer | null>>()
const lastPlayed = new Map<string, number>()

const soundUrl = (s: { file: string; url?: string | null }) => s.url ?? `/sounds/${s.file}.mp3`

/** Réglages de l'admin (fichiers Sanity, volumes, musiques) : appelé au rendu de l'AppShell, avant tout son. */
export function configureSounds(config: SoundConfig) {
  if (config === SOUNDS) return
  SOUNDS = config
  baseVolumes = { ...DEFAULT_VOLUMES, ...config.volumes }
  if (typeof window === "undefined") return
  volumes = readVolumes()
  track = readMusic()
}

function load(sound: { file: string; url?: string | null }) {
  const file = soundUrl(sound)
  let p = buffers.get(file)
  if (!p && ctx) {
    const c = ctx
    p = fetch(file)
      .then((r) => r.arrayBuffer())
      .then((b) => c.decodeAudioData(b))
      .catch(() => null)
    buffers.set(file, p)
  }
  return p ?? Promise.resolve(null)
}

function loop(buffer: AudioBuffer, end: number, output: AudioNode) {
  const source = ctx!.createBufferSource()
  source.buffer = buffer
  source.loop = true
  source.loopEnd = Math.min(end, buffer.duration)
  source.connect(output)
  source.start()
  return source
}

function startMusic() {
  if (!ctx || !musicBus || !track || music?.name === track) return
  const c = ctx
  const name = track
  const def = SOUNDS.music?.[name]
  if (!def) return
  const previous = music
  load(def).then((buffer) => {
    if (!buffer || track !== name || music?.name === name) return
    const gain = c.createGain()
    gain.gain.value = 0
    gain.connect(musicBus!)
    gain.gain.setTargetAtTime(1, c.currentTime, 0.8)
    music = { name, source: loop(buffer, def.loopEnd, gain), gain }
    if (previous) {
      previous.gain.gain.setTargetAtTime(0, c.currentTime, 0.5)
      previous.source.stop(c.currentTime + 3)
    }
  })
}

function startAmbience() {
  const def = SOUNDS.ambience
  if (!ctx || !ambienceBus || ambience || !def) return
  load(def).then((buffer) => {
    if (!buffer || ambience) return
    ambience = loop(buffer, def.loopEnd, ambienceBus!)
  })
}

function applyVolumes(smoothing = 0.15) {
  if (!ctx || !master || !effectsBus || !musicBus || !ambienceBus || !alertsBus) return
  const t = ctx.currentTime
  master.gain.setTargetAtTime(enabled ? volumes.master : 0, t, smoothing)
  effectsBus.gain.setTargetAtTime(volumes.effects, t, smoothing)
  musicBus.gain.setTargetAtTime(volumes.music, t, smoothing)
  ambienceBus.gain.setTargetAtTime(volumes.ambience, t, smoothing)
  alertsBus.gain.setTargetAtTime(volumes.alerts, t, smoothing)
}

/** À appeler sur un geste utilisateur (politique d'autoplay) : crée le contexte, précharge les effets, lance musique et ambiance. */
export function initSound() {
  if (typeof window === "undefined") return
  if (!ctx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    ctx = new Ctx()
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    effectsBus = ctx.createGain()
    effectsBus.connect(master)
    musicBus = ctx.createGain()
    musicBus.connect(master)
    ambienceBus = ctx.createGain()
    ambienceBus.connect(master)
    alertsBus = ctx.createGain()
    alertsBus.connect(master)
    applyVolumes(1)
    for (const e of Object.values(SOUNDS.effects)) load(e)
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => null)
  startMusic()
  startAmbience()
}

export function setSoundOn(on: boolean) {
  enabled = on
  applyVolumes(0.12)
}

export function currentVolumes() {
  return volumes
}

export function setVolumes(v: Partial<Volumes>) {
  volumes = { ...volumes, ...v }
  try {
    localStorage.setItem(VOLUMES_KEY, JSON.stringify(volumes))
  } catch {}
  applyVolumes()
}

export function currentMusic() {
  return track
}

export function setMusic(name: string) {
  if (!SOUNDS.music?.[name]) return
  track = name
  try {
    localStorage.setItem(MUSIC_KEY, name)
  } catch {}
  startMusic()
}

export function persistSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, on ? "on" : "off")
  } catch {}
}

/**
 * Joue un effet déclaré dans `SOUNDS.effects`. `delay` (s) est programmé sur l'horloge audio, pour caler un son sur une animation.
 * Ignoré si le même son a été programmé il y a moins de `minGap` ; volume réduit si le précédent date de moins de 0,4 s.
 */
export function playSound(name: string, { volume = 1, delay = 0, bus = "effects" }: { volume?: number; delay?: number; bus?: "effects" | "alerts" } = {}) {
  const def = SOUNDS.effects[name]
  if (!ctx || !effectsBus || !alertsBus || !enabled || !def) return
  const c = ctx
  const output = bus === "alerts" ? alertsBus : effectsBus
  const at = c.currentTime + delay
  const previous = lastPlayed.get(name)
  if (previous !== undefined && Math.abs(at - previous) < (def.minGap ?? 0.03)) return
  const close = previous !== undefined && Math.abs(at - previous) < 0.4
  lastPlayed.set(name, at)
  load(def).then((buffer) => {
    if (!buffer) return
    const source = c.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * (def.spread ?? 0)
    const gain = c.createGain()
    gain.gain.value = def.volume * volume * (0.88 + Math.random() * 0.12) * (close ? 0.85 : 1)
    source.connect(gain).connect(output)
    source.start(Math.max(at, c.currentTime))
  })
}
