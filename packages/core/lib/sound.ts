"use client"

/**
 * Shared sound engine (WebAudio): effects / music / ambience buses, anti-burst, pitch and volume variations,
 * music looped on a musical end point (not on the file duration, which holds the reverb tail).
 * A game declares its sounds through the optional `SOUNDS` of its binding; files in `public/<slug>/sounds/<file>.mp3`.
 * A page shows one game: `AppShell` calls `configureSounds` with it on the client, before any sound.
 */
import { DEFAULT_VOLUMES, NO_SOUNDS, soundUrl, type SoundConfig, type Volumes } from "./sound-config"

export * from "./sound-config"

let slug = ""
let SOUNDS: SoundConfig = NO_SOUNDS
let baseVolumes: Volumes = { ...DEFAULT_VOLUMES }

/** Preferences are kept per game: `<slug>:volumes`, `<slug>:music`, `<slug>:sound`. */
const storageKey = (name: "volumes" | "music" | "sound") => `${slug}:${name}`

function readVolumes(): Volumes {
  try {
    return { ...baseVolumes, ...JSON.parse(localStorage.getItem(storageKey("volumes")) ?? "{}") }
  } catch {
    return { ...baseVolumes }
  }
}

const musicNames = () => Object.keys(SOUNDS.music ?? {})

function readMusic(): string | null {
  try {
    const m = localStorage.getItem(storageKey("music"))
    if (m && SOUNDS.music?.[m]) return m
  } catch {}
  return SOUNDS.defaultMusic ?? musicNames()[0] ?? null
}

export function readSoundEnabled() {
  try {
    return localStorage.getItem(storageKey("sound")) === "on" // off by default: players turn it on themselves
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
let volumes: Volumes = baseVolumes
let track: string | null = null
const buffers = new Map<string, Promise<AudioBuffer | null>>()
const lastPlayed = new Map<string, number>()

/** Sounds of the game shown (code, then admin settings: Sanity files, volumes, music). Idempotent; a new game stops the loops of the previous one. */
export function configureSounds(game: string, config: SoundConfig) {
  if (game === slug && config === SOUNDS) return
  if (game !== slug) {
    music?.source.stop()
    ambience?.stop()
    music = null
    ambience = null
    lastPlayed.clear()
    slug = game
  }
  SOUNDS = config
  baseVolumes = { ...DEFAULT_VOLUMES, ...config.volumes }
  if (typeof window === "undefined") return
  volumes = readVolumes()
  track = readMusic()
}

function load(sound: { file: string; url?: string | null }) {
  const file = soundUrl(slug, sound)
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

/** Call on a user gesture (autoplay policy): creates the context, preloads the effects, starts music and ambience. */
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
    localStorage.setItem(storageKey("volumes"), JSON.stringify(volumes))
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
    localStorage.setItem(storageKey("music"), name)
  } catch {}
  startMusic()
}

export function persistSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(storageKey("sound"), on ? "on" : "off")
  } catch {}
}

const warnedSounds = new Set<string>()

/** In dev, reports once an effect name missing from `SOUNDS.effects` (otherwise `playSound` stays silent without a word). */
function warnUnknownSound(name: string) {
  if (process.env.NODE_ENV === "production" || warnedSounds.has(name)) return
  const known = Object.keys(SOUNDS.effects)
  if (!known.length) return // game without declared effects: the shared sounds (click, turn…) are skipped silently
  warnedSounds.add(name)
  console.warn(`[sound] Unknown sound effect "${name}". Declared effects: ${known.join(", ")}`)
}

/**
 * Plays an effect declared in `SOUNDS.effects`. `delay` (s) is scheduled on the audio clock, to sync a sound with an animation.
 * Skipped if the same sound was scheduled less than `minGap` ago; quieter if the previous one is less than 0.4 s old.
 */
export function playSound(name: string, { volume = 1, delay = 0, bus = "effects" }: { volume?: number; delay?: number; bus?: "effects" | "alerts" } = {}) {
  const def = SOUNDS.effects[name]
  if (!def) warnUnknownSound(name)
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
