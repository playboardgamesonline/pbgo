import { SHARED_EFFECTS, type SoundConfig } from "@pbgo/core/lib/sound-config"

/**
 * The effects this game plays and their mix: the shared ones as they are (`SHARED_EFFECTS` of core: the platform's buttons play `click`, the announcements `turn` and `victory`, and the table's cards `hover`, `select`, `slide` and `place` by themselves). A game with sounds of its own
 * puts them beside, and a line of its log that no card shows makes its sound with `useLogSounds`. The files are not in the code: the owner uploads one for each effect in Gamemaster › Audio, and an effect with no file stays silent.
 */
export const SOUNDS = { effects: { ...SHARED_EFFECTS } } satisfies SoundConfig
