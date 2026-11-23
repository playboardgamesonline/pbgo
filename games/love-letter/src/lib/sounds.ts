import type { LoveLetterEvent } from "@love-letter/engine"
import type { LogLine } from "@pbgo/core/lib/game-types"
import { SHARED_EFFECTS, type SoundConfig } from "@pbgo/core/lib/sound-config"
import type { SoundCue } from "@pbgo/core/lib/sound-cues"

/**
 * The effects Love Letter plays and their mix: the shared ones as they are (`SHARED_EFFECTS` of core: the cards of the table play `hover`, `select`, `slide` and `place` by themselves, the announcements `turn` and `victory`, the platform's buttons `click`) and one of its own,
 * `eliminate`, for what no card shows: a player is knocked out of the round. The files are not in the code: the owner uploads one for each effect in Gamemaster › Audio, and an effect with no file stays silent.
 */
export const SOUNDS = { effects: { ...SHARED_EFFECTS, eliminate: { volume: 0.5, spread: 0.02, minGap: 0.3 } } } satisfies SoundConfig

/** Seconds after a player is laid down out of the round that the sound of it is heard: the cards they laid down land first (`place`), then the sound that says what it meant */
const ELIMINATION_AT = 0.35

/** What a line of the log sounds, besides what its cards do (`slide` as they leave, `place` as they land): a player out of the round, by a Guard, a Baron or the Princess, is knocked out */
export function cuesOf(line: LogLine<LoveLetterEvent>): SoundCue[] {
  return line.event.kind === "out" ? [{ name: "eliminate", delay: ELIMINATION_AT }] : []
}
