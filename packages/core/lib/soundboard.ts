"use client"

import type { UiTextKey } from "@pbgo/studio-kit/constants"
import { currentVolumes, readSoundEnabled } from "./sound"

/**
 * Chat reactions: an emoji + a small synthesized sound (no audio file to provide, so available in every game).
 * A game can add or replace some through the optional `REACTIONS` of its binding (same shape).
 * The label is a shared text (`labelKey`: translated, editable in Admin › Copy) or a `label` the game writes itself.
 */
export type Reaction = {
  id: string
  emoji: string
  play: (c: AudioContext, out: AudioNode, t: number) => void
} & ({ label: string; labelKey?: never } | { labelKey: UiTextKey; label?: never })

/** Label of a reaction (tooltip, screen readers): the shared text in the visitor's language, else the game's own `label`. */
export function reactionLabel(reaction: Reaction, t: (key: UiTextKey) => string): string {
  return reaction.labelKey ? t(reaction.labelKey) : reaction.label
}

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

/** Ids must stay listed in `DEFAULT_REACTION_IDS` (`chat.ts`): the chat route only accepts known reaction ids. */
export const DEFAULT_REACTIONS: Reaction[] = [
  { id: "clap", emoji: "👏", labelKey: "reactionClap", play: (c, o, t) => [0, 0.12, 0.25, 0.4, 0.52].forEach((d) => noise(c, o, t + d, 0.07, 0.5, 2200)) },
  { id: "laugh", emoji: "😂", labelKey: "reactionLaugh", play: (c, o, t) => [0, 1, 2, 3].forEach((i) => tone(c, o, t + i * 0.14, { freq: 520 - i * 40, end: 360 - i * 30, dur: 0.11, type: "triangle", gain: 0.3 })) },
  { id: "wow", emoji: "😱", labelKey: "reactionWow", play: (c, o, t) => tone(c, o, t, { freq: 300, end: 900, dur: 0.35, type: "sine", gain: 0.3 }) },
  { id: "party", emoji: "🎉", labelKey: "reactionParty", play: (c, o, t) => [523, 659, 784, 1047].forEach((f, i) => tone(c, o, t + i * 0.09, { freq: f, dur: 0.25, type: "square", gain: 0.12 })) },
  { id: "evil", emoji: "😈", labelKey: "reactionEvil", play: (c, o, t) => [0, 1, 2].forEach((i) => tone(c, o, t + i * 0.18, { freq: 150 - i * 15, end: 90, dur: 0.17, type: "sawtooth", gain: 0.2 })) },
  { id: "sad", emoji: "😢", labelKey: "reactionSad", play: (c, o, t) => [392, 349, 294].forEach((f, i) => tone(c, o, t + i * 0.22, { freq: f, end: f * 0.96, dur: 0.3, type: "sine", gain: 0.25 })) },
  { id: "fire", emoji: "🔥", labelKey: "reactionFire", play: (c, o, t) => { noise(c, o, t, 0.5, 0.35, 900); tone(c, o, t, { freq: 200, end: 500, dur: 0.4, type: "sawtooth", gain: 0.1 }) } },
  { id: "love", emoji: "❤️", labelKey: "reactionLove", play: (c, o, t) => [660, 880].forEach((f, i) => tone(c, o, t + i * 0.13, { freq: f, dur: 0.3, type: "sine", gain: 0.25 })) },
]

const merged = new WeakMap<Reaction[], Reaction[]>()

/** Reactions of a game: the built-in ones, where the game's `REACTIONS` replace those with the same id and add the others. */
export function gameReactions(own: Reaction[] | undefined): Reaction[] {
  if (!own?.length) return DEFAULT_REACTIONS
  let list = merged.get(own)
  if (!list) {
    const byId = new Map(own.map((r) => [r.id, r]))
    list = [...DEFAULT_REACTIONS.map((r) => byId.get(r.id) ?? r), ...own.filter((r) => !DEFAULT_REACTIONS.some((d) => d.id === r.id))]
    merged.set(own, list)
  }
  return list
}

let ctx: AudioContext | null = null
let bus: GainNode | null = null

/** Call on a user gesture (the browser blocks audio before one). */
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
