import * as binding from "@pbgo/binding"

/**
 * Types et sons déclarés par le jeu, partagés entre le serveur (réglages de l'admin) et le moteur de son (client).
 * Le jeu déclare ses sons via l'export facultatif `SOUNDS` de @pbgo/binding ; fichiers dans /public/sounds/<file>.mp3.
 */
/** `file` : nom dans /public/sounds (sans .mp3) ; `url` : fichier envoyé dans l'admin (prioritaire). */
export type EffectSound = { file: string; url?: string | null; volume: number; spread?: number; minGap?: number }
export type LoopSound = { file: string; url?: string | null; title?: string; loopEnd: number }
export type SoundConfig = {
  effects: Record<string, EffectSound>
  music?: Record<string, LoopSound>
  ambience?: LoopSound
  defaultMusic?: string
  volumes?: Partial<Volumes>
}

export type Volumes = { master: number; music: number; effects: number; ambience: number }
export const DEFAULT_VOLUMES: Volumes = { master: 1, music: 0.1, effects: 0.8, ambience: 0.18 }

/** Sons déclarés par le jeu (export facultatif `SOUNDS` de @pbgo/binding), complétés par l'admin via `configureSounds`. */
export const CODE_SOUNDS: SoundConfig = (binding as { SOUNDS?: SoundConfig }).SOUNDS ?? { effects: {} }
