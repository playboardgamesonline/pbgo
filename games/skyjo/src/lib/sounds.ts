import { SHARED_EFFECTS, type SoundConfig } from "@pbgo/core/lib/sound-config"

/**
 * The effects Skyjo plays and their mix: the shared ones as they are (`SHARED_EFFECTS` of core). The cards of the table play `hover`, `select`, `slide` and `place` by themselves (a card that can be chosen comes under the pointer, a card is pressed, a card is dealt or flies to a cell or to the
 * discard, a card lands), the announcements `turn` and `victory`, and the platform's buttons `click`. Skyjo has no sound of its own: what happens at its table is shown by a card, so a line of its log makes none. The files are not in the code: the owner uploads one for each effect in
 * Gamemaster › Audio, and an effect with no file stays silent.
 */
export const SOUNDS = { effects: { ...SHARED_EFFECTS } } satisfies SoundConfig
