import { SHARED_EFFECTS, type SoundConfig } from "@pbgo/core/lib/sound-config"

/**
 * Courtisans sound mix: the effects the board plays and how (volume, pitch spread, minimum gap). The cards make their own (hover, select, slide, place: `SHARED_EFFECTS`), the platform the announcements' (turn, victory) and the buttons' (click);
 * the game's own are the ones no card shows. The files, the music and the ambience come from the Sanity "audio" document (Gamemaster › Audio); an effect with no file there stays silent.
 */
export const SOUNDS = {
  effects: {
    ...SHARED_EFFECTS,
    mission: { volume: 0.4, spread: 0, minGap: 0.2 },
    assassin: { volume: 0.5, spread: 0.015, minGap: 0.2 },
    eliminate: { volume: 0.5, spread: 0.02, minGap: 0.1 },
    reveal: { volume: 0.45, spread: 0.03, minGap: 0.03 },
  },
  defaultMusic: "dance",
  volumes: { master: 1, music: 0.1, effects: 0.8, ambience: 0.18 },
} satisfies SoundConfig

export type SoundName = keyof typeof SOUNDS.effects
