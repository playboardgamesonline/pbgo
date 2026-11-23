// The sounds a card makes by itself, pure so that they are tested without a canvas or an audio context. A card plays them through the platform's sound engine (`playSound` of core), and a game that declares an effect of that name in its `SOUNDS` (`SHARED_EFFECTS` of core has
// the mix) and uploads a file for it in Gamemaster › Audio hears it; a game that does not hears nothing, and nothing is said.

import type { CardState } from "./states"

/** The effects a card plays, by their names in `SOUNDS`: `hover` under the pointer or the keyboard focus, `select` when it is pressed or picked, `slide` as it flies off and `place` as it lands */
export const CARD_SOUND = { hover: "hover", select: "select", slide: "slide", place: "place" } as const

/**
 * The sound of a card going from the state it was drawn in to the one it is drawn in now, or null for none. The visitor's own doing makes a sound: a card that can be chosen and is now under the pointer or the keyboard focus (`hover`), and a card that is pressed or picked
 * (`select`, once: the press makes it and the pick that follows does not). What the game does, a card that becomes one that can be chosen, a disabled one, makes none.
 */
export function soundOfTransition(from: CardState, to: CardState): string | null {
  if (from === to) return null
  if (to === "hover") return from === "interactive" ? CARD_SOUND.hover : null
  if (to === "pressed") return CARD_SOUND.select
  if (to === "selected") return from === "pressed" ? null : CARD_SOUND.select
  return null
}

/** The sounds of a card's flight, on the audio clock, in seconds from now: `slide` as it leaves, after the `delay` it waits for its turn, and `place` as it lands, `duration` seconds later */
export function flightCues(delay: number, duration: number): { name: string; delay: number }[] {
  return [
    { name: CARD_SOUND.slide, delay },
    { name: CARD_SOUND.place, delay: delay + duration },
  ]
}
