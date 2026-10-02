"use client"

import { currentVolumes, readSoundEnabled } from "./sound"

/**
 * Réactions du chat : un emoji + un petit son synthétisé (aucun fichier audio à fournir, donc disponible dans tous les jeux).
 * Un jeu peut en ajouter ou en remplacer via l'export facultatif `REACTIONS` de @pbgo/binding (même forme).
 */
export type Reaction = { id: string; emoji: string; label: string; play: (c: AudioContext, out: AudioNode, t: number) => void }

function tone(c: AudioContext, out: AudioNode, t: number, { freq, end = freq, dur = 0.15, type = "sine", gain = 0.25, attack = 0.01 }: { freq: number; end?: number; dur?: number; type?: OscillatorType; gain?: number; attack?: number }) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function noise(c: AudioContext, out: AudioNode, t: number, dur: number, gain: number, freq: number) {
  const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const s = c.createBufferSource()
  s.buffer = buffer
  const f = c.createBiquadFilter()
  f.type = "bandpass"
  f.frequency.value = freq
  const g = c.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f).connect(g).connect(out)
  s.start(t)
}

export const DEFAULT_REACTIONS: Reaction[] = [
  { id: "clap", emoji: "👏", label: "Bravo", play: (c, o, t) => [0, 0.12, 0.25, 0.4, 0.52].forEach((d) => noise(c, o, t + d, 0.07, 0.5, 2200)) },
  { id: "laugh", emoji: "😂", label: "Haha", play: (c, o, t) => [0, 1, 2, 3].forEach((i) => tone(c, o, t + i * 0.14, { freq: 520 - i * 40, end: 360 - i * 30, dur: 0.11, type: "triangle", gain: 0.3 })) },
  { id: "wow", emoji: "😱", label: "Oh !", play: (c, o, t) => tone(c, o, t, { freq: 300, end: 900, dur: 0.35, type: "sine", gain: 0.3 }) },
  { id: "party", emoji: "🎉", label: "Fête", play: (c, o, t) => [523, 659, 784, 1047].forEach((f, i) => tone(c, o, t + i * 0.09, { freq: f, dur: 0.25, type: "square", gain: 0.12 })) },
  { id: "evil", emoji: "😈", label: "Muahaha", play: (c, o, t) => [0, 1, 2].forEach((i) => tone(c, o, t + i * 0.18, { freq: 150 - i * 15, end: 90, dur: 0.17, type: "sawtooth", gain: 0.2 })) },
  { id: "sad", emoji: "😢", label: "Snif", play: (c, o, t) => [392, 349, 294].forEach((f, i) => tone(c, o, t + i * 0.22, { freq: f, end: f * 0.96, dur: 0.3, type: "sine", gain: 0.25 })) },
  { id: "fire", emoji: "🔥", label: "Feu", play: (c, o, t) => { noise(c, o, t, 0.5, 0.35, 900); tone(c, o, t, { freq: 200, end: 500, dur: 0.4, type: "sawtooth", gain: 0.1 }) } },
  { id: "love", emoji: "❤️", label: "Love", play: (c, o, t) => [660, 880].forEach((f, i) => tone(c, o, t + i * 0.13, { freq: f, dur: 0.3, type: "sine", gain: 0.25 })) },
]

let ctx: AudioContext | null = null
let bus: GainNode | null = null

/** À appeler sur un geste utilisateur (le navigateur bloque l'audio avant). */
export function prepareSoundboard() {
  try {
    if (!ctx) {
      ctx = new AudioContext()
      bus = ctx.createGain()
      bus.gain.value = 0.6
      bus.connect(ctx.destination)
    }
    if (ctx.state === "suspended") void ctx.resume()
  } catch {}
}

export function playReaction(reaction: Reaction) {
  if (!readSoundEnabled()) return
  prepareSoundboard()
  if (bus) bus.gain.value = currentVolumes().reactions * currentVolumes().master
  if (ctx && bus) reaction.play(ctx, bus, ctx.currentTime + 0.02)
}
