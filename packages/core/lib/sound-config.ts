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

/**
 * The effects every board shares, with a mix to start from. Their names are the platform's: the announcements play `turn` and `victory`, a button plays `click`, and the table's cards play `hover` under the pointer, `select` when one is chosen, `slide` as one
 * flies off and `place` as it lands (`@pbgo/table`). A game declares the ones it has files for, `effects: { ...SHARED_EFFECTS }` with its own beside them, and uploads a file for each in Gamemaster › Audio: an effect with no file stays silent.
 */
export const SHARED_EFFECTS = {
  click: { volume: 0.35, spread: 0.015, minGap: 0.04 },
  turn: { volume: 0.45, spread: 0, minGap: 0.5 },
  victory: { volume: 0.55, spread: 0, minGap: 1 },
  hover: { volume: 0.22, spread: 0.025, minGap: 0.045 },
  select: { volume: 0.5, spread: 0.02, minGap: 0.05 },
  slide: { volume: 0.45, spread: 0.03, minGap: 0.03 },
  place: { volume: 0.65, spread: 0.03, minGap: 0.03 },
} satisfies Record<string, EffectSound>

/** The name of a shared effect */
export type SharedEffect = keyof typeof SHARED_EFFECTS

export const NO_SOUNDS: SoundConfig = { effects: {} }

/** Sounds declared by a game (optional `SOUNDS` of its binding), completed in the admin (`loadAudio`). */
export const codeSounds = (binding: GameBinding): SoundConfig => binding.SOUNDS ?? NO_SOUNDS
