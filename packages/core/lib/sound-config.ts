import type { GameBinding } from "./binding"

/**
 * Sound types and the sounds declared by a game, shared by the server (admin settings) and the sound engine (client).
 * A game declares the effects it plays through the optional `SOUNDS` of its binding (volume, pitch spread, minimum gap). The files, the music and the ambience
 * are in Sanity only (the `audio` document, Gamemaster › Audio): an effect with no file there stays silent.
 */
/** `url`: the file stored in Sanity, set by `loadAudio` (none until one is uploaded in the admin). */
export type EffectSound = { url?: string | null; volume: number; spread?: number; minGap?: number }
export type LoopSound = { url?: string | null; title?: string; loopEnd: number }
export type SoundConfig = {
  effects: Record<string, EffectSound>
  music?: Record<string, LoopSound>
  ambience?: LoopSound
  defaultMusic?: string
  volumes?: Partial<Volumes>
}

/** `alerts`: announcement sounds (start, your turn, victory); `reactions`: chat soundboard. */
export type Volumes = { master: number; music: number; effects: number; ambience: number; alerts: number; reactions: number }
export const DEFAULT_VOLUMES: Volumes = { master: 1, music: 0.1, effects: 0.8, ambience: 0.18, alerts: 0.8, reactions: 0.6 }

export const NO_SOUNDS: SoundConfig = { effects: {} }

/** Sounds declared by a game (optional `SOUNDS` of its binding), completed in the admin (`loadAudio`). */
export const codeSounds = (binding: GameBinding): SoundConfig => binding.SOUNDS ?? NO_SOUNDS
