import type { Flip7Event } from "@flip-7/engine"
import type { LogLine } from "@pbgo/core/lib/game-types"
import type { SoundCue } from "@pbgo/core/lib/sound-cues"
import { SHARED_EFFECTS, type SoundConfig } from "@pbgo/core/lib/sound-config"

/**
 * The effects Flip 7 plays and their mix: the shared ones as they are (`SHARED_EFFECTS` of core: the platform's buttons play `click`, the announcements `turn` and `victory`, and the cards of the table `hover`, `select`, `slide` and `place` by themselves), and three of
 * its own beside them, for what no card shows: the BUST! stamp that drops on the cards of a player who busted, the discard that is shuffled into a new deck, and the announcement of a Flip 7. The files are not in the code: the owner uploads one for each effect in
 * Gamemaster › Audio, and an effect with no file stays silent.
 */
export const SOUNDS = {
  effects: {
    ...SHARED_EFFECTS,
    bust: { volume: 0.6, spread: 0.02, minGap: 0.3 },
    reshuffle: { volume: 0.45, spread: 0.02, minGap: 0.5 },
    flip7: { volume: 0.55, spread: 0, minGap: 1 },
  },
} satisfies SoundConfig

/** The effect of the announcement that a Flip 7 was made (`announce(…, { sound })`, on the alerts bus) */
export const FLIP_7_SOUND = "flip7" satisfies keyof typeof SOUNDS.effects

/**
 * What a line of the log sounds like, for `useLogSounds`: the cards that move make their own sounds, so a line says only what no card shows. A bust is heard when the stamp lands, once the move has played out (`settle` of its timeline: the board shows a player as
 * busted only then), and the deck that is shuffled anew when it happens.
 */
export function cuesOf(line: LogLine<Flip7Event>, settle: number): SoundCue[] {
  switch (line.event.kind) {
    case "bust":
      return [{ name: "bust", delay: settle }]
    case "reshuffle":
      return [{ name: "reshuffle" }]
    default:
      return []
  }
}
