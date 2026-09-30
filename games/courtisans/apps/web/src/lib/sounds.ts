import type { SoundConfig } from "@pgo/core/lib/sound-config"

/** Sons de Courtisans (/public/sounds). Musiques bouclées sur un nombre entier de mesures, pas sur la durée du fichier. */
export const SOUNDS: SoundConfig = {
  effects: {
    hover: { file: "HOVER", volume: 0.22, spread: 0.025, minGap: 0.045 },
    select: { file: "SELECT", volume: 0.5, spread: 0.02, minGap: 0.05 },
    place: { file: "PLACE", volume: 0.65, spread: 0.03, minGap: 0.03 },
    slide: { file: "SLIDE", volume: 0.45, spread: 0.03, minGap: 0.03 },
    click: { file: "CLICK", volume: 0.35, spread: 0.015, minGap: 0.04 },
    turn: { file: "TURN", volume: 0.45, spread: 0, minGap: 0.5 },
    mission: { file: "MISSION", volume: 0.4, spread: 0, minGap: 0.2 },
    assassin: { file: "ASSASSIN", volume: 0.5, spread: 0.015, minGap: 0.2 },
    eliminate: { file: "ELIMINATE", volume: 0.5, spread: 0.02, minGap: 0.1 },
    victory: { file: "VICTORY", volume: 0.55, spread: 0, minGap: 1 },
    reveal: { file: "REVEAL", volume: 0.45, spread: 0.03, minGap: 0.03 },
  },
  music: {
    dance: { file: "MUSIC_DANCE", loopEnd: 68.5714 },
    estampie: { file: "MUSIC_ESTAMPIE", loopEnd: 60.6316 },
    pavane: { file: "MUSIC_PAVANE", loopEnd: 120 },
    branle: { file: "MUSIC_BRANLE", loopEnd: 66.2069 },
  },
  ambience: { file: "AMBIENCE", loopEnd: 48 },
  defaultMusic: "dance",
  volumes: { master: 1, music: 0.1, effects: 0.8, ambience: 0.18 },
}

export type SoundName = keyof typeof SOUNDS.effects
