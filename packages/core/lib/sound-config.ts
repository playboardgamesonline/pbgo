import type { GameBinding } from "./binding"

/**
 * Sound types and the sounds declared by a game, shared by the server (admin settings) and the sound engine (client).
 * A game declares its sounds through the optional `SOUNDS` of its binding; files in `apps/web/public/<slug>/sounds/<file>.mp3`.
 */
/** `file`: name in `public/<slug>/sounds` (without .mp3); `url`: file uploaded in the admin (takes precedence). */
export type EffectSound = { file: string; url?: string | null; volume: number; spread?: number; minGap?: number }
export type LoopSound = { file: string; url?: string | null; title?: string; loopEnd: number }
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

/** URL of a sound: the file uploaded in the admin, else the game's file in `public/<slug>/sounds`. */
export const soundUrl = (slug: string, sound: { file: string; url?: string | null }) => sound.url ?? `/${slug}/sounds/${sound.file}.mp3`
